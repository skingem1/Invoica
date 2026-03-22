import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import axios from 'axios';

// SAP Agent Registration Script
// Validates keypair, checks balance, registers agent with Synapse Agent Protocol
// NOTE: Requires SAP_PROGRAM_ID and SAP_KEYPAIR_PATH in .env
// Once @oobe-protocol-labs/synapse-sap-sdk is installed, replace REST stub with SDK call

async function main() {
  const keypairPath = process.env.SAP_KEYPAIR_PATH || resolve(__dirname, '../../x402-test/wallets/seller-keypair.json');
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const programId = process.env.SAP_PROGRAM_ID || '';
  const network = process.env.SAP_NETWORK || 'mainnet';

  console.log('=== SAP Agent Registration ===');
  console.log(`Network:    ${network}`);
  console.log(`RPC:        ${rpcUrl}`);
  console.log(`Program ID: ${programId || '(not set — set SAP_PROGRAM_ID in .env)'}`);

  // 1. Validate keypair file
  if (!existsSync(keypairPath)) {
    console.error(`ERROR: Keypair not found at ${keypairPath}`);
    console.error('Set SAP_KEYPAIR_PATH in .env or place keypair at default path');
    process.exit(1);
  }

  let keypairBytes: number[];
  try {
    keypairBytes = JSON.parse(readFileSync(keypairPath, 'utf-8'));
    if (!Array.isArray(keypairBytes) || keypairBytes.length !== 64) {
      throw new Error('Keypair must be a 64-byte JSON array');
    }
    console.log('Keypair:    valid (64 bytes)');
  } catch (err) {
    console.error('ERROR: Invalid keypair file:', err);
    process.exit(1);
  }

  // 2. Derive public key (first 32 bytes of secret = seed, last 32 = pubkey)
  const pubkeyBytes = keypairBytes.slice(32);
  const pubkeyHex = Buffer.from(pubkeyBytes).toString('hex');
  console.log(`Public key: ${pubkeyHex}`);

  // 3. Check SOL balance via JSON-RPC
  try {
    const balRes = await axios.post(rpcUrl, {
      jsonrpc: '2.0', id: 1, method: 'getBalance',
      params: [Buffer.from(pubkeyBytes).toString('base64')],
    }, { headers: { 'Content-Type': 'application/json' } });
    const lamports = balRes.data?.result?.value ?? 0;
    console.log(`SOL balance: ${lamports / 1e9} SOL (${lamports} lamports)`);
    if (lamports < 5000) {
      console.warn('WARNING: Low balance — may not cover transaction fees');
    }
  } catch (err) {
    console.warn('WARNING: Could not fetch balance:', err);
  }

  // 4. Register with SAP
  // TODO: Replace with SDK call once @oobe-protocol-labs/synapse-sap-sdk is installed:
  //   import { SynapseClient } from '@oobe-protocol-labs/synapse-sap-sdk';
  //   const client = new SynapseClient({ rpcUrl, programId });
  //   const result = await client.registerAgent({ keypair, metadata: { name: 'invoica-agent' } });
  //   console.log('SAP_AGENT_PDA=' + result.agentPda);
  if (!programId) {
    console.warn('SAP_PROGRAM_ID not set — skipping on-chain registration (stub mode)');
    console.log('\nNext steps:');
    console.log('1. Install SDK: pnpm add @oobe-protocol-labs/synapse-sap-sdk @coral-xyz/anchor @solana/web3.js');
    console.log('2. Set SAP_PROGRAM_ID in .env');
    console.log('3. Re-run this script');
  } else {
    console.log('Registration stub — SDK integration pending');
    console.log('SAP_AGENT_PDA=(pending SDK install)');
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
