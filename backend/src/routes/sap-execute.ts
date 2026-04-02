// sap-execute.ts — SAP merchant endpoint
// Accepts X-Payment headers, verifies Solana escrow, routes capability.
// No auth middleware — escrow payment is the credential.
import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { getSapClient } from '../lib/sap-client';
import { calculateAgentTax, resolveTransactionType } from '../services/tax/agenttax-client';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const CAPABILITY_PRICES: Record<string, number> = {
  'payment:invoice':  0.01,
  'payment:settle':   0.005,
  'compliance:tax':   0.02,
};

async function verifyEscrow(
  escrowPda: string,
  requiredUsdc: number
): Promise<{ ok: boolean; balance: number; error?: string }> {
  // SAP escrow PDAs are custom program accounts — NOT SPL token accounts.
  // Use SAP SDK to read escrow state, fall back to getAccountInfo if SDK unavailable.
  const sapClient = getSapClient();
  if (sapClient) {
    try {
      const escrow = await (sapClient.escrow as any).getEscrow(escrowPda);
      const deposited = (escrow.totalDeposited ?? escrow.balance ?? 0) / 1_000_000;
      const settled = (escrow.totalSettled ?? 0) / 1_000_000;
      const available = deposited - settled;
      return { ok: available >= requiredUsdc, balance: available };
    } catch (err) {
      return { ok: false, balance: 0, error: `Escrow read failed: ${(err as Error).message}` };
    }
  }

  // Fallback: verify account exists via getAccountInfo (weaker — dev/no-keypair only)
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const body = JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'getAccountInfo',
    params: [escrowPda, { encoding: 'base64' }],
  });
  const resp = await fetch(rpcUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });
  const json = await resp.json() as { error?: unknown; result?: { value?: unknown } };
  if (json.error || !json.result?.value) {
    return { ok: false, balance: 0, error: 'Escrow account not found or invalid' };
  }
  console.warn('[sap-execute] SAP client unavailable — escrow existence confirmed but balance not verified');
  return { ok: true, balance: requiredUsdc };
}

function getSb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

