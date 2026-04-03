// sap-execute.ts — SAP merchant endpoint
// Accepts X-Payment headers, verifies Solana escrow, routes capability.
// No auth middleware — escrow payment is the credential.
import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { PublicKey } from '@solana/web3.js';
import { getSapClient } from '../lib/sap-client';
import { calculateAgentTax, resolveTransactionType } from '../services/tax/agenttax-client';
import { createClient } from '@supabase/supabase-js';

const AGENT_PDA = process.env.SAP_AGENT_PDA || 'F7ZgQpK1yXahRrHav5DFfaibuMEcNHn8KVBHWWsKop7P';

const router = Router();

const CAPABILITY_PRICES: Record<string, number> = {
  'payment:invoice':  0.01,
  'payment:settle':   0.005,
  'compliance:tax':   0.02,
};

async function verifyEscrow(
  escrowPda: string,
  requiredUsdc: number,
  depositor?: string,
): Promise<{ ok: boolean; balance: number; error?: string }> {
  // Use SAP SDK x402.getBalance(agentPda, depositorWallet) per skills.md §13
  const sapClient = getSapClient();
  if (sapClient && depositor) {
    try {
      const agentPdaKey = new PublicKey(AGENT_PDA);
      const depositorKey = new PublicKey(depositor);
      const balance = await (sapClient.x402 as any).getBalance(agentPdaKey, depositorKey);
      const available = typeof balance === 'number' ? balance / 1_000_000 : Number(balance) / 1_000_000;
      console.info(`[sap-execute] x402.getBalance: ${available} USDC (depositor=${depositor})`);
      return { ok: available >= requiredUsdc, balance: available };
    } catch (err) {
      console.warn(`[sap-execute] x402.getBalance failed: ${(err as Error).message} — trying getAccountInfo fallback`);
    }
  }

  // Fallback: verify escrow account exists via RPC getAccountInfo
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const body = JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'getAccountInfo',
    params: [escrowPda, { encoding: 'base64' }],
  });
  const resp = await fetch(rpcUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });
  const json = await resp.json() as { error?: unknown; result?: { value?: { lamports?: number; data?: unknown } | null } };
  if (json.error || !json.result?.value) {
    return { ok: false, balance: 0, error: 'Escrow account not found on-chain' };
  }
  // Account exists — accept with warning (balance unverified without SDK)
  console.warn('[sap-execute] SDK unavailable — escrow exists on-chain, accepting (balance unverified)');
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
    escrowResult = await verifyEscrow(escrowPda, requiredUsdc, depositor);
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
      const amount = typeof p.amount === 'number' ? p.amount : requiredUsdc;
      const invoiceNumber = Math.floor(Date.now() / 1000);
      const { data: invoice, error } = await sb
        .from('Invoice')
        .insert({
          invoiceNumber,
          sellerName:         (p.issuer as string)    || depositor || 'sap-agent',
          customerName:       (p.recipient as string) || '',
          customerEmail:      (p.email as string)     || `${depositor || 'sap-agent'}@x402.invoica.ai`,
          amount,
          subtotal:           amount,
          total:              amount,
          currency:           (p.currency as string)  || 'USDC',
          status:             'PENDING',
          serviceDescription: (p.description as string) || 'SAP-brokered invoice',
          paymentDetails:     { source: 'sap-execute', escrowPda, depositor, network },
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
    (sapClient.escrow.settle(depositor as any, 1, serviceHash) as Promise<string>)
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
