import {
  SettlementStatus,
  SettlementMatch,
  SettlementFilter,
  SettlementQueryResult,
  RawSettlement,
  SettlementDetectionConfig,
  SettlementDetectedEvent,
} from '../types';
import type { ChainConfig } from '../types';

// ---------------------------------------------------------------------------
// SettlementStatus enum
// ---------------------------------------------------------------------------
describe('SettlementStatus', () => {
  it('Pending equals "pending"', () => {
    expect(SettlementStatus.Pending).toBe('pending');
  });

  it('Processing equals "processing"', () => {
    expect(SettlementStatus.Processing).toBe('processing');
  });

  it('Settled equals "settled"', () => {
    expect(SettlementStatus.Settled).toBe('settled');
  });

  it('Failed equals "failed"', () => {
    expect(SettlementStatus.Failed).toBe('failed');
  });

  it('has exactly 4 string values', () => {
    const values = Object.values(SettlementStatus).filter(v => typeof v === 'string');
    expect(values).toHaveLength(4);
    expect(values).toEqual(
      expect.arrayContaining(['pending', 'processing', 'settled', 'failed'])
    );
  });
});

// ---------------------------------------------------------------------------
// Interface shape tests (runtime object construction)
// ---------------------------------------------------------------------------
describe('SettlementMatch shape', () => {
  it('constructs a valid SettlementMatch object', () => {
    const match: SettlementMatch = {
      invoiceId: 'inv-001',
      txHash: '0xabc123',
      amount: 100.5,
      from: '0xSender',
      to: '0xReceiver',
      blockNumber: 12345678,
      timestamp: 1710000000,
      chain: 'ethereum',
    };
    expect(match.invoiceId).toBe('inv-001');
    expect(match.amount).toBe(100.5);
    expect(match.chain).toBe('ethereum');
  });
});

describe('SettlementFilter shape', () => {
  it('requires fromBlock and toBlock; optional fields default to undefined', () => {
    const filter: SettlementFilter = { fromBlock: 100, toBlock: 200 };
    expect(filter.fromBlock).toBe(100);
    expect(filter.toBlock).toBe(200);
    expect(filter.to).toBeUndefined();
    expect(filter.from).toBeUndefined();
    expect(filter.minAmount).toBeUndefined();
    expect(filter.maxAmount).toBeUndefined();
  });

  it('accepts all optional fields', () => {
    const filter: SettlementFilter = {
      fromBlock: 1,
      toBlock: 9999,
      to: '0xRecipient',
      from: '0xPayer',
      minAmount: 10,
      maxAmount: 1000,
    };
    expect(filter.to).toBe('0xRecipient');
    expect(filter.minAmount).toBe(10);
    expect(filter.maxAmount).toBe(1000);
  });
});

describe('SettlementQueryResult shape', () => {
  it('constructs with settlements array, lastQueriedBlock and hasMore', () => {
    const result: SettlementQueryResult = {
      settlements: [],
      lastQueriedBlock: 500,
      hasMore: false,
    };
    expect(result.settlements).toEqual([]);
    expect(result.lastQueriedBlock).toBe(500);
    expect(result.hasMore).toBe(false);
  });
});

describe('RawSettlement shape', () => {
  it('constructs with all 8 required fields', () => {
    const raw: RawSettlement = {
      txHash: '0xraw',
      blockNumber: 7000,
      blockTimestamp: 1710000100,
      from: '0xFrom',
      to: '0xTo',
      amount: '1000000', // smallest unit
      tokenAddress: '0xUSDC',
      chain: 'polygon',
      confirmations: 12,
    };
    expect(raw.txHash).toBe('0xraw');
    expect(raw.amount).toBe('1000000');
    expect(raw.confirmations).toBe(12);
  });
});

describe('SettlementDetectionConfig shape', () => {
  it('constructs with required fields and optional settlementContractAddress', () => {
    const mockChain: ChainConfig = {
      id: 1,
      name: 'ethereum',
      rpcUrl: 'https://eth-rpc.example.com',
      usdcAddress: '0xUSDC',
      chainSelector: 'eth',
    } as unknown as ChainConfig;

    const config: SettlementDetectionConfig = {
      chain: mockChain,
      pollingIntervalMs: 15000,
      requiredConfirmations: 12,
      usdcTokenAddress: '0xUSDC',
    };
    expect(config.pollingIntervalMs).toBe(15000);
    expect(config.requiredConfirmations).toBe(12);
    expect(config.settlementContractAddress).toBeUndefined();
  });
});

describe('SettlementDetectedEvent shape', () => {
  it('constructs with invoiceId, match, status, and detectedAt', () => {
    const match: SettlementMatch = {
      invoiceId: 'inv-002',
      txHash: '0xev',
      amount: 50,
      from: '0xF',
      to: '0xT',
      blockNumber: 1000,
      timestamp: 1710001000,
      chain: 'arbitrum',
    };
    const event: SettlementDetectedEvent = {
      invoiceId: 'inv-002',
      match,
      status: SettlementStatus.Settled,
      detectedAt: Date.now(),
    };
    expect(event.status).toBe(SettlementStatus.Settled);
    expect(event.match.txHash).toBe('0xev');
  });
});
