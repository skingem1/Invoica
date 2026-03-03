import { ChainConfig } from '../../lib/chain-registry';

/** USDC Transfer event topic hash */
const USDC_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/** JSON-RPC response wrapper */
interface RpcResponse<T> {
  jsonrpc: string;
  id: number;
  result: T;
}

/** Eth log event interface */
interface EthLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
}

/** Eth block interface */
interface EthBlock {
  timestamp: string;
  number: string;
}

/** Settlement match result */
export interface SettlementMatch {
  invoiceId: string;
  txHash: string;
  amount: number;
  from: string;
  to: string;
  blockNumber: number;
  timestamp: number;
  chain: string;
}

/**
 * Detects USDC settlements on EVM chains by scanning Transfer events.
 * Supports Base and Polygon networks via JSON-RPC.
 */
export class EvmSettlementDetector {
  private readonly rpcUrl: string;

  constructor(private chain: ChainConfig) {
    this.rpcUrl = chain.rpcUrl;
  }

  /**
   * Scan for USDC Transfer events to a given address in block range.
   * @param recipientAddress The recipient address to match transfers
   * @param fromBlock Starting block (default: 'latest')
   * @param toBlock Ending block (default: 'latest')
   * @returns Array of settlement matches with timestamps from block data
   */
  async scanTransfersToAddress(
    recipientAddress: string,
    fromBlock: string | number = 'latest',
    toBlock: string | number = 'latest'
  ): Promise<SettlementMatch[]> {
    const logs = await this.rpc<EthLog[]>('eth_getLogs', [{
      address: this.chain.usdcAddress,
      fromBlock,
      toBlock,
      topics: [USDC_TRANSFER_TOPIC]
    }]);

    if (!Array.isArray(logs)) return [];

    const matches: SettlementMatch[] = [];
    for (const log of logs) {
      if (!log.topics || log.topics.length < 3) continue;

      const to = '0x' + log.topics[2].slice(-40);
      if (to.toLowerCase() !== recipientAddress.toLowerCase()) continue;

      const from = '0x' + log.topics[1].slice(-40);
      const amount = BigInt(log.data || '0x0');
      const blockNumber = parseInt(log.blockNumber, 16);

      const block = await this.rpc<EthBlock>('eth_getBlockByNumber', [blockNumber, false]);
      const timestamp = block ? parseInt(block.timestamp, 16) : Math.floor(Date.now() / 1000);

      matches.push({
        invoiceId: '',
        txHash: log.transactionHash,
        amount: Number(amount) / 1e6,
        from,
        to: recipientAddress,
        blockNumber,
        timestamp,
        chain: this.chain.chainId
      });
    }

    return matches;
  }

  /**
   * Get the current latest block number.
   * @returns Current block number
   */
  async getLatestBlock(): Promise<number> {
    const result = await this.rpc<string>('eth_blockNumber', []);
    return result ? parseInt(result, 16) : 0;
  }

  /**
   * Verify a specific transaction is a valid USDC transfer.
   * @param txHash Transaction hash to verify
   * @param expectedRecipient Expected recipient address
   * @param expectedAmount Expected amount in USDC
   * @returns True if transaction matches all criteria
   */
  async verifyTransfer(txHash: string, expectedRecipient: string, expectedAmount: number): Promise<boolean> {
    const tx = await this.rpc<{ to: string }>('eth_getTransactionByHash', [txHash]);
    if (!tx || tx.to?.toLowerCase() !== this.chain.usdcAddress.toLowerCase()) return false;

    const receipt = await this.rpc<{ status: string; logs: EthLog[] }>('eth_getTransactionReceipt', [txHash]);
    if (!receipt || receipt.status === '0x0') return false;

    const log = receipt.logs?.find(l => l.topics?.[0] === USDC_TRANSFER_TOPIC);
    if (!log || !log.topics || log.topics.length < 3) return false;

    const recipient = '0x' + log.topics[2].slice(-40);
    const amount = BigInt(log.data || '0x0');

    return recipient.toLowerCase() === expectedRecipient.toLowerCase() &&
           Number(amount) / 1e6 === expectedAmount;
  }

  /**
   * Make JSON-RPC call to the chain.
   * @param method RPC method name
   * @param params RPC parameters
   * @returns Parsed result from RPC response
   */
  private async rpc<T>(method: string, params: unknown[]): Promise<T | null> {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });

    const data: RpcResponse<T> = await res.json();
    return data.result ?? null;
  }
}