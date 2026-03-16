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

const TODAY = new Date().toISOString().slice(0, 10);
const SETTLED_ROWS = [
  { amount: 100, status: 'SETTLED', createdAt: new Date().toISOString() },
  { amount: 200, status: 'COMPLETED', createdAt: new Date().toISOString() },
];

function buildMockChain(resolveWith: any) {
  const chain: any = {
    in: jest.fn(),
    gte: jest.fn(),
  };
  chain.in.mockReturnValue(chain);
  chain.gte.mockResolvedValue(resolveWith);
  return chain;
}

describe('GET /v1/metrics/revenue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  test('200 returns-30-days — response data array has exactly 30 entries', async () => {
    const chain = buildMockChain({ data: [], error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(chain) }) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/revenue');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(30);
  });

  test('200 has-date-field — every entry has a date string', async () => {
    const chain = buildMockChain({ data: [], error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(chain) }) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/revenue');
    expect(res.body.data.every((d: any) => typeof d.date === 'string')).toBe(true);
  });

  test('200 has-revenue-field — every entry has a revenue number', async () => {
    const chain = buildMockChain({ data: [], error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(chain) }) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/revenue');
    expect(res.body.data.every((d: any) => typeof d.revenue === 'number')).toBe(true);
  });

  test('200 zeros-for-empty-days — days with no activity have zero revenue', async () => {
    const chain = buildMockChain({ data: SETTLED_ROWS, error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(chain) }) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/revenue');
    // Today's entry should have revenue 300 (100+200)
    const todayEntry = res.body.data.find((d: any) => d.date === TODAY);
    expect(todayEntry).toBeDefined();
    expect(todayEntry.revenue).toBe(300);
    // Non-today entries should have zero
    const others = res.body.data.filter((d: any) => d.date !== TODAY);
    expect(others.every((d: any) => d.revenue === 0)).toBe(true);
  });

  test('500 db-error — returns 500 when DB query fails', async () => {
    const chain = buildMockChain({ data: null, error: new Error('DB down') });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(chain) }) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/revenue');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
