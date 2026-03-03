/**
 * EVM Settlement Detection Types
 * 
 * Type definitions for the EVM settlement detector service.
 * These types define the data structures used for detecting and matching
 * settlements to invoices on EVM-compatible blockchains.
 */

import type { Address, Hash } from 'viem';

/**
 * Represents a matched settlement from on-chain activity
 * that corresponds to an invoice in our system
 */
export interface SettlementMatch {
  /** Unique identifier of the invoice this settlement is for */
  invoiceId: string;
  /** Hash of the transaction that settled the invoice */
  txHash: Hash;
  /** Amount in the smallest unit (wei for ETH, etc.) */
  amount: bigint;
  /** Address that sent the payment */
  from: Address;
  /** Address that received the payment */
  to: Address;
  /** Block number where the transaction was included */
  blockNumber: bigint;
  /** Timestamp when the block was mined */
  timestamp: Date;
  /** EVM chain identifier */
  chain: string;
}

/**
 * Configuration for the EVM settlement detector
 */
export interface EvmSettlementDetectorConfig {
  /** Chain ID for the EVM network (e.g., 1 for Ethereum mainnet) */
  chainId: number;
  /** RPC endpoint URL */
  rpcUrl: string;
  /** Address of the payment receiver (merchant) */
  receiverAddress: Address;
  /** Starting block number to scan from */
  startBlock: bigint;
  /** Number of blocks to scan in each batch */
  batchSize: number;
  /** Confirmation blocks required before processing */
  confirmationBlocks: number;
}

/**
 * Represents a transfer event from the blockchain
 */
export interface TransferEvent {
  /** Transaction hash */
  txHash: Hash;
  /** Block number where the event was emitted */
  blockNumber: bigint;
  /** Address that triggered the transfer */
  from: Address;
  /** Address that received the transfer */
  to: Address;
  /** Amount transferred */
  amount: bigint;
  /** Log index in the block */
  logIndex: number;
  /** Timestamp of the block */
  timestamp: Date;
}

/**
 * Options for scanning blocks for settlements
 */
export interface ScanOptions {
  /** Starting block number (inclusive) */
  fromBlock: bigint;
  /** Ending block number (inclusive) */
  toBlock: bigint;
  /** Filter by specific receiver address */
  receiverAddress?: Address;
  /** Filter by specific sender address */
  senderAddress?: Address;
  /** Batch size for scanning */
  batchSize?: number;
}

/**
 * Result of a settlement scan operation
 */
export interface ScanResult {
  /** List of transfer events found */
  transfers: TransferEvent[];
  /** Last block that was scanned */
  lastScannedBlock: bigint;
  /** Whether there are more blocks to scan */
  hasMore: boolean;
}

/**
 * Status of a settlement detection operation
 */
export enum SettlementStatus {
  /** Settlement detected but not yet confirmed */
  Pending = 'pending',
  /** Settlement has enough confirmations */
  Confirmed = 'confirmed',
  /** Settlement has been matched to an invoice */
  Matched = 'matched',
  /** Settlement has been processed */
  Processed = 'processed',
  /** Settlement failed verification */
  Failed = 'failed',
}

/**
 * Filter parameters for finding settlements
 */
export interface SettlementFilter {
  /** Filter by invoice ID */
  invoiceId?: string;
  /** Filter by transaction hash */
  txHash?: Hash;
  /** Filter by chain */
  chain?: string;
  /** Filter by status */
  status?: SettlementStatus;
  /** Filter by date range - start */
  dateFrom?: Date;
  /** Filter by date range - end */
  dateTo?: Date;
}