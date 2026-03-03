/**
 * EVM Settlement Detector
 * 
 * Detects USDC transfers on EVM chains to identify settlements.
 * Uses JSON-RPC calls with fetch() - no external EVM libraries.
 */

import { ChainConfig } from './types.js';

// Type definitions for JSON-RPC responses
interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params: unknown[];
  id: number;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface LogEntry {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
  transactionIndex: string;
}

interface TransferLog {
  from: string;
  to: string;
  amount: bigint;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  tokenAddress: string;
}

// USDC Transfer event signature
const USDC_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/**
 * Custom error class for EVM detector errors
 */
export class EvmDetectorError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'EvmDetectorError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * EvmSettlementDetector
 * 
 * Detects USDC token transfers on EVM chains to identify settlements.
 * Uses JSON-RPC eth_getLogs for scanning and eth_blockNumber for current block.
 */
export class EvmSettlementDetector {
  private readonly rpcUrl: string;
  private readonly chainId: number;
  private readonly tokenAddress: string;
  private readonly requestId: number;
  private readonly logger?: (message: string, meta?: Record<string, unknown>) => void;

  /**
   * Creates a new EvmSettlementDetector instance
   * @param config - Chain configuration containing RPC URL, chain ID, and token address
   */
  constructor(config: ChainConfig) {
    this.rpcUrl = config.rpcUrl;
    this.chainId = config.chainId;
    this.tokenAddress = config.tokenAddress.toLowerCase();
    this.requestId = Math.floor(Math.random() * 100000);
    this.logger = config.logger;

    this.log('info', 'EvmSettlementDetector initialized', {
      chainId: this.chainId,
      tokenAddress: this.tokenAddress,
      rpcUrl: this.rpcUrl,
    });
  }

  /**
   * Internal logging helper
   */
  private log(level: 'info' | 'error' | 'warn' | 'debug', message: string, meta?: Record<string, unknown>): void {
    if (this.logger) {
      this.logger(message, { ...meta, service: 'EvmSettlementDetector', chainId: this.chainId });
    }
  }

