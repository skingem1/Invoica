# @invoica/pact

PACT v0.2 mandate library for Invoica AI agent payments.

Issue and verify signed mandates that authorise AI agents to make x402 payments through Invoica.

## Install

```bash
npm install @invoica/pact
```

Requires Node.js >= 18. Zero runtime dependencies (uses built-in `crypto`).

## Quick Start

### Issue a mandate (client-side)

```typescript
import { issueMandate, encodeMandateHeader } from '@invoica/pact';

const mandate = issueMandate(
  {
    grantor: 'agent-wallet-abc',
    scope: {
      maxPaymentUsdc: 10,
      actions: ['invoice:create', 'invoice:settle'],
    },
  },
  process.env.PACT_SIGNING_SECRET!
);

const response = await fetch('https://api.invoica.ai/v1/invoices', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Pact-Mandate': encodeMandateHeader(mandate),
  },
  body: JSON.stringify({ amount: 5, currency: 'USDC' }),
});
```

### Verify a mandate (server-side)

```typescript
import { verifyMandate } from '@invoica/pact';

const header = req.headers['x-pact-mandate'] as string;
const result = verifyMandate(header, requestedAmount, process.env.PACT_SIGNING_SECRET!);

if (!result.allowed) {
  return res.status(403).json({ error: result.reason });
}
```

## API

### `issueMandate(options, secret)`

Create a signed PACT mandate.

| Parameter | Type | Description |
|---|---|---|
| `options.grantor` | `string` | Wallet address or agent ID of the entity granting the mandate |
| `options.grantee` | `string?` | Recipient (defaults to `'invoica'`) |
| `options.scope` | `MandateScope` | Actions, resources, and spend limits |
| `options.ttlMs` | `number?` | Time-to-live in ms (defaults to 1 hour) |
| `secret` | `string` | Shared HMAC-SHA256 signing secret |

Returns a `PactMandate` with a cryptographic signature.

### `verifyMandate(header, amountUsdc, secret)`

Verify an `X-Pact-Mandate` header value.

Returns `{ allowed: true }` or `{ allowed: false, reason: string }`.

Checks: JSON validity, expiry, HMAC signature, spend cap vs requested amount.

### `encodeMandateHeader(mandate)`

Serialise a `PactMandate` to a JSON string for use as an HTTP header value.

## Types

```typescript
interface MandateScope {
  actions?: string[];       // e.g. ['invoice:create']
  resources?: string[];     // e.g. ['*'] or specific invoice IDs
  maxPaymentUsdc?: number;  // spend cap for this mandate
  description?: string;     // human-readable description
}

interface PactMandate {
  id: string;
  grantor: string;
  grantee: string;
  scope: MandateScope;
  expiresAt?: string;   // ISO 8601
  issuedAt: string;     // ISO 8601
  signature: string;    // HMAC-SHA256
}
```

## How It Works

1. Agent issues a mandate with `issueMandate()` — signs it with a shared secret
2. Mandate is attached as `X-Pact-Mandate` header on x402 payment requests
3. Invoica server verifies the signature, expiry, and spend cap with `verifyMandate()`
4. If valid, the payment proceeds; if not, the request is rejected with a reason

## License

MIT
