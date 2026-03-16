jest.mock('@prisma/client', () => ({
  InvoiceStatus: {
    PENDING: 'PENDING',
    SETTLED: 'SETTLED',
    CANCELLED: 'CANCELLED',
  },
}));

const mockFindMany = jest.fn();
const mockCount = jest.fn();

jest.mock('../../db/client', () => ({
  prisma: {
    invoice: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

import { Request, Response } from 'express';
import { listInvoices } from '../invoices-list';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

function makeReq(query: Record<string, unknown> = {}) {
  return { query } as unknown as Request;
}

const MOCK_INVOICE = {
  id: 'inv-001',
  invoiceNumber: '0042',
  amount: 100.5,
  currency: 'USDC',
  status: 'PENDING',
  createdAt: new Date('2026-01-15T10:00:00Z'),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFindMany.mockResolvedValue([MOCK_INVOICE]);
  mockCount.mockResolvedValue(1);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('listInvoices — response shape', () => {
  it('returns invoices array with correct field mapping', async () => {
    const req = makeReq();
    const res = makeRes();
    await listInvoices(req, res);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.invoices).toHaveLength(1);
    expect(body.invoices[0]).toMatchObject({
      id: 'inv-001',
      number: 'INV-0042',
      amount: 100.5,
      currency: 'USDC',
      status: 'pending',
    });
  });

  it('returns total, limit, offset in response', async () => {
    const req = makeReq({ limit: '5', offset: '10' });
    const res = makeRes();
    await listInvoices(req, res);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.total).toBe(1);
    expect(body.limit).toBe(5);
    expect(body.offset).toBe(10);
  });

  it('createdAt is ISO string', async () => {
    const req = makeReq();
    const res = makeRes();
    await listInvoices(req, res);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.invoices[0].createdAt).toBe('2026-01-15T10:00:00.000Z');
  });

  it('status is lowercased', async () => {
    mockFindMany.mockResolvedValue([{ ...MOCK_INVOICE, status: 'SETTLED' }]);
    const req = makeReq();
    const res = makeRes();
    await listInvoices(req, res);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.invoices[0].status).toBe('settled');
  });
});

describe('listInvoices — pagination defaults', () => {
  it('defaults limit to 10 when not provided', async () => {
    const req = makeReq();
    const res = makeRes();
    await listInvoices(req, res);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.limit).toBe(10);
  });

  it('defaults offset to 0 when not provided', async () => {
    const req = makeReq();
    const res = makeRes();
    await listInvoices(req, res);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.offset).toBe(0);
  });

  it('passes custom limit to findMany', async () => {
    const req = makeReq({ limit: '20' });
    const res = makeRes();
    await listInvoices(req, res);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 })
    );
  });

  it('passes custom offset to findMany', async () => {
    const req = makeReq({ offset: '30' });
    const res = makeRes();
    await listInvoices(req, res);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 30 })
    );
  });
});

describe('listInvoices — empty results', () => {
  it('returns empty invoices array when no records found', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    const req = makeReq();
    const res = makeRes();
    await listInvoices(req, res);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.invoices).toEqual([]);
    expect(body.total).toBe(0);
  });
});

describe('listInvoices — error handling', () => {
  it('returns 500 when prisma throws', async () => {
    mockFindMany.mockRejectedValue(new Error('DB connection failed'));
    const req = makeReq();
    const res = makeRes();
    await listInvoices(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch invoices' });
  });
});
