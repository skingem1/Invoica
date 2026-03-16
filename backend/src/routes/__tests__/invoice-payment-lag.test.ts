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

  mockCreateClient.mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        in: jest.fn().mockResolvedValue(selectResult),
      }),
    }),
  } as any);

  const app = express();
  app.use(express.json());
  app.use(invoiceRouter);
  app.use((err: Error, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

function msAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

const HOUR_MS = 3600000;

describe('GET /v1/invoices/stats/payment-lag', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 returns-shape — success:true with count, avgLagMs, medianLagMs, minLagMs, maxLagMs, avgLagHours', async () => {
    const now = new Date().toISOString();
    const rows = [{ createdAt: msAgo(2 * HOUR_MS), settledAt: now, completedAt: null }];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/invoices/stats/payment-lag');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const d = res.body.data;
    expect(d).toHaveProperty('count');
    expect(d).toHaveProperty('avgLagMs');
    expect(d).toHaveProperty('medianLagMs');
    expect(d).toHaveProperty('minLagMs');
    expect(d).toHaveProperty('maxLagMs');
    expect(d).toHaveProperty('avgLagHours');
  });

  test('200 correct-avg — 2h + 4h settled invoices → avgLagHours=3', async () => {
    const base = Date.now();
    const rows = [
      { createdAt: new Date(base - 6 * HOUR_MS).toISOString(), settledAt: new Date(base - 4 * HOUR_MS).toISOString(), completedAt: null },
      { createdAt: new Date(base - 6 * HOUR_MS).toISOString(), settledAt: new Date(base - 2 * HOUR_MS).toISOString(), completedAt: null },
    ];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/invoices/stats/payment-lag');
    expect(res.status).toBe(200);
    expect(res.body.data.avgLagHours).toBe(3);
  });

  test('200 empty-state — no settled invoices returns all null values', async () => {
    const app = buildApp({ data: [], error: null });
    const res = await request(app).get('/v1/invoices/stats/payment-lag');
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
    expect(res.body.data.avgLagMs).toBeNull();
    expect(res.body.data.avgLagHours).toBeNull();
  });

  test('200 min-max — minLagMs and maxLagMs are correct across multiple invoices', async () => {
    const base = Date.now();
    const rows = [
      { createdAt: new Date(base - 5 * HOUR_MS).toISOString(), settledAt: new Date(base - 4 * HOUR_MS).toISOString(), completedAt: null }, // 1h
      { createdAt: new Date(base - 10 * HOUR_MS).toISOString(), settledAt: new Date(base - 4 * HOUR_MS).toISOString(), completedAt: null }, // 6h
      { createdAt: new Date(base - 13 * HOUR_MS).toISOString(), settledAt: new Date(base - 10 * HOUR_MS).toISOString(), completedAt: null }, // 3h
    ];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/invoices/stats/payment-lag');
    expect(res.status).toBe(200);
    expect(res.body.data.minLagMs).toBe(1 * HOUR_MS);
    expect(res.body.data.maxLagMs).toBe(6 * HOUR_MS);
  });

  test('500 db-error — returns 500 when DB query fails', async () => {
    const app = buildApp({ data: null, error: new Error('DB down') });
    const res = await request(app).get('/v1/invoices/stats/payment-lag');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
