/**
 * sap-update-x402endpoint.ts
 *
 * One-shot script: updates Invoica's SAP agent on-chain metadata to register
 * the x402 merchant endpoint (https://api.invoica.ai/api/sap/execute).
 *
 * USAGE (run manually via SSH — do NOT execute automatically):
 *   npx ts-node --transpile-only scripts/sap-update-x402endpoint.ts
 *
 * Prerequisites:
 *   - SAP_KEYPAIR_PATH  (defaults to /home/invoica/memory/sap-agent-keypair.json)
 *   - SOLANA_RPC_URL    (optional — defaults to mainnet-beta public RPC)
 *
 * @sprint SAP-MERCH-003
 */

import { existsSync, readFileSync } from 'fs';
import { Keypair } from '@solana/web3.js';
import { SapConnection } from '@oobe-protocol-labs/synapse-sap-sdk';

// ── Constants ──────────────────────────────────────────────────────────────

/** x402 merchant endpoint to register on-chain */
const X402_ENDPOINT = 'https://api.invoica.ai/api/sap/execute';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

/** SAP agent keypair — authority that signed the original registerAgent tx */
const KEYPAIR_PATH =
  process.env.SAP_KEYPAIR_PATH ||
  '/home/invoica/memory/sap-agent-keypair.json';

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // 1. Load keypair
  if (!existsSync(KEYPAIR_PATH)) {
    throw new Error(
      `Keypair file not found: ${KEYPAIR_PATH}\n` +
      `Set SAP_KEYPAIR_PATH env var or place keypair at the default path.`,
    );
  }
  const raw = JSON.parse(readFileSync(KEYPAIR_PATH, 'utf-8')) as number[];
  if (!Array.isArray(raw)) {
    throw new Error('Keypair file must be a JSON array of bytes');
  }
  const keypair = Keypair.fromSecretKey(Uint8Array.from(raw));

  console.log('[sap-update] authority  :', keypair.publicKey.toBase58());
  console.log('[sap-update] endpoint   :', X402_ENDPOINT);
  console.log('[sap-update] rpc        :', RPC_URL);

  // 2. Build SDK client from keypair
  const { client } = SapConnection.fromKeypair(RPC_URL, keypair);

  // 3. Send updateAgent instruction via SDK (handles Anchor encoding internally)
  console.log('[sap-update] Sending updateAgent transaction...');
  const sig = await client.agent.update({ x402Endpoint: X402_ENDPOINT });

  console.log('[sap-update] ✅ Success');
  console.log('[sap-update] Signature  :', sig);
  console.log('[sap-update] Explorer   : https://solscan.io/tx/' + sig);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('[sap-update] ❌ Error:', msg);
  process.exit(1);
});
