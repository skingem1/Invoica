# Invoica Agent Quickstart

Invoica is the financial OS for AI agents — invoice, pay, and settle on-chain in minutes. Built on the x402 protocol with live settlements on Base.

## Prerequisites

- An **x402-compatible wallet** (EVM address for Base mainnet)
- An **Invoica API key** — free at [invoica.ai](https://invoica.ai) during beta

## Install

```bash
npm install @invoica/sdk
```

## Create Your First Invoice

```typescript
import { InvoicaClient } from '@invoica/sdk';

const client = new InvoicaClient({ apiKey: process.env.INVOICA_API_KEY });

const invoice = await client.invoices.create({
  amount: 10.00,
  currency: 'USD',
  customerEmail: 'agent@example.com',
  customerName: 'My AI Agent',
});

console.log('Pay at:', invoice.paymentUrl);
// → https://pay.invoica.ai/inv_abc123
```

## On-Chain Settlement

When a payment is made, Invoica detects the on-chain transaction on Base and marks the invoice as settled. No manual reconciliation needed — settlement is verified by indexing the blockchain, not relying on off-chain callbacks.

```typescript
const status = await client.invoices.get(invoice.invoiceId);
console.log(status.settled);  // true
console.log(status.txHash);   // 0xabc...
```

## Supported Chains

| Chain   | Status  |
|---------|---------|
| Base    | ✅ Live  |
| Polygon | 🔜 Coming soon |

## Using with an AI Agent (Claude / GPT)

The Invoica SDK is designed for agent-native use — no human in the loop required. Agents can create invoices, poll for settlement, and trigger downstream logic autonomously.

```typescript
// Fire-and-forget pattern for agent workflows
const { invoiceId, paymentUrl } = await client.invoices.create({ ... });
await notifyCounterparty(paymentUrl);

// Poll until settled (or timeout)
for (let i = 0; i < 12; i++) {
  const { settled } = await client.invoices.get(invoiceId);
  if (settled) break;
  await new Promise(r => setTimeout(r, 5000));
}
```

## MCP Integration (Claude / Cursor / Windsurf)

Install the Invoica MCP server to create invoices and check settlements directly from your AI assistant:

```bash
npx -y @invoica/mcp
```

See [backend/src/mcp/README.md](../backend/src/mcp/README.md) for full config.

## Support

- Docs: [invoica.ai/docs](https://invoica.ai/docs)
- Issues: [invoica.ai/support](https://invoica.ai/support)
- Email: support@invoica.ai
