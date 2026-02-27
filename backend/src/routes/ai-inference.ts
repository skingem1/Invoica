import { Router, Request, Response, NextFunction } from 'express';
import https from 'https';
import { createClient } from '@supabase/supabase-js';
import { requireX402Payment, get402Response } from '../middleware/x402';

const router = Router();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const DEFAULT_MODEL = 'claude-haiku-4-5';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Call Anthropic API (native https, no extra deps -- same pattern as ceoBot.ts)
 */
async function callAnthropic(prompt: string, model: string): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) { reject(new Error(json.error.message)); return; }
          resolve({
            content: json.content?.[0]?.text || '',
            inputTokens: json.usage?.input_tokens || 0,
            outputTokens: json.usage?.output_tokens || 0,
          });
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Record the payment as a COMPLETED invoice in Supabase
 */
async function recordPaymentInvoice(payment: NonNullable<Request['x402Payment']>, prompt: string): Promise<string | null> {
  try {
    const sb = getSupabase();
    const now = new Date().toISOString();

    // Get next invoice number via sequence
    const { data: seqData } = await sb.rpc('nextval', { seq: 'invoice_number_seq' }).single().catch(() => ({ data: null }));
    const invoiceNum = seqData || Math.floor(Date.now() / 1000);

    const { data, error } = await sb.from('Invoice').insert({
      invoiceNumber: invoiceNum,
      status: 'COMPLETED',
      amount: Number(payment.value) / 1_000_000,
      currency: 'USDC',
      customerEmail: `${payment.from.slice(0, 10)}@x402.base`,
      customerName: `Agent ${payment.from.slice(0, 10)}...`,
      paymentDetails: JSON.stringify({
        x402Protocol: true,
        network: 'base-mainnet',
        chainId: 8453,
        payerWallet: payment.from,
        sellerWallet: payment.to,
        nonce: payment.nonce,
        signature: payment.signature.slice(0, 20) + '...',
        prompt: prompt.slice(0, 100),
        eip3009: true,
      }),
      settledAt: now,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
    }).select('id').single();

    if (error) {
      console.warn('[ai-inference] Invoice recording failed:', error.message);
      return null;
    }
    return data?.id || null;
  } catch (e) {
    console.warn('[ai-inference] Invoice recording error:', (e as Error).message);
    return null;
  }
}

/**
 * GET /v1/ai/inference -- returns 402 payment requirements
 */
router.get('/v1/ai/inference', (_req: Request, res: Response) => {
  res.status(402).json(get402Response());
});

/**
 * POST /v1/ai/inference -- x402-protected LLM inference
 * Requires: X-Payment header with valid EIP-3009 authorization
 * Body: { prompt: string, model?: string }
 */
router.post('/v1/ai/inference', requireX402Payment, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt, model = DEFAULT_MODEL } = req.body as { prompt?: string; model?: string };

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      res.status(400).json({ success: false, error: { message: 'prompt is required', code: 'MISSING_PROMPT' } });
      return;
    }

    const payment = req.x402Payment!;
    console.log(`[ai-inference] Processing request from ${payment.from.slice(0, 10)}... model=${model}`);

    // Call LLM
    const llmResult = await callAnthropic(prompt.trim(), model);

    // Record invoice asynchronously (don't block response)
    recordPaymentInvoice(payment, prompt).then(invoiceId => {
      if (invoiceId) console.log(`[ai-inference] Invoice recorded: ${invoiceId}`);
    });

    res.json({
      success: true,
      data: {
        content: llmResult.content,
        model,
        usage: {
          input_tokens: llmResult.inputTokens,
          output_tokens: llmResult.outputTokens,
        },
      },
      payment: {
        verified: true,
        amount: `${Number(payment.value) / 1_000_000} USDC`,
        from: payment.from,
        to: payment.to,
        network: 'base-mainnet',
        chainId: 8453,
        method: 'EIP-3009 TransferWithAuthorization',
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
