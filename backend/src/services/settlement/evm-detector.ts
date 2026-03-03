import { ChainConfig } from '../../lib/chain-registry';

const USDC_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

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

interface LogEntry {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  transactionIndex: string;
  logIndex: string;
}

interface BlockResult {
  timestamp: string;
}

export class EvmSettlementDetector {
  constructor(private chain: ChainConfig) {}

  private async rpc(method: string, params: unknown[]): Promise<unknown> {
    const res = await fetch(this.chain.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const json = (await res.json()) as { result?: unknown; error?: { message: string } };
    if (json.error) throw new Error(json.error.message);
    return json.result;
  }

  async getLatestBlock(): Promise<number> {
    const block = (await this.rpc('eth_blockNumber', [])) as string;
    return parseInt(block, 16);
  }

  async scanTransfersToAddress(
    recipientAddress: string,
    fromBlock: string | number = 'latest',
    toBlock: string | number = 'latest'
  ): Promise<SettlementMatch[]> {
    const latest = await this.getLatestBlock();
    const from = typeof fromBlock === 'number' ? `0x${fromBlock.toString(16)}` : fromBlock;
    const to = typeof toBlock === 'number' ? `0x${toBlock.toString(16)}` : toBlock;

    const logs = (await this.rpc('eth_getLogs', [{
      fromBlock: from,
      toBlock: to,
      address: this.chain.usdcAddress,
      topics: [USDC_TRANSFER_TOPIC, null, `0x${recipientAddress.replace('0x', '').padStart(64, '0')}`],
    }])) as LogEntry[];

    const matches: SettlementMatch[] = [];
    for (const log of logs) {
      const fromAddr = `0x${log.topics[1].slice(-40)}`;
      const toAddr = `0x${log.topics[2].slice(-40)}`;
      const amount = parseInt(log.data, 16) / 1e6;
      const block = parseInt(log.blockNumber, 16);
      const blockData = (await this.rpc('eth_getBlockByNumber', [log.blockNumber, false])) as BlockResult;

      matches.push({
        invoiceId: '',
        txHash: log.transactionHash,
        amount,
        from: fromAddr,
        to: toAddr,
        blockNumber: block,
        timestamp: parseInt(blockData.timestamp, 16),
        chain: this.chain.chainId,
      });
    }
    return matches;
  }

  async verifyTransfer(txHash: string, expectedRecipient: string, expectedAmount: number): Promise<boolean> {
    const tx = (await this.rpc('eth_getTransactionByHash', [txHash])) as { to: string; input: string } | null;
    if (!tx) return false;

    const receipt = (await this.rpc('eth_getTransactionReceipt', [txHash])) as { logs: LogEntry[] } | null;
    if (!receipt) return false;

    for (const log of receipt.logs) {
      if (log.topics[0] === USDC_TRANSFER_TOPIC) {
        const toAddr = `0x${log.topics[2].slice(-40)}`.toLowerCase();
        const recipientLower = expectedRecipient.toLowerCase();
        if (toAddr === recipientLower) {
          const amount = parseInt(log.data, 16) / 1e6;
          return amount >= expectedAmount;
        }
      }
    }
    return false;
  }
}