router.post('/execute', async (req: Request, res: Response) => {
  // 1. Validate payment headers
  const protocol  = req.headers['x-payment-protocol']  as string | undefined;
  const escrowPda = req.headers['x-payment-escrow-pda'] as string | undefined;
  const depositor = req.headers['x-payment-depositor'] as string | undefined;
  const network   = (req.headers['x-payment-network'] as string | undefined) || 'solana-mainnet';

  if (!protocol || protocol !== 'SAP-x402') {
    res.status(400).json({
      success: false,
      error: { message: 'Missing or invalid X-Payment-Protocol header', code: 'MISSING_PAYMENT_PROTOCOL' },
    });
    return;
  }
  if (!escrowPda) {
    res.status(400).json({
      success: false,
      error: { message: 'Missing X-Payment-Escrow-PDA header', code: 'MISSING_ESCROW_PDA' },
    });
    return;
  }

  // 2. Parse and validate body
  const { capability, params = {} } = req.body as { capability?: string; params?: Record<string, unknown> };
  if (!capability || !CAPABILITY_PRICES[capability]) {
    const valid = Object.keys(CAPABILITY_PRICES).join(', ');
    res.status(400).json({
      success: false,
      error: { message: `Unknown capability: ${capability ?? '(none)'}. Valid: ${valid}`, code: 'UNKNOWN_CAPABILITY' },
    });
    return;
  }

  const requiredUsdc = CAPABILITY_PRICES[capability];

  // 3. Verify Solana escrow balance
  let escrowResult: { ok: boolean; balance: number; error?: string };
  try {
    escrowResult = await verifyEscrow(escrowPda, requiredUsdc);
  } catch {
    res.status(503).json({
      success: false,
      error: { message: 'Escrow verification failed (RPC error)', code: 'ESCROW_RPC_ERROR' },
    });
    return;
  }

  if (!escrowResult.ok) {
    res.status(402).json({
      success: false,
      error: {
        message: `Escrow underfunded. Required: ${requiredUsdc} USDC, found: ${escrowResult.balance} USDC.${escrowResult.error ? ' ' + escrowResult.error : ''}`,
        code: 'PAYMENT_REQUIRED',
      },
      payment: { protocol: 'SAP-x402', requiredUsdc, escrowPda, network },
    });
    return;
  }

  // 4. Route capability
  const sb = getSb();
  let result: unknown;

  try {
    if (capability === 'payment:invoice') {
      const p = params as Record<string, unknown>;
      const { data: invoice, error } = await sb
        .from('Invoice')
        .insert({
          issuer:      p.issuer      || depositor || 'sap-agent',
          recipient:   p.recipient   || '',
          amount:      p.amount      ?? requiredUsdc,
          currency:    p.currency    || 'USDC',
          network,
          status:      'PENDING',
          description: p.description || 'SAP-brokered invoice',
          metadata:    { source: 'sap-execute', escrowPda, depositor },
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      result = invoice;

    } else if (capability === 'payment:settle') {
      const invoiceId = params.invoiceId as string | undefined;
      if (!invoiceId) {
        res.status(400).json({
          success: false,
          error: { message: 'params.invoiceId required for payment:settle', code: 'MISSING_INVOICE_ID' },
        });
        return;
      }
      const { data: invoice, error } = await sb
        .from('Invoice')
        .select('id, status, amount, currency, network, createdAt, updatedAt')
        .eq('id', invoiceId)
        .single();
      if (error || !invoice) {
        res.status(404).json({
          success: false,
          error: { message: `Invoice ${invoiceId} not found`, code: 'INVOICE_NOT_FOUND' },
        });
        return;
      }
      result = invoice;

    } else {
      // compliance:tax — AMD-22 tax calculation via AgentTax API
      const p = params as Record<string, unknown>;
      const buyerState = typeof p.buyer_state === 'string' ? p.buyer_state.trim().toUpperCase() : '';
      if (!buyerState || buyerState.length < 2) {
        res.status(400).json({
          success: false,
          error: {
            message: 'params.buyer_state required for compliance:tax (e.g. "CA", "TX", "NY")',
            code: 'MISSING_BUYER_STATE',
          },
        });
        return;
      }
      const amount = typeof p.amount === 'number' ? p.amount : requiredUsdc;
      const txType = resolveTransactionType(
        typeof p.transaction_type === 'string' ? p.transaction_type : undefined,
      );
      const taxLine = await calculateAgentTax({
        role: 'seller',
        amount,
        buyer_state: buyerState,
        transaction_type: txType,
        counterparty_id: depositor || 'sap-agent',
        is_b2b: true,
      });
      if (!taxLine) {
        res.status(503).json({
          success: false,
          error: {
            message: 'Tax calculation unavailable. Ensure AGENTTAX_API_KEY is set on the server.',
            code: 'TAX_ENGINE_UNAVAILABLE',
          },
        });
        return;
      }
      result = taxLine;
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[sap-execute] capability error: ${msg}`);
    res.status(500).json({
      success: false,
      error: { message: 'Capability execution failed', code: 'CAPABILITY_ERROR' },
    });
    return;
  }

  // 5. Settle escrow via SAP SDK (v0.6: client.escrow.settle)
  // Fire-and-forget — response goes out immediately, Solana tx in background.
  const serviceHash = crypto
    .createHash('sha256')
    .update(`${capability}:${JSON.stringify(result)}`)
    .digest('hex');
  const sapClient = getSapClient();
  if (sapClient && depositor) {
    (sapClient.escrow.settle(depositor, 1, serviceHash) as Promise<string>)
      .then((sig: string) =>
        console.info(`[sap-execute] escrow settled sig=${sig} escrow=${escrowPda} capability=${capability}`)
      )
      .catch((err: Error) =>
        console.error(`[sap-execute] settle failed escrow=${escrowPda}: ${err.message}`)
      );
  } else {
    console.warn(`[sap-execute] settle skipped — sapClient=${!!sapClient} depositor=${depositor}`);
  }

  console.info(
    `[sap-execute] capability complete escrow=${escrowPda} depositor=${depositor} capability=${capability} price=${requiredUsdc}`
  );

  res.json({ success: true, capability, result });
});

export default router;
