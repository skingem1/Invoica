import request from 'supertest';
import express from 'express';

let mockResult: { data: any; error: any };

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      then: undefined,
      // make it awaitable
      [Symbol.asyncIterator]: undefined,
    })),
  })),
}));

// We need the query to resolve when awaited. Override the mock per test.
import { createClient } from '@supabase/supabase-js';

function makeApp() {
  const app = express();
  app.use(express.json());
  const router = require('../invoice-stats').default;
  app.use(router);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

const app = makeApp();

function buildQueryChain(resolveWith: object) {
  const chain: any = {
    eq: jest.fn().mockReturnThis(),
  };
  chain.select = jest.fn().mockReturnValue(Promise.resolve(resolveWith));
  return chain;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
});

describe('GET /v1/invoices/stats', () => {
  it('returns zeros with empty data', async () => {
    (createClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => buildQueryChain({ data: [], error: null })),
    });

    const res = await request(app).get('/v1/invoices/stats');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.totalRevenue).toBe(0);
    expect(res.body.data.averageAmount).toBe(0);
    expect(res.body.data.byStatus).toEqual([]);
  });

  it('calculates totals correctly — 3 COMPLETED + 1 PENDING', async () => {
    const mockData = [
      { status: 'COMPLETED', amount: '100' },
      { status: 'COMPLETED', amount: '200' },
      { status: 'COMPLETED', amount: '300' },
      { status: 'PENDING', amount: '50' },
    ];
    (createClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => buildQueryChain({ data: mockData, error: null })),
    });

    const res = await request(app).get('/v1/invoices/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(4);
    expect(res.body.data.totalRevenue).toBe(600);
    const completedEntry = res.body.data.byStatus.find((s: any) => s.status === 'COMPLETED');
    expect(completedEntry).toBeDefined();
    expect(completedEntry.count).toBe(3);
    expect(completedEntry.revenue).toBe(600);
  });

  it('passes companyId filter to Supabase query', async () => {
    const mockEq = jest.fn().mockResolvedValue({ data: [], error: null });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    (createClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({ select: mockSelect })),
    });

    await request(app).get('/v1/invoices/stats?companyId=co-1');
    expect(mockEq).toHaveBeenCalledWith('companyId', 'co-1');
  });

  it('returns 500 when Supabase throws an error', async () => {
    (createClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => buildQueryChain({ data: null, error: new Error('DB failure') })),
    });

    const res = await request(app).get('/v1/invoices/stats');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
