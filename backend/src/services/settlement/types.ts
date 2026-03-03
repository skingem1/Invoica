/**
 * EVM Settlement Detection Types
 * 
 * Type definitions for settlement matching between blockchain transactions
 * and pending invoices in the Countable payment system.
 */

import { ChainConfig } from '../../lib/chain-registry';

/**
 * Represents a matched settlement between a blockchain transaction
 * and a pending invoice.
 */
export interface SettlementMatch {
  /** Unique identifier of the matched invoice */
  invoiceId: string;
  /** Ethereum transaction hash of the settlement */
  txHash: string;
  /** Amount in wei (smallest denomination) */
  amount: string;
  /** Sender address (EOA or contract) */
  from: string;
  /** Recipient address (typically the merchant treasury) */
  to: string;
  /** Block number where transaction was included */
  blockNumber: number;
  /** Unix timestamp of the block (seconds) */
  timestamp: number;
  /** Chain identifier (e.g., 'ethereum', 'polygon', 'arbitrum') */
  chain: string;
}

/**
 * Raw transaction data fetched from blockchain explorer or node
 */
export interface RawTransaction {
  hash: string;
  blockNumber: number;
  blockTimestamp: number;
  from: string;
  to: string;
  value: string;
  input: string;
  status: 'success' | 'failure' | 'pending';
}

/**
 * Filter criteria for settlement detection polling
 */
export interface SettlementFilter {
  /** Chain configuration for the network to monitor */
  chainConfig: ChainConfig;
  /** Minimum block number to start scanning from */
  fromBlock: number;
  /** Maximum block number to scan (typically latest block) */
  toBlock: number;
  /** List of recipient addresses to match against */
  recipientAddresses: string[];
  /** Minimum value in wei to consider (filters dust) */
  minValue?: string;
}

/**
 * Result of a settlement detection scan
 */
export interface SettlementScanResult {
  /** Whether the scan completed successfully */
  success: boolean;
  /** Number of potential matches found */
  matchCount: number;
  /** Array of matched settlements */
  matches: SettlementMatch[];
  /** Last block that was scanned */
  lastScannedBlock: number;
  /** Error message if scan failed */
  error?: string;
}

/**
 * State for tracking settlement detection progress
 */
export interface SettlementDetectorState {
  /** Current chain being monitored */
  chain: string;
  /** Last block successfully processed */
  lastProcessedBlock: number;
  /** Number of pending invoices being monitored */
  pendingInvoiceCount: number;
  /** Last scan timestamp (ISO string) */
  lastScanAt: string;
}

/**
 * Configuration for the settlement detector service
 */
export interface SettlementDetectorConfig {
  /** Polling interval in milliseconds */
  pollIntervalMs: number;
  /** Number of blocks to look back on startup */
  initialBacktrackBlocks: number;
  /** Minimum confirmations required before processing */
  minConfirmations: number;
  /** Maximum transactions to process per batch */
  batchSize: number;
  /** Supported chains configuration */
  chains: ChainConfig[];
}