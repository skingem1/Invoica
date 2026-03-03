import { ChainConfig } from '../../lib/chain-registry';

/**
 * EVM transaction hash type (0x-prefixed hex string)
 */
export type EvmTxHash = `0x${string}`;

/**
 * EVM address type (0x-prefixed 40 hex characters)
 */
export type EvmAddress = `0x${string}`;

/**
 * SettlementMatch represents a matched settlement from an EVM transaction
 * that corresponds to an invoice payment.
 */
export interface SettlementMatch {
  invoiceId: string;
  txHash: EvmTxHash;
  amount: string; // USDC human-readable (e.g., "100.00" for 100 USDC)
  from: EvmAddress; // payer address
  to: EvmAddress; // recipient address
  blockNumber: bigint;
  timestamp: number; // unix seconds
  chain: string;
}

/**
 * JSON-RPC response for eth_getTransactionReceipt
 */
export interface EvmTransactionReceipt {
  transactionHash: EvmTxHash;
  blockNumber: string; // hex string
  blockHash: EvmTxHash;
  status: string; // "0x1" for success
  logs: EvmLog[];
  from: EvmAddress;
  to: EvmAddress | null;
  cumulativeGasUsed: string; // hex
  gasUsed: string; // hex
}

/**
 * EVM log entry from transaction receipt
 */
export interface EvmLog {
  address: EvmAddress;
  topics: string[]; // hex strings
  data: string; // hex
  logIndex: string; // hex
  blockNumber: string; // hex
  transactionIndex: string; // hex
  transactionHash: EvmTxHash;
}

/**
 * ERC-20 Transfer event log structure
 */
export interface EvmErc20TransferLog {
  from: EvmAddress;
  to: EvmAddress;
  value: string; // raw value (uint256 as hex string)
  token: EvmAddress; // contract address
}

/**
 * Configuration for EVM settlement detection
 */
export interface EvmSettlementDetectorConfig {
  chainConfig: ChainConfig;
  usdcAddress: EvmAddress;
  settlementAddresses: EvmAddress[]; // addresses that receive settlements
  confirmationBlocks: number; // blocks to wait for confirmation
  pollIntervalMs: number;
}

/**
 * Event data for settled invoices
 */
export interface InvoiceSettledEvent {
  invoiceId: string;
  txHash: EvmTxHash;
  amount: string;
  chain: string;
  timestamp: number;
}

/**
 * Options for transaction scanning
 */
export interface ScanTransactionsOptions {
  fromBlock: bigint;
  toBlock: bigint;
  addresses: EvmAddress[];
}

/**
 * Result of transaction scanning
 */
export interface ScanTransactionsResult {
  transactions: EvmTransactionReceipt[];
  matchedSettlements: SettlementMatch[];
  nextBlock: bigint;
}

/**
 * IEvmSettlementDetector defines the interface for EVM settlement detection
 */
export interface IEvmSettlementDetector {
  /**
   * Check if a transaction matches a settlement
   */
  checkTransaction(txHash: EvmTxHash): Promise<SettlementMatch | null>;

  /**
   * Scan for settlements in a block range
   */
  scanTransactions(options: ScanTransactionsOptions): Promise<ScanTransactionsResult>;

  /**
   * Get the latest block number
   */
  getLatestBlockNumber(): Promise<bigint>;

  /**
   * Get the chain configuration
   */
  getChainConfig(): ChainConfig;
}

/**
 * EvmSettlementDetector class constructor parameters
 */
export interface EvmSettlementDetectorConstructor {
  config: EvmSettlementDetectorConfig;
  providerUrl: string;
}

/**
 * Error types for settlement detection
 */
export class SettlementDetectionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly txHash?: EvmTxHash
  ) {
    super(message);
    this.name = 'SettlementDetectionError';
  }
}

export class InvalidTransactionError extends SettlementDetectionError {
  constructor(txHash: EvmTxHash, reason: string) {
    super(`Invalid transaction ${txHash}: ${reason}`, 'INVALID_TRANSACTION', txHash);
    this.name = 'InvalidTransactionError';
  }
}

export class SettlementNotFoundError extends SettlementDetectionError {
  constructor(txHash: EvmTxHash) {
    super(`Settlement not found for transaction ${txHash}`, 'SETTLEMENT_NOT_FOUND', txHash);
    this.name = 'SettlementNotFoundError';
  }
}