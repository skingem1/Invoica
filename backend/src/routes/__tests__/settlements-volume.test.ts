jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import settlementsRouter from '../settlements';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(settlementsRouter);
  app.use((err: Error, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

const NOW = new Date().toISOString();
const ROWS = [
  { amount: 100, settledAt: NOW },
  { amount: 200, settledAt: NOW },
];

function buildMockChain(resolveWith: any) {
  const chain: any = {
    in: jest.fn(),
  };
  chain.in.mockResolvedValue(resolveWith);
  return chain;
}

describe('GET /v1/settlements/volume', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  test('200 returns-shape — response has data with last7d, last30d, allTime', async () => {
    const chain = buildMockChain({ data: ROWS, error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(chain) }) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/settlements/volume');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('last7d');
    expect(res.body.data).toHaveProperty('last30d');
    expect(res.body.data).toHaveProperty('allTime');
  });

  test('200 has-last7d — last7d has count and amount', async () => {
    const chain = buildMockChain({ data: ROWS, error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(chain) }) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/settlements/volume');
    const d = res.body.data;
    expect(d.last7d).toHaveProperty('count');
    expect(d.last7d).toHaveProperty('amount');
    expect(d.last7d.count).toBe(2);
    expect(d.last7d.amount).toBe(300);
  });

  test('200 has-last30d — last30d totals are >= last7d', async () => {
    const chain = buildMockChain({ data: ROWS, error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(chain) }) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/settlements/volume');
    const d = res.body.data;
    expect(d.last30d.count).toBeGreaterThanOrEqual(d.last7d.count);
    expect(d.last30d.amount).toBeGreaterThanOrEqual(d.last7d.amount);
  });

  test('200 zero-when-empty — all periods zero when no settlements', async () => {
    const chain = buildMockChain({ data: [], error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(chain) }) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/settlements/volume');
    const d = res.body.data;
    expect(d.last7d.count).toBe(0);
    expect(d.last30d.amount).toBe(0);
    expect(d.allTime.count).toBe(0);
  });

  test('500 db-error — returns 500 when DB query fails', async () => {
    const chain = buildMockChain({ data: null, error: new Error('DB down') });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(chain) }) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/settlements/volume');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
