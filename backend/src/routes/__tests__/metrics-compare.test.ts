jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import metricsRouter from '../metrics';

const mockCreateClient = createClient as jest.Mock;

// Build app with two sequential .from() calls returning p1Data then p2Data
function buildApp(p1Data: any[], p2Data: any[], error: any = null) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  let callCount = 0;
  mockCreateClient.mockReturnValue({
    from: jest.fn().mockImplementation(() => {
      const idx = callCount++;
      const data = idx === 0 ? p1Data : p2Data;
      return {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({ data, error }),
        in: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  });

  const app = express();
  app.use(metricsRouter);
  return app;
}

const BASE = '/v1/metrics/compare?period1Start=2026-01-01&period1End=2026-01-31&period2Start=2026-02-01&period2End=2026-02-28';

describe('GET /v1/metrics/compare', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('200 with-both-periods — returns period1, period2, and delta', async () => {
    const app = buildApp(
      [{ status: 'SETTLED' }, { status: 'PENDING' }],
      [{ status: 'COMPLETED' }, { status: 'SETTLED' }, { status: 'PENDING' }]
    );
    const res = await request(app).get(BASE);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.period1.invoiceCount).toBe(2);
    expect(res.body.data.period1.settlementCount).toBe(1);
    expect(res.body.data.period2.invoiceCount).toBe(3);
    expect(res.body.data.period2.settlementCount).toBe(2);
    expect(res.body.data.delta.invoiceCount).toBe(1);
    expect(res.body.data.delta.settlementCount).toBe(1);
  });

  test('200 positive-delta — period2 has more invoices than period1', async () => {
    const app = buildApp([{ status: 'PENDING' }], [{ status: 'PENDING' }, { status: 'PENDING' }, { status: 'PENDING' }]);
    const res = await request(app).get(BASE);
    expect(res.status).toBe(200);
    expect(res.body.data.delta.invoiceCount).toBeGreaterThan(0);
  });

  test('200 negative-delta — period2 has fewer invoices than period1', async () => {
    const app = buildApp(
      [{ status: 'SETTLED' }, { status: 'SETTLED' }, { status: 'SETTLED' }],
      [{ status: 'PENDING' }]
    );
    const res = await request(app).get(BASE);
    expect(res.status).toBe(200);
    expect(res.body.data.delta.invoiceCount).toBeLessThan(0);
    expect(res.body.data.delta.settlementCount).toBeLessThan(0);
  });

  test('400 missing-params — missing required query params', async () => {
    const app = buildApp([], []);
    const res = await request(app).get('/v1/metrics/compare?period1Start=2026-01-01');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MISSING_PARAMS');
  });

  test('500 db-error — database error returns 500', async () => {
    const app = buildApp(null as any, null as any, new Error('DB down'));
    const res = await request(app).get(BASE);
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
