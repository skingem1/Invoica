jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import invoiceRouter from '../invoices';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function buildApp(selectResult: any) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  const chain: any = {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue(selectResult),
    }),
  };

  mockCreateClient.mockReturnValue({
    from: jest.fn().mockReturnValue(chain),
  } as any);

  const app = express();
  app.use(express.json());
  app.use(invoiceRouter);
  app.use((err: Error, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('GET /v1/invoices/stats/aging', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 returns-shape — success:true with buckets 0_30 31_60 61_90 over_90', async () => {
    const app = buildApp({ data: [], error: null });
    const res = await request(app).get('/v1/invoices/stats/aging');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('buckets');
    const b = res.body.data.buckets;
    expect(b).toHaveProperty('0_30');
    expect(b).toHaveProperty('31_60');
    expect(b).toHaveProperty('61_90');
    expect(b).toHaveProperty('over_90');
  });

  test('200 buckets-correct — invoice aged 10d lands in 0_30, 45d in 31_60, 75d in 61_90, 100d in over_90', async () => {
    const rows = [
      { amount: 100, createdAt: daysAgo(10)  },
      { amount: 200, createdAt: daysAgo(45)  },
      { amount: 300, createdAt: daysAgo(75)  },
      { amount: 400, createdAt: daysAgo(100) },
    ];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/invoices/stats/aging');
    expect(res.status).toBe(200);
    const b = res.body.data.buckets;
    expect(b['0_30'].count).toBe(1);
    expect(b['31_60'].count).toBe(1);
    expect(b['61_90'].count).toBe(1);
    expect(b['over_90'].count).toBe(1);
  });

  test('200 empty-state — no pending invoices returns all buckets with count 0 and totalAmount 0', async () => {
    const app = buildApp({ data: [], error: null });
    const res = await request(app).get('/v1/invoices/stats/aging');
    expect(res.status).toBe(200);
    const b = res.body.data.buckets;
    for (const key of ['0_30', '31_60', '61_90', 'over_90']) {
      expect(b[key].count).toBe(0);
      expect(b[key].totalAmount).toBe(0);
    }
  });

  test('200 amount-summed — totalAmount sums correctly within a bucket', async () => {
    const rows = [
      { amount: 150, createdAt: daysAgo(5) },
      { amount: 250, createdAt: daysAgo(20) },
    ];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/invoices/stats/aging');
    expect(res.status).toBe(200);
    const b = res.body.data.buckets;
    expect(b['0_30'].count).toBe(2);
    expect(b['0_30'].totalAmount).toBe(400);
  });

  test('500 db-error — returns 500 when DB query fails', async () => {
    const app = buildApp({ data: null, error: new Error('DB down') });
    const res = await request(app).get('/v1/invoices/stats/aging');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
