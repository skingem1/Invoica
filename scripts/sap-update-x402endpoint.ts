/**
 * sap-update-x402endpoint.ts
 *
 * One-shot script: updates Invoica's SAP agent on-chain metadata to register
 * the x402 merchant endpoint (https://api.invoica.ai/api/sap/execute).
 *
 * USAGE (run manually via SSH — do NOT execute automatically):
 *   npx ts-node scripts/sap-update-x402endpoint.ts
 *   SAP_KEYPAIR_PATH=/path/to/keypair.json npx ts-node scripts/sap-update-x402endpoint.ts
 *
 * Prerequisites:
 *   - SAP_KEYPAIR_PATH  (or x402-test/seller-keypair.json at project root)
 *   - SOLANA_RPC_URL    (optional — defaults to mainnet-beta public RPC)
 *
 * @sprint SAP-MERCH-003
 */

import crypto from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';

// ── Constants ──────────────────────────────────────────────────────────────

/** SAP Synapse Agent Protocol program on Solana mainnet */
const SAP_PROGRAM_ID = new PublicKey('SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ');

/** Invoica's registered SAP agent PDA */
const INVOICA_AGENT_PDA = new PublicKey('F7ZgQpK1yXahRrHav5DFfaibuMEcNHn8KVBHWWsKop7P');

/** x402 merchant endpoint to register on-chain */
const X402_ENDPOINT = 'https://api.invoica.ai/api/sap/execute';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// Keypair: prefer env var, fall back to project-root seller keypair
const KEYPAIR_PATH =
  process.env.SAP_KEYPAIR_PATH ||
  resolve(__dirname, '../x402-test/seller-keypair.json');

// ── Encoding helpers ───────────────────────────────────────────────────────

/**
 * Computes an Anchor-style 8-byte instruction discriminator.
 * Pattern: sha256('global:<instructionName>').slice(0, 8)
 * Matches the same pattern used in sap-escrow-bridge.ts for settle_call.
 */
function ixDiscriminator(instructionName: string): Buffer {
  return crypto
    .createHash('sha256')
    .update(`global:${instructionName}`)
    .digest()
    .slice(0, 8);
}

/**
 * Borsh-encodes a UTF-8 string: u32 little-endian length prefix + raw bytes.
 */
function borshString(s: string): Buffer {
  const strBytes = Buffer.from(s, 'utf-8');
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32LE(strBytes.length, 0);
  return Buffer.concat([lenBuf, strBytes]);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // 1. Load and validate keypair
  if (!existsSync(KEYPAIR_PATH)) {
    throw new Error(
      `Keypair file not found: ${KEYPAIR_PATH}\n` +
      `Set SAP_KEYPAIR_PATH env var or place keypair at x402-test/seller-keypair.json`,
    );
  }
  const raw = JSON.parse(readFileSync(KEYPAIR_PATH, 'utf-8')) as number[];
  if (!Array.isArray(raw)) {
    throw new Error('Keypair file must be a JSON array of bytes');
  }
  const signer = Keypair.fromSecretKey(Uint8Array.from(raw));

  console.log('[sap-update] authority  :', signer.publicKey.toBase58());
  console.log('[sap-update] agentPda   :', INVOICA_AGENT_PDA.toBase58());
  console.log('[sap-update] endpoint   :', X402_ENDPOINT);
  console.log('[sap-update] rpc        :', RPC_URL);

  // 2. Build instruction data:
  //    [ discriminator(update_agent) | borsh_string(x402Endpoint) ]
  const instructionData = Buffer.concat([
    ixDiscriminator('update_agent'),
    borshString(X402_ENDPOINT),
  ]);

  // 3. Build instruction — accounts: [agentPda (writable), authority (signer)]
  const ix = new TransactionInstruction({
    programId: SAP_PROGRAM_ID,
    keys: [
      { pubkey: INVOICA_AGENT_PDA, isSigner: false, isWritable: true },
      { pubkey: signer.publicKey,  isSigner: true,  isWritable: false },
    ],
    data: instructionData,
  });

  // 4. Send and confirm
  const connection = new Connection(RPC_URL, 'confirmed');
  const tx = new Transaction().add(ix);

  console.log('[sap-update] Sending transaction...');
  const sig = await sendAndConfirmTransaction(connection, tx, [signer], {
    commitment: 'confirmed',
  });

  console.log('[sap-update] ✅ Success');
  console.log('[sap-update] Signature  :', sig);
  console.log('[sap-update] Explorer   : https://solscan.io/tx/' + sig);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('[sap-update] ❌ Error:', msg);
  process.exit(1);
});
