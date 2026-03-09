/**
 * Invoica MCP Server
 * Exposes Invoica as a Model Context Protocol tool provider.
 * Compatible with Claude Desktop, Cursor, Windsurf, and any MCP client.
 *
 * Usage: npx -y invoica-mcp
 * Env:   INVOICA_API_URL (default: https://api.invoica.ai)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

const API_URL = process.env.INVOICA_API_URL ?? 'https://api.invoica.ai';

// ── Tool definitions ────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: 'create_invoice',
    description: 'Create a new invoice via Invoica. Returns a payment URL the payer can use to settle on-chain.',
    inputSchema: {
      type: 'object',
      properties: {
        amount:        { type: 'number',  description: 'Invoice amount (e.g. 10.00)' },
        currency:      { type: 'string',  description: 'ISO currency code (e.g. USDC, USD)' },
        customerEmail: { type: 'string',  description: 'Customer email address' },
        customerName:  { type: 'string',  description: 'Customer display name' },
        apiKey:        { type: 'string',  description: 'Your Invoica API key' },
      },
      required: ['amount', 'currency', 'customerEmail', 'customerName', 'apiKey'],
    },
  },
  {
    name: 'list_invoices',
    description: 'List recent invoices for your Invoica account.',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: { type: 'string',  description: 'Your Invoica API key' },
        limit:  { type: 'number',  description: 'Max invoices to return (default 10, max 100)' },
      },
      required: ['apiKey'],
    },
  },
  {
    name: 'check_settlement',
    description: 'Check whether an invoice has been settled on-chain. Returns txHash and chain if settled.',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string', description: 'Invoice UUID' },
        apiKey:    { type: 'string', description: 'Your Invoica API key' },
      },
      required: ['invoiceId', 'apiKey'],
    },
  },
];

// ── API helpers ──────────────────────────────────────────────────────────────

async function invoicaFetch(
  path: string,
  apiKey: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; data: unknown; status: number }> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
    const data = await res.json().catch(() => ({ error: 'Non-JSON response' }));
    return { ok: res.ok, data, status: res.status };
  } catch (err) {
    return { ok: false, data: { error: String(err) }, status: 0 };
  }
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

// ── Server setup ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'invoica-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const a = args as Record<string, unknown>;

  // ── create_invoice ──────────────────────────────────────────────────────
  if (name === 'create_invoice') {
    const { ok, data, status } = await invoicaFetch('/v1/invoices', String(a.apiKey), {
      method: 'POST',
      body: JSON.stringify({
        amount:        a.amount,
        currency:      a.currency,
        customerEmail: a.customerEmail,
        customerName:  a.customerName,
      }),
    });
    if (!ok) return textResult(`Error ${status}: ${JSON.stringify(data)}`);
    const inv = data as Record<string, unknown>;
    return textResult(JSON.stringify({
      invoiceId:  inv.id,
      paymentUrl: inv.paymentUrl ?? inv.payment_url,
      amount:     inv.amount,
      status:     inv.status,
    }));
  }

  // ── list_invoices ───────────────────────────────────────────────────────
  if (name === 'list_invoices') {
    const limit = Number(a.limit ?? 10);
    const { ok, data, status } = await invoicaFetch(
      `/v1/invoices?limit=${limit}`,
      String(a.apiKey),
    );
    if (!ok) return textResult(`Error ${status}: ${JSON.stringify(data)}`);
    const list = Array.isArray(data) ? data : (data as Record<string, unknown>).invoices ?? [];
    const summaries = (list as Record<string, unknown>[]).map((inv) => ({
      id:            inv.id,
      invoiceNumber: inv.invoiceNumber ?? inv.invoice_number,
      status:        inv.status,
      amount:        inv.amount,
      currency:      inv.currency,
      customerEmail: inv.customerEmail ?? inv.customer_email,
      createdAt:     inv.createdAt ?? inv.created_at,
    }));
    return textResult(JSON.stringify(summaries));
  }

  // ── check_settlement ────────────────────────────────────────────────────
  if (name === 'check_settlement') {
    const { ok, data, status } = await invoicaFetch(
      `/v1/invoices/${String(a.invoiceId)}`,
      String(a.apiKey),
    );
    if (!ok) return textResult(`Error ${status}: ${JSON.stringify(data)}`);
    const inv = data as Record<string, unknown>;
    const pd  = (inv.paymentDetails ?? inv.payment_details ?? {}) as Record<string, unknown>;
    const settled = inv.status === 'settled' || inv.status === 'paid';
    return textResult(JSON.stringify({
      settled,
      txHash:  settled ? (pd.txHash ?? pd.tx_hash ?? null) : null,
      chain:   settled ? (pd.network ?? pd.chain ?? null) : null,
      amount:  settled ? inv.amount : null,
    }));
  }

  return textResult(`Unknown tool: ${name}`);
});

// ── Start ─────────────────────────────────────────────────────────────────────

(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // MCP runs over stdio — no console output here (would corrupt the protocol)
})();
