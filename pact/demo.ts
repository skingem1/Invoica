#!/usr/bin/env npx tsx
/**
 * @invoica/pact — Live Demo
 *
 * Run: npx tsx demo.ts
 */
import { issueMandate, encodeMandateHeader, verifyMandate } from './src/index';

const SECRET = 'demo-pact-signing-secret-2026';

// ─── 1. Agent issues a mandate ──────────────────────────────────────────────
console.log('\n\x1b[36m═══ Step 1: Agent Issues a PACT Mandate ═══\x1b[0m\n');

const mandate = issueMandate(
  {
    grantor: 'agent-wallet-7xKp3mNq',
    scope: {
      maxPaymentUsdc: 10,
      actions: ['invoice:create', 'invoice:settle'],
      description: 'Authorise invoice creation up to 10 USDC',
    },
    ttlMs: 60 * 60 * 1000, // 1 hour
  },
  SECRET
);

console.log('Mandate ID:  ', mandate.id);
console.log('Grantor:     ', mandate.grantor);
console.log('Grantee:     ', mandate.grantee);
console.log('Scope:       ', JSON.stringify(mandate.scope));
console.log('Expires:     ', mandate.expiresAt);
console.log('Signature:   ', mandate.signature.slice(0, 32) + '...');

// ─── 2. Encode for HTTP header ──────────────────────────────────────────────
console.log('\n\x1b[36m═══ Step 2: Encode as X-Pact-Mandate Header ═══\x1b[0m\n');

const header = encodeMandateHeader(mandate);
console.log('Header length:', header.length, 'bytes');
console.log('Preview:      ', header.slice(0, 80) + '...');

// ─── 3. Server verifies — within cap ────────────────────────────────────────
console.log('\n\x1b[36m═══ Step 3: Server Verifies (5 USDC — within cap) ═══\x1b[0m\n');

const ok = verifyMandate(header, 5.0, SECRET);
console.log('Result:', ok.allowed ? '\x1b[32mALLOWED\x1b[0m' : `\x1b[31mDENIED: ${ok.reason}\x1b[0m`);

// ─── 4. Server verifies — over cap ─────────────────────────────────────────
console.log('\n\x1b[36m═══ Step 4: Server Verifies (15 USDC — exceeds cap) ═══\x1b[0m\n');

const overCap = verifyMandate(header, 15.0, SECRET);
console.log('Result:', overCap.allowed ? '\x1b[32mALLOWED\x1b[0m' : `\x1b[31mDENIED: ${overCap.reason}\x1b[0m`);

// ─── 5. Tampered mandate — signature fails ──────────────────────────────────
console.log('\n\x1b[36m═══ Step 5: Tampered Mandate (wrong secret) ═══\x1b[0m\n');

const tampered = verifyMandate(header, 5.0, 'wrong-secret');
console.log('Result:', tampered.allowed ? '\x1b[32mALLOWED\x1b[0m' : `\x1b[31mDENIED: ${tampered.reason}\x1b[0m`);

// ─── 6. Expired mandate ─────────────────────────────────────────────────────
console.log('\n\x1b[36m═══ Step 6: Expired Mandate ═══\x1b[0m\n');

const expiredMandate = issueMandate(
  {
    grantor: 'agent-wallet-expired',
    scope: { maxPaymentUsdc: 10 },
    ttlMs: -1000, // already expired
  },
  SECRET
);
const expiredHeader = encodeMandateHeader(expiredMandate);
const expired = verifyMandate(expiredHeader, 5.0, SECRET);
console.log('Result:', expired.allowed ? '\x1b[32mALLOWED\x1b[0m' : `\x1b[31mDENIED: ${expired.reason}\x1b[0m`);

// ─── 7. Live Invoica API health check ───────────────────────────────────────
console.log('\n\x1b[36m═══ Step 7: Invoica API (Live) ═══\x1b[0m\n');

try {
  const res = await fetch('https://api.invoica.ai/v1/health');
  const data = await res.json();
  console.log('Status:', res.status === 200 ? '\x1b[32mONLINE\x1b[0m' : '\x1b[31mDOWN\x1b[0m');
  console.log('Response:', JSON.stringify(data));
} catch (e: any) {
  console.log('\x1b[33mAPI unreachable:', e.message, '\x1b[0m');
}

console.log('\n\x1b[36m═══ Demo Complete ═══\x1b[0m');
console.log('Package: https://www.npmjs.com/package/@invoica/pact\n');