  /**
   * Makes a JSON-RPC request to the EVM node
   * @param method - The RPC method name
   * @param params - The method parameters
   * @returns The result from the RPC call
   * @throws EvmDetectorError if the RPC call fails
   */
  private async rpc<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.requestId++,
    };

    this.log('debug', `JSON-RPC request: ${method}`, { params });

    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new EvmDetectorError(
        `HTTP error calling ${method}: ${response.status} ${response.statusText}`,
        'RPC_HTTP_ERROR',
        response.status,
        { method, status: response.status }
      );
    }

    const rpcResponse: JsonRpcResponse<T> = await response.json();

    if (rpcResponse.error) {
      throw new EvmDetectorError(
        `RPC error calling ${method}: ${rpcResponse.error.message}`,
        'RPC_ERROR',
        500,
        { method, rpcError: rpcResponse.error }
      );
    }

    if (rpcResponse.result === undefined) {
      throw new EvmDetectorError(
        `Missing result in RPC response for ${method}`,
        'RPC_MISSING_RESULT',
        500,
        { method }
      );
    }

    this.log('debug', `JSON-RPC response: ${method}`, { result: rpcResponse.result });

    return rpcResponse.result;
  }

  /**
   * Gets the latest block number from the chain
   * @returns The current latest block number
   * @throws EvmDetectorError if the call fails
   */
  async getLatestBlock(): Promise<number> {
    try {
      const blockNumberHex = await rpc<string>('eth_blockNumber', []);
      const blockNumber = parseInt(blockNumberHex, 16);
      
      this.log('debug', `Latest block: ${blockNumber}`);
      return blockNumber;
    } catch (error) {
      if (error instanceof EvmDetectorError) throw error;
      throw new EvmDetectorError(
        `Failed to get latest block: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_LATEST_BLOCK_ERROR',
        500,
        { error }
      );
    }
  }

  /**
   * Decodes a USDC Transfer log entry
   * @param log - The log entry from eth_getLogs
   * @returns Decoded transfer data
   * @throws EvmDetectorError if decoding fails
   */
  private decodeTransferLog(log: LogEntry): TransferLog {
    // Validate we have the Transfer event topic
    if (!log.topics[0] || log.topics[0].toLowerCase() !== USDC_TRANSFER_TOPIC) {
      throw new EvmDetectorError(
        'Invalid log: not a USDC Transfer event',
        'INVALID_LOG_TOPIC',
        400,
        { topic: log.topics[0] }
      );
    }

    // Validate we have all required topics
    if (!log.topics[1] || !log.topics[2]) {
      throw new EvmDetectorError(
        'Invalid log: missing from/to topics',
        'INVALID_LOG_TOPICS',
        400,
        { topics: log.topics }
      );
    }

    // Decode from address (topic[1] - last 20 bytes / 40 hex chars)
    const fromTopic = log.topics[1];
    const from = '0x' + fromTopic.slice(-40);

    // Decode to address (topic[2] - last 20 bytes / 40 hex chars)
    const toTopic = log.topics[2];
    const to = '0x' + toTopic.slice(-40);

    // Decode amount (data field - 32 bytes / 64 hex chars)
    if (!log.data || log.data.length !== 64) {
      throw new EvmDetectorError(
        'Invalid log: invalid amount data',
        'INVALID_LOG_DATA',
        400,
        { data: log.data }
      );
    }

    // Parse amount as bigint (wei units for USDC - 6 decimals)
    const amount = BigInt('0x' + log.data);

    // Parse block number
    const blockNumber = parseInt(log.blockNumber, 16);

    return {
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      amount,
      blockNumber,
      transactionHash: log.transactionHash,
      logIndex: parseInt(log.logIndex, 16),
      tokenAddress: log.address.toLowerCase(),
    };
  }

  /**
   * Scans for USDC transfers to a specific address within a block range
   * @param toAddress - The recipient address to scan for
   * @param fromBlock - Starting block number (inclusive)
   * @param toBlock - Ending block number (inclusive)
   * @returns Array of TransferLog objects
   * @throws EvmDetectorError if scanning fails
   */
  async scanTransfersToAddress(
    toAddress: string,
    fromBlock: number,
    toBlock: number
  ): Promise<TransferLog[]> {
    if (!toAddress) {
      throw new EvmDetectorError(
        'toAddress is required',
        'INVALID_ADDRESS',
        400
      );
    }

    if (fromBlock < 0 || toBlock < 0) {
      throw new EvmDetectorError(
        'Block numbers must be non-negative',
        'INVALID_BLOCK_NUMBER',
        400,
        { fromBlock, toBlock }
      );
    }

    if (fromBlock > toBlock) {
      throw new EvmDetectorError(
        'fromBlock must be less than or equal to toBlock',
        'INVALID_BLOCK_RANGE',
        400,
        { fromBlock, toBlock }
      );
    }

    const normalizedAddress = toAddress.toLowerCase();
    const fromBlockHex = '0x' + fromBlock.toString(16);
    const toBlockHex = '0x' + toBlock.toString(16);

    this.log('info', 'Scanning for USDC transfers', {
      toAddress: normalizedAddress,
      fromBlock,
      toBlock,
    });

    try {
      // Prepare filter topics: [Transfer Event, null, toAddress]
      // We use null for 'from' to match any sender
      const filter = {
        address: this.tokenAddress,
        fromBlock: fromBlockHex,
        toBlock: toBlockHex,
        topics: [
          USDC_TRANSFER_TOPIC,
          null, // any from address
          normalizedAddress, // specific to address
        ],
      };

      const logs = await this.rpc<LogEntry[]>('eth_getLogs', [filter]);

      this.log('debug', `Found ${logs.length} transfer logs`, {
        toAddress: normalizedAddress,
        fromBlock,
        toBlock,
      });

      const transfers: TransferLog[] = [];

      for (const log of logs) {
        try {
          const transfer = this.decodeTransferLog(log);
          
          // Double-check the 'to' address matches (sanity check)
          if (transfer.to === normalizedAddress) {
            transfers.push(transfer);
          }
        } catch (error) {
          this.log('warn', 'Failed to decode transfer log, skipping', {
            error: error instanceof Error ? error.message : 'Unknown error',
            log,
          });
        }
      }

      // Sort by block number, then by log index
      transfers.sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) {
          return a.blockNumber - b.blockNumber;
        }
        return a.logIndex - b.logIndex;
      });

      this.log('info', `Scanned ${transfers.length} valid transfers`, {
        toAddress: normalizedAddress,
        fromBlock,
        toBlock,
      });

      return transfers;
    } catch (error) {
      if (error instanceof EvmDetectorError) throw error;
      throw new EvmDetectorError(
        `Failed to scan transfers: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SCAN_TRANSFERS_ERROR',
        500,
        { toAddress: normalizedAddress, fromBlock, toBlock, error }
      );
    }
  }

  /**
   * Scans for USDC transfers from a specific address within a block range
   * @param fromAddress - The sender address to scan for
   * @param fromBlock - Starting block number (inclusive)
   * @param toBlock - Ending block number (inclusive)
   * @returns Array of TransferLog objects
   * @throws EvmDetectorError if scanning fails
   */
  async scanTransfersFromAddress(
    fromAddress: string,
    fromBlock: number,
    toBlock: number
  ): Promise<TransferLog[]> {
    if (!fromAddress) {
      throw new EvmDetectorError(
        'fromAddress is required',
        'INVALID_ADDRESS',
        400
      );
    }

    const normalizedAddress = fromAddress.toLowerCase();
    const fromBlockHex = '0x' + fromBlock.toString(16);
    const toBlockHex = '0x' + toBlock.toString(16);

    this.log('info', 'Scanning for USDC transfers from address', {
      fromAddress: normalizedAddress,
      fromBlock,
      toBlock,
    });

    try {
      const filter = {
        address: this.tokenAddress,
        fromBlock: fromBlockHex,
        toBlock: toBlockHex,
        topics: [
          USDC_TRANSFER_TOPIC,
          normalizedAddress, // specific from address
        ],
      };

      const logs = await this.rpc<LogEntry[]>('eth_getLogs', [filter]);

      const transfers: TransferLog[] = [];

      for (const log of logs) {
        try {
          const transfer = this.decodeTransferLog(log);
          
          if (transfer.from === normalizedAddress) {
            transfers.push(transfer);
          }
        } catch (error) {
          this.log('warn', 'Failed to decode transfer log, skipping', {
            error: error instanceof Error ? error.message : 'Unknown error',
            log,
          });
        }
      }

      transfers.sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) {
          return a.blockNumber - b.blockNumber;
        }
        return a.logIndex - b.logIndex;
      });

      return transfers;
    } catch (error) {
      if (error instanceof EvmDetectorError) throw error;
      throw new EvmDetectorError(
        `Failed to scan transfers: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SCAN_TRANSFERS_ERROR',
        500,
        { fromAddress: normalizedAddress, fromBlock, toBlock, error }
      );
    }
  }

  /**
   * Verifies a specific transaction contains a USDC transfer to a given address
   * @param transactionHash - The transaction hash to verify
   * @param expectedToAddress - The expected recipient address
   * @param expectedAmount - The expected minimum amount (in wei)
   * @returns Verified transfer data or null if not found/invalid
   * @throws EvmDetectorError if verification fails
   */
  async verifyTransfer(
    transactionHash: string,
    expectedToAddress?: string,
    expectedAmount?: bigint
  ): Promise<TransferLog | null> {
    if (!transactionHash) {
      throw new EvmDetectorError(
        'transactionHash is required',
        'INVALID_HASH',
        400
      );
    }

    const normalizedToAddress = expectedToAddress?.toLowerCase();

    this.log('info', 'Verifying USDC transfer', {
      transactionHash,
      expectedToAddress: normalizedToAddress,
      expectedAmount: expectedAmount?.toString(),
    });

    try {
      // Get the transaction receipt to get the logs
      const receipt = await this.rpc<{
        status: string;
        blockNumber: string;
        logs: LogEntry[];
      }>('eth_getTransactionReceipt', [transactionHash]);

      if (!receipt) {
        this.log('debug', 'Transaction not found', { transactionHash });
        return null;
      }

      if (receipt.status !== '0x1') {
        this.log('debug', 'Transaction failed', { transactionHash, status: receipt.status });
        return null;
      }

      // Find USDC Transfer logs in the transaction
      const usdcLogs = receipt.logs.filter(
        (log) =>
          log.address.toLowerCase() === this.tokenAddress &&
          log.topics[0]?.toLowerCase() === USDC_TRANSFER_TOPIC
      );

      if (usdcLogs.length === 0) {
        this.log('debug', 'No USDC transfers found in transaction', { transactionHash });
        return null;
      }

      // Decode and validate each USDC transfer
      for (const log of usdcLogs) {
        try {
          const transfer = this.decodeTransferLog(log);

          // Validate recipient if specified
          if (normalizedToAddress && transfer.to !== normalizedToAddress) {
            this.log('debug', 'Transfer to address does not match', {
              transactionHash,
              expected: normalizedToAddress,
              actual: transfer.to,
            });
            continue;
          }

          // Validate amount if specified
          if (expectedAmount !== undefined && transfer.amount < expectedAmount) {
            this.log('debug', 'Transfer amount is less than expected', {
              transactionHash,
              expected: expectedAmount.toString(),
              actual: transfer.amount.toString(),
            });
            continue;
          }

          this.log('info', 'Transfer verified successfully', {
            transactionHash,
            transfer: {
              from: transfer.from,
              to: transfer.to,
              amount: transfer.amount.toString(),
              blockNumber: transfer.blockNumber,
            },
          });

          return transfer;
        } catch (error) {
          this.log('warn', 'Failed to decode log in verifyTransfer', {
            error: error instanceof Error ? error.message : 'Unknown error',
            transactionHash,
          });
        }
      }

      this.log('debug', 'No matching USDC transfer found', { transactionHash });
      return null;
    } catch (error) {
      if (error instanceof EvmDetectorError) throw error;
      throw new EvmDetectorError(
        `Failed to verify transfer: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VERIFY_TRANSFER_ERROR',
        500,
        { transactionHash, error }
      );
    }
  }

  /**
   * Gets the chain configuration
   * @returns The chain configuration
   */
  getConfig(): ChainConfig {
    return {
      rpcUrl: this.rpcUrl,
      chainId: this.chainId,
      tokenAddress: this.tokenAddress,
    };
  }

  /**
   * Gets the token address being monitored
   * @returns The token address in lowercase
   */
  getTokenAddress(): string {
    return this.tokenAddress;
  }

  /**
   * Gets the chain ID
   * @returns The chain ID
   */
  getChainId(): number {
    return this.chainId;
  }
}

export { USDC_TRANSFER_TOPIC };
export type { TransferLog, LogEntry, JsonRpcRequest, JsonRpcResponse };