/**
 * Central type definitions for the backend application
 * @packageDocumentation
 */

/**
 * Configuration for a supported blockchain network
 */
export interface ChainConfig {
  /** Chain ID — numeric for EVM chains (e.g., 8453 for Base), string for non-EVM (e.g., 'solana') */
  id: number | string;
  /** Human-readable chain name */
  name: string;
  /** RPC endpoint URL for chain communication */
  rpcUrl: string;
  /** USDC token contract address on this chain */
  usdcAddress: string;
  /** Block explorer base URL */
  explorerUrl: string;
  /** Whether this is a testnet */
  isTestnet: boolean;
}
