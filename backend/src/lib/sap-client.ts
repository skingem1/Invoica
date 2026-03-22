import { readFileSync } from 'fs';
import { resolve } from 'path';

export interface SapConfig {
  rpcUrl: string;
  programId: string;
  agentPda: string | null;
  keypairPath: string;
  network: string;
}

export interface SapClient {
  config: SapConfig;
  keypairBytes: Uint8Array | null;
}

let _instance: SapClient | null = null;

export function getSapClient(): SapClient {
  if (_instance) return _instance;
  _instance = {
    config: {
      rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      programId: process.env.SAP_PROGRAM_ID || '',
      agentPda: process.env.SAP_AGENT_PDA || null,
      keypairPath: process.env.SAP_KEYPAIR_PATH || resolve(__dirname, '../../../x402-test/wallets/seller-keypair.json'),
      network: process.env.SAP_NETWORK || 'mainnet',
    },
    keypairBytes: null,
  };
  return _instance;
}

export function getKeypairBytes(client: SapClient): Uint8Array {
  if (client.keypairBytes) return client.keypairBytes;
  const raw = JSON.parse(readFileSync(client.config.keypairPath, 'utf-8'));
  if (!Array.isArray(raw)) throw new Error('SAP keypair file must be a JSON array of bytes');
  client.keypairBytes = Uint8Array.from(raw as number[]);
  return client.keypairBytes;
}

export function resetSapClient(): void {
  _instance = null;
}
