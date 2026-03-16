import request from 'supertest';
import express from 'express';

// Chainable mock — each method returns `this` so they're chainable.
// `range` is the terminal method that resolves the query.
let mockChain: any;

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => mockChain),
  })),
}));

import invoicesRouter from '../invoices';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(invoicesRouter);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

const app = makeApp();

function buildChain(resolveValue: object) {
  const chain: any = {};
  ['eq', 'gte', 'lte', 'contains', 'order', 'select'].forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.range = jest.fn().mockResolvedValue(resolveValue);
  return chain;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  mockChain = buildChain({ data: [], error: null, count: 0 });
});

describe('GET /v1/invoices — enhanced filter tests', () => {
  it('returns invoices filtered by companyId', async () => {
    mockChain = buildChain({
      data: [
        { id: '1', invoiceNumber: 1, status: 'PENDING', amount: 100, currency: 'USD',
          customerEmail: 'a@b.com', customerName: 'A', companyId: 'co-1',
          paymentDetails: {}, settledAt: null, completedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
        { id: '2', invoiceNumber: 2, status: 'COMPLETED', amount: 200, currency: 'USD',
          customerEmail: 'c@d.com', customerName: 'B', companyId: 'co-1',
          paymentDetails: {}, settledAt: null, completedAt: null, createdAt: '2026-01-02', updatedAt: '2026-01-02' },
      ],
      error: null, count: 2,
    });

    const res = await request(app).get('/v1/invoices?companyId=co-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(mockChain.eq).toHaveBeenCalledWith('companyId', 'co-1');
  });

  it('applies fromDate filter using gte on createdAt', async () => {
    await request(app).get('/v1/invoices?from=2026-01-01');
    expect(mockChain.gte).toHaveBeenCalledWith('createdAt', '2026-01-01');
  });

  it('applies toDate filter using lte on createdAt', async () => {
    await request(app).get('/v1/invoices?to=2026-12-31');
    expect(mockChain.lte).toHaveBeenCalledWith('createdAt', '2026-12-31');
  });

  it('applies minAmount filter using gte on amount', async () => {
    await request(app).get('/v1/invoices?minAmount=50');
    expect(mockChain.gte).toHaveBeenCalledWith('amount', 50);
  });

  it('applies chain filter using contains on paymentDetails', async () => {
    await request(app).get('/v1/invoices?chain=polygon');
    expect(mockChain.contains).toHaveBeenCalledWith('paymentDetails', { network: 'polygon' });
  });

  it('applies sortBy=amount and sortDir=asc', async () => {
    await request(app).get('/v1/invoices?sortBy=amount&sortDir=asc');
    expect(mockChain.order).toHaveBeenCalledWith('amount', { ascending: true });
  });

  it('falls back to createdAt for invalid sortBy', async () => {
    await request(app).get('/v1/invoices?sortBy=badfield');
    expect(mockChain.order).toHaveBeenCalledWith('createdAt', { ascending: false });
  });
});
