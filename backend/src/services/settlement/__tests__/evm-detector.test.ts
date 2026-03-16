import { EvmSettlementDetector } from '../evm-detector';
import { ChainConfig } from '../../../lib/chain-registry';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const MOCK_CHAIN: ChainConfig = {
  id: 'base',
  displayName: 'Base',
  type: 'evm',
  chainId: 8453,
  rpcUrl: 'https://base.rpc.test',
  usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  explorerUrl: 'https://basescan.org',
  usdcDecimals: 6,
};

function mockFetch(result: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    json: jest.fn().mockResolvedValue({ result, id: 1, jsonrpc: '2.0' }),
  } as any);
}

function mockFetchSequence(...results: unknown[]) {
  let idx = 0;
  global.fetch = jest.fn().mockImplementation(() => {
    const result = results[idx++] ?? results[results.length - 1];
    return Promise.resolve({
      json: jest.fn().mockResolvedValue({ result, id: 1, jsonrpc: '2.0' }),
    });
  });
}

function mockFetchError(message: string) {
  global.fetch = jest.fn().mockResolvedValue({
    json: jest.fn().mockResolvedValue({ error: { message }, id: 1, jsonrpc: '2.0' }),
  } as any);
}

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// getLatestBlock
// ---------------------------------------------------------------------------

describe('EvmSettlementDetector.getLatestBlock', () => {
  it('parses hex block number to integer', async () => {
    mockFetch('0x13d1');  // 5073 decimal
    const detector = new EvmSettlementDetector(MOCK_CHAIN);
    const block = await detector.getLatestBlock();
    expect(block).toBe(5073);
  });

  it('throws when RPC returns error', async () => {
    mockFetchError('rate limit exceeded');
    const detector = new EvmSettlementDetector(MOCK_CHAIN);
    await expect(detector.getLatestBlock()).rejects.toThrow('rate limit exceeded');
  });
});

// ---------------------------------------------------------------------------
// scanTransfersToAddress
// ---------------------------------------------------------------------------

describe('EvmSettlementDetector.scanTransfersToAddress', () => {
  it('returns empty array when no logs found', async () => {
    mockFetch([]);
    const detector = new EvmSettlementDetector(MOCK_CHAIN);
    const result = await detector.scanTransfersToAddress('0xRecipient');
    expect(result).toEqual([]);
  });

  it('maps log to SettlementMatch correctly', async () => {
    const mockLog = {
      blockNumber: '0x1',
      transactionHash: '0xabc123',
      topics: [
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        '0x000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        '0x000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      ],
      data: '0x' + BigInt(5_000_000).toString(16),  // 5 USDC (6 decimals)
    };
    const mockBlock = { timestamp: '0x' + (1700000000).toString(16) };
    mockFetchSequence([mockLog], mockBlock);

    const detector = new EvmSettlementDetector(MOCK_CHAIN);
    const result = await detector.scanTransfersToAddress('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');

    expect(result).toHaveLength(1);
    expect(result[0].txHash).toBe('0xabc123');
    expect(result[0].amount).toBeCloseTo(5);
    expect(result[0].chain).toBe('base');
    expect(result[0].blockNumber).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// verifyTransfer
// ---------------------------------------------------------------------------

describe('EvmSettlementDetector.verifyTransfer', () => {
  it('returns false when receipt is null', async () => {
    mockFetch(null);
    const detector = new EvmSettlementDetector(MOCK_CHAIN);
    const ok = await detector.verifyTransfer('0xtxhash', '0xrecipient', 100);
    expect(ok).toBe(false);
  });

  it('returns true when receipt has matching USDC transfer log', async () => {
    const receipt = {
      logs: [{
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
          '0x000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          '0x000000000000000000000000cccccccccccccccccccccccccccccccccccccccc',
        ],
        data: '0x' + BigInt(10_000_000).toString(16),  // 10 USDC
      }],
    };
    mockFetch(receipt);
    const detector = new EvmSettlementDetector(MOCK_CHAIN);
    const ok = await detector.verifyTransfer(
      '0xtxhash',
      '0xcccccccccccccccccccccccccccccccccccccccc',
      10
    );
    expect(ok).toBe(true);
  });

  it('returns false when log topic does not match USDC transfer signature', async () => {
    const receipt = {
      logs: [{
        address: '0xother',
        topics: ['0xwrongtopic', '0x0', '0xrecipient'],
        data: '0x' + BigInt(10_000_000).toString(16),
      }],
    };
    mockFetch(receipt);
    const detector = new EvmSettlementDetector(MOCK_CHAIN);
    const ok = await detector.verifyTransfer('0xtxhash', '0xrecipient', 10);
    expect(ok).toBe(false);
  });

  it('returns false when amount does not match', async () => {
    const receipt = {
      logs: [{
        address: MOCK_CHAIN.usdcAddress,
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x000000000000000000000000dddddddddddddddddddddddddddddddddddddddd',
        ],
        data: '0x' + BigInt(5_000_000).toString(16),  // 5 USDC, not 10
      }],
    };
    mockFetch(receipt);
    const detector = new EvmSettlementDetector(MOCK_CHAIN);
    const ok = await detector.verifyTransfer(
      '0xtxhash',
      '0xdddddddddddddddddddddddddddddddddddddddd',
      10
    );
    expect(ok).toBe(false);
  });
});
