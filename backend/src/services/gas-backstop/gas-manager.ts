import { getChain } from '../../lib/chain-registry';

export interface GasStatus {
  address: string;
  chainId: string;
  balanceEth: number;    // rounded to 6 decimal places
  thresholdEth: number;  // the topup trigger threshold
  needsTopup: boolean;
  shortfallEth: number;  // 0 when needsTopup is false
  checkedAt: string;     // ISO 8601
}

export class GasManager {
  private threshold: number;

  constructor(thresholdEth = 0.005) {
    this.threshold = thresholdEth;
  }

  /**
   * Check ETH balance for an EVM wallet address on any supported EVM chain.
   * @param walletAddress - The wallet address to check
   * @param chainId - The chain ID to check on
   * @returns Promise<GasStatus> - Current gas status including balance and topup needs
   * @throws Error if chain is not supported or RPC call fails
   */
  async checkBalance(walletAddress: string, chainId: string): Promise<GasStatus> {
    const chain = getChain(chainId); // throws if unknown chain
    if (chain.type !== 'evm') {
      throw new Error(`Gas backstop not supported on non-EVM chain: ${chainId}`);
    }
    
    const hexBalance = await this.rpcGetBalance(chain.rpcUrl, walletAddress);
    const balanceWei = BigInt(hexBalance);
    const balanceEth = Number(balanceWei) / 1e18;
    const rounded = Math.round(balanceEth * 1e6) / 1e6;
    const needsTopup = rounded < this.threshold;
    
    return {
      address: walletAddress,
      chainId,
      balanceEth: rounded,
      thresholdEth: this.threshold,
      needsTopup,
      shortfallEth: needsTopup ? Math.round((this.threshold - rounded) * 1e6) / 1e6 : 0,
      checkedAt: new Date().toISOString(),
    };
  }

  // Internal: JSON-RPC eth_getBalance call
  private async rpcGetBalance(rpcUrl: string, address: string): Promise<string> {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest']
      }),
    });
    
    if (!res.ok) {
      throw new Error(`RPC HTTP error: ${res.status}`);
    }
    
    const json = await res.json() as { result?: string; error?: { message: string } };
    if (json.error) {
      throw new Error(`RPC error: ${json.error.message}`);
    }
    if (!json.result) {
      throw new Error('RPC returned no result');
    }
    
    return json.result;
  }
}

// Singleton exported for use in routes
export const gasManager = new GasManager();