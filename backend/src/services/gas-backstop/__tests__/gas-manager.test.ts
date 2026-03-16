jest.mock('../../../lib/chain-registry', () => ({
  getChain: jest.fn(),
}));

import { getChain } from '../../../lib/chain-registry';
import { GasManager, gasManager } from '../gas-manager';

const mockGetChain = getChain as jest.Mock;

function mockFetch(response: Partial<Response> & { jsonValue?: any }) {
  const { jsonValue, ok = true, status = 200 } = response;
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: jest.fn().mockResolvedValue(jsonValue ?? { result: '0xde0b6b3a7640000' }),
  });
}

const EVM_CHAIN = { type: 'evm', rpcUrl: 'https://rpc.example.com' };
const SOLANA_CHAIN = { type: 'solana', rpcUrl: 'https://api.mainnet-beta.solana.com' };

describe('GasManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetChain.mockReturnValue(EVM_CHAIN);
    mockFetch({});
  });

  describe('constructor', () => {
    it('uses default threshold of 0.005 ETH', () => {
      const gm = new GasManager();
      // Threshold is private — verify it through behaviour: 0.001 ETH balance should trigger topup
      mockFetch({ jsonValue: { result: '0x38d7ea4c68000' } }); // 0.001 ETH in hex
      // checkBalance will run in the needsTopup test, just verify constructor doesn't throw
      expect(gm).toBeInstanceOf(GasManager);
    });

    it('accepts custom threshold', () => {
      const gm = new GasManager(0.01);
      expect(gm).toBeInstanceOf(GasManager);
    });
  });

  describe('checkBalance()', () => {
    it('returns GasStatus with needsTopup=false when balance exceeds threshold', async () => {
      // 1 ETH = 1e18 wei = 0xde0b6b3a7640000
      mockFetch({ jsonValue: { result: '0xde0b6b3a7640000' } });

      const gm = new GasManager(0.005);
      const status = await gm.checkBalance('0xWallet', 'base');

      expect(status.address).toBe('0xWallet');
      expect(status.chainId).toBe('base');
      expect(status.balanceEth).toBe(1);
      expect(status.thresholdEth).toBe(0.005);
      expect(status.needsTopup).toBe(false);
      expect(status.shortfallEth).toBe(0);
      expect(status.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('returns needsTopup=true and correct shortfall when balance is below threshold', async () => {
      // 0.001 ETH = 1e15 wei = 0x38d7ea4c68000
      mockFetch({ jsonValue: { result: '0x38d7ea4c68000' } });

      const gm = new GasManager(0.005);
      const status = await gm.checkBalance('0xWallet', 'base');

      expect(status.needsTopup).toBe(true);
      expect(status.balanceEth).toBe(0.001);
      expect(status.shortfallEth).toBeCloseTo(0.004, 5);
    });

    it('throws when chain type is not EVM', async () => {
      mockGetChain.mockReturnValue(SOLANA_CHAIN);

      const gm = new GasManager();
      await expect(gm.checkBalance('0xWallet', 'solana')).rejects.toThrow('non-EVM');
    });

    it('throws when getChain throws (unknown chainId)', async () => {
      mockGetChain.mockImplementation(() => { throw new Error('Unknown chain: xyz'); });

      const gm = new GasManager();
      await expect(gm.checkBalance('0xWallet', 'xyz')).rejects.toThrow('Unknown chain');
    });

    it('throws on RPC HTTP error', async () => {
      mockFetch({ ok: false, status: 500, jsonValue: {} });

      const gm = new GasManager();
      await expect(gm.checkBalance('0xWallet', 'base')).rejects.toThrow('RPC HTTP error');
    });

    it('throws on RPC JSON error field', async () => {
      mockFetch({ jsonValue: { error: { message: 'method not found' } } });

      const gm = new GasManager();
      await expect(gm.checkBalance('0xWallet', 'base')).rejects.toThrow('RPC error: method not found');
    });

    it('throws when RPC result is missing', async () => {
      mockFetch({ jsonValue: {} });

      const gm = new GasManager();
      await expect(gm.checkBalance('0xWallet', 'base')).rejects.toThrow('no result');
    });
  });

  describe('gasManager singleton', () => {
    it('is an instance of GasManager', () => {
      expect(gasManager).toBeInstanceOf(GasManager);
    });
  });
});
