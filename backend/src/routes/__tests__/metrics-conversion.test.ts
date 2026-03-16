jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import metricsRouter from '../metrics';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(metricsRouter);
  app.use((err: Error, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

function buildChain(resolveWith: any) {
  const chain: any = {
    select: jest.fn().mockResolvedValue(resolveWith),
  };
  return chain;
}

describe('GET /v1/metrics/conversion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  test('200 returns-shape — returns success:true with all required fields', async () => {
    const chain = buildChain({ data: [], error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/conversion');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('settled');
    expect(res.body.data).toHaveProperty('cancelled');
    expect(res.body.data).toHaveProperty('pending');
    expect(res.body.data).toHaveProperty('conversionRate');
    expect(res.body.data).toHaveProperty('avgTimeToSettle');
  });

  test('200 has-conversion-rate — conversionRate is calculated correctly', async () => {
    const rows = [
      { status: 'SETTLED',   createdAt: '2026-03-01T00:00:00Z', settledAt: '2026-03-02T00:00:00Z' },
      { status: 'COMPLETED', createdAt: '2026-03-01T00:00:00Z', settledAt: '2026-03-02T00:00:00Z' },
      { status: 'PENDING',   createdAt: '2026-03-05T00:00:00Z', settledAt: null },
      { status: 'CANCELLED', createdAt: '2026-03-03T00:00:00Z', settledAt: null },
    ];
    const chain = buildChain({ data: rows, error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/conversion');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(4);
    expect(res.body.data.settled).toBe(2);
    expect(res.body.data.conversionRate).toBe(50);
  });

  test('200 rate-is-percentage — conversionRate is between 0 and 100', async () => {
    const rows = [
      { status: 'SETTLED', createdAt: '2026-03-01T00:00:00Z', settledAt: '2026-03-01T01:00:00Z' },
    ];
    const chain = buildChain({ data: rows, error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/conversion');
    expect(res.status).toBe(200);
    expect(res.body.data.conversionRate).toBeGreaterThanOrEqual(0);
    expect(res.body.data.conversionRate).toBeLessThanOrEqual(100);
  });

  test('200 zero-when-empty — all zeros when no invoices', async () => {
    const chain = buildChain({ data: [], error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/conversion');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.conversionRate).toBe(0);
    expect(res.body.data.avgTimeToSettle).toBe(0);
  });

  test('500 db-error — returns 500 when DB query fails', async () => {
    const chain = buildChain({ data: null, error: new Error('DB down') });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/conversion');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
