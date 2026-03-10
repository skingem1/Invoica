/**
 * clawrouter-client.ts — Local ClawRouter gateway client
 *
 * ClawRouter is a LOCAL proxy (port 18789) that handles all x402 payments
 * from its own auto-generated wallet. Our backend just sends a standard
 * OpenAI-compatible request — no EIP-3009 signing needed on our side.
 *
 * Wallet: 0x67521a36Cc04b8D91c57cDdc587A7EBAC200062F (funded with 50 USDC)
 * Flow:   POST /v1/chat/completions → gateway pays upstream → 200 response
 */

import http from 'http';
import https from 'https';

// ── Config ───────────────────────────────────────────────────────────────────

const CLAWROUTER_URL = process.env.CLAWROUTER_GATEWAY_URL || 'http://localhost:18789/v1';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ClawRouterOptions {
  model: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  think?: boolean;
}

export interface ClawRouterResult {
  content: string;
  model: string;
  costUsdc: number;
  backend: string;
  inputTokens: number;
  outputTokens: number;
}

// ── Cost Log ─────────────────────────────────────────────────────────────────

interface CostEntry {
  timestamp: string;
  model: string;
  costUsdc: number;
  inputTokens: number;
  outputTokens: number;
}

const costLog: CostEntry[] = [];
const MAX_COST_LOG = 1000;

export function getCostLog(): readonly CostEntry[] {
  return costLog;
}

// ── HTTP Helper ───────────────────────────────────────────────────────────────

function httpRequest(
  url: string,
  body: string,
  extraHeaders: Record<string, string> = {}
): Promise<{ status: number; data: string; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...extraHeaders,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode || 0, data, headers: res.headers as Record<string, string | string[] | undefined> })
        );
      }
    );

    req.on('error', reject);
    req.setTimeout(300_000, () => {
      req.destroy();
      reject(new Error('ClawRouter request timeout (300s)'));
    });
    req.write(body);
    req.end();
  });
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Call an LLM model through the local ClawRouter gateway.
 * The gateway handles all x402 payments transparently.
 */
export async function callClawRouter(opts: ClawRouterOptions): Promise<ClawRouterResult> {
  const { model, prompt, systemPrompt, maxTokens = 4096 } = opts;
  const chatUrl = `${CLAWROUTER_URL}/chat/completions`;

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const requestBody = JSON.stringify({ model, messages, max_tokens: maxTokens });

  const response = await httpRequest(chatUrl, requestBody);

  if (response.status !== 200) {
    throw new Error(
      `ClawRouter returned ${response.status}: ${response.data.slice(0, 300)}`
    );
  }

  const json = JSON.parse(response.data);

  // Extract cost from response if gateway reports it (X-Payment-Amount header or usage)
  const costHeader = response.headers['x-payment-amount'] as string | undefined;
  const costUsdc = costHeader
    ? Number(costHeader) / 1_000_000
    : 0;

  const result = parseOpenAIResponse(json, model, costUsdc);

  // Log cost for CFO monitoring
  costLog.push({
    timestamp: new Date().toISOString(),
    model,
    costUsdc: result.costUsdc,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });
  if (costLog.length > MAX_COST_LOG) costLog.shift();

  return result;
}

function parseOpenAIResponse(
  json: any,
  requestedModel: string,
  costUsdc: number
): ClawRouterResult {
  const choice = json.choices?.[0];
  return {
    content: choice?.message?.content || '',
    model: json.model || requestedModel,
    costUsdc,
    backend: 'clawrouter',
    inputTokens: json.usage?.prompt_tokens || 0,
    outputTokens: json.usage?.completion_tokens || 0,
  };
}
