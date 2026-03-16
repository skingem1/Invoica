jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('bull', () => jest.fn().mockImplementation(() => ({ add: jest.fn() })));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $disconnect: jest.fn(),
    invoice: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
  })),
}));

import {
  SettlementPollerService,
  SettlementPollerError,
  createSettlementPollerService,
} from '../settlement-poller';

const MOCK_CONFIG = {
  payaiBaseUrl: 'http://test.payai.com',
  payaiApiKey: 'test-api-key',
  pollIntervalMs: 30000,
  redisUrl: 'redis://localhost:6379',
};

function makeDeps() {
  const prisma: any = {
    $disconnect: jest.fn(),
    invoice: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
  };
  const http: any = { get: jest.fn() };
  const queue: any = { add: jest.fn() };
  return { prisma, http, queue };
}

describe('SettlementPollerError', () => {
  it('stores the message correctly', () => {
    const err = new SettlementPollerError('test error', 'TEST_CODE');
    expect(err.message).toBe('test error');
  });

  it('stores the code correctly', () => {
    const err = new SettlementPollerError('msg', 'MY_CODE');
    expect(err.code).toBe('MY_CODE');
  });

  it('has name SettlementPollerError', () => {
    const err = new SettlementPollerError('msg', 'CODE');
    expect(err.name).toBe('SettlementPollerError');
  });

  it('cause is undefined when not provided', () => {
    const err = new SettlementPollerError('msg', 'CODE');
    expect(err.cause).toBeUndefined();
  });

  it('stores cause when provided', () => {
    const rootCause = new Error('root');
    const err = new SettlementPollerError('msg', 'CODE', rootCause);
    expect(err.cause).toBe(rootCause);
  });
});

describe('SettlementPollerService constructor + getStatus', () => {
  it('instantiates without throwing when deps are injected', () => {
    const { prisma, http, queue } = makeDeps();
    expect(() => new SettlementPollerService(MOCK_CONFIG, prisma, http, queue)).not.toThrow();
  });

  it('getStatus returns initial state: not running, not polling, 0 processed', () => {
    const { prisma, http, queue } = makeDeps();
    const svc = new SettlementPollerService(MOCK_CONFIG, prisma, http, queue);
    const status = svc.getStatus();
    expect(status.isRunning).toBe(false);
    expect(status.isPolling).toBe(false);
    expect(status.processedCount).toBe(0);
    expect(status.pollInterval).toBe(30000);
  });

  it('clearProcessedCache resets processedCount to 0', async () => {
    const { prisma, http, queue } = makeDeps();
    http.get.mockResolvedValue({ data: { settlements: [{
      id: 's1', transaction_id: 'tx-001', amount: 100, currency: 'USD',
      status: 'settled', settled_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z',
    }] } });
    const svc = new SettlementPollerService(MOCK_CONFIG, prisma, http, queue);
    await svc.pollSettlements();
    expect(svc.getStatus().processedCount).toBeGreaterThanOrEqual(0);
    svc.clearProcessedCache();
    expect(svc.getStatus().processedCount).toBe(0);
  });
});

describe('SettlementPollerService.pollSettlements', () => {
  it('completes without error when settlements array is empty', async () => {
    const { prisma, http, queue } = makeDeps();
    http.get.mockResolvedValue({ data: { settlements: [] } });
    const svc = new SettlementPollerService(MOCK_CONFIG, prisma, http, queue);
    await expect(svc.pollSettlements()).resolves.toBeUndefined();
  });

  it('throws SettlementPollerError on axios error', async () => {
    const { prisma, http, queue } = makeDeps();
    const axiosErr: any = new Error('Network Error');
    axiosErr.isAxiosError = true;
    axiosErr.response = { status: 503 };
    http.get.mockRejectedValue(axiosErr);

    // Make axios.isAxiosError recognise our fake error
    const axios = require('axios');
    const origIsAxiosError = axios.isAxiosError;
    axios.isAxiosError = (e: any) => e?.isAxiosError === true;

    const svc = new SettlementPollerService(MOCK_CONFIG, prisma, http, queue);
    await expect(svc.pollSettlements()).rejects.toBeInstanceOf(SettlementPollerError);

    axios.isAxiosError = origIsAxiosError;
  });
});

describe('SettlementPollerService.processSettlement', () => {
  it('skips duplicate settlement in same session (in-memory idempotency)', async () => {
    const { prisma, http, queue } = makeDeps();
    const svc = new SettlementPollerService(MOCK_CONFIG, prisma, http, queue);

    const settlement: any = {
      id: 's1', transaction_id: 'tx-dupe', amount: 50, currency: 'USD',
      status: 'settled', settled_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z',
    };

    const mockInvoice = { id: 'inv-001', transactionId: 'tx-dupe', status: 'PENDING' };

    // First call: not already processed → finds pending invoice → matches → adds to in-memory cache
    prisma.invoice.findFirst
      .mockResolvedValueOnce(null)        // no existing processed invoice
      .mockResolvedValueOnce(mockInvoice); // pending invoice found → match
    prisma.invoice.update.mockResolvedValue(mockInvoice);
    queue.add.mockResolvedValue({ id: 'job-1' });

    await svc.processSettlement(settlement);
    const callCountAfterFirst = prisma.invoice.findFirst.mock.calls.length; // = 2

    // Second call with same tx_id — skipped immediately via in-memory cache
    await svc.processSettlement(settlement);
    expect(prisma.invoice.findFirst.mock.calls.length).toBe(callCountAfterFirst);
  });
});

describe('createSettlementPollerService factory', () => {
  it('throws when PAYAI_API_KEY is missing', () => {
    const origKey = process.env.PAYAI_API_KEY;
    delete process.env.PAYAI_API_KEY;
    expect(() => createSettlementPollerService({})).toThrow('PAYAI_API_KEY is required');
    process.env.PAYAI_API_KEY = origKey;
  });

  it('creates a SettlementPollerService when payaiApiKey is provided', () => {
    const svc = createSettlementPollerService({ payaiApiKey: 'test-key' });
    expect(svc).toBeInstanceOf(SettlementPollerService);
  });
});
