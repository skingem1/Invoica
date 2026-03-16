jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import settlementsRouter from '../settlements';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function buildApp(selectResult: any) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  const chain: any = {
    select: jest.fn().mockReturnThis(),
    in:     jest.fn().mockResolvedValue(selectResult),
  };

  mockCreateClient.mockReturnValue({
    from: jest.fn().mockReturnValue(chain),
  } as any);

  const app = express();
  app.use(express.json());
  app.use(settlementsRouter);
  app.use((err: Error, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

describe('GET /v1/settlements/by-agent', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 returns-array — returns success:true with data as array', async () => {
    const rows = [
      { agentId: 'ag-1', amount: 100 },
      { agentId: 'ag-2', amount: 200 },
    ];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/settlements/by-agent');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('200 sorted-by-amount — results sorted by totalAmount descending', async () => {
    const rows = [
      { agentId: 'ag-1', amount: 100 },
      { agentId: 'ag-2', amount: 500 },
      { agentId: 'ag-3', amount: 250 },
    ];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/settlements/by-agent');
    expect(res.status).toBe(200);
    const amounts = res.body.data.map((d: any) => d.totalAmount);
    expect(amounts[0]).toBeGreaterThanOrEqual(amounts[1]);
    if (amounts.length > 2) expect(amounts[1]).toBeGreaterThanOrEqual(amounts[2]);
  });

  test('200 has-required-fields — each entry has agentId, count, totalAmount', async () => {
    const rows = [
      { agentId: 'ag-1', amount: 150 },
      { agentId: 'ag-1', amount: 50  },
    ];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/settlements/by-agent');
    expect(res.status).toBe(200);
    const entry = res.body.data[0];
    expect(entry).toHaveProperty('agentId', 'ag-1');
    expect(entry).toHaveProperty('count', 2);
    expect(entry).toHaveProperty('totalAmount', 200);
  });

  test('200 respects-limit — ?limit=1 returns at most 1 result', async () => {
    const rows = [
      { agentId: 'ag-1', amount: 100 },
      { agentId: 'ag-2', amount: 200 },
      { agentId: 'ag-3', amount: 300 },
    ];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/settlements/by-agent?limit=1');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('500 db-error — returns 500 when DB query fails', async () => {
    const app = buildApp({ data: null, error: new Error('DB down') });
    const res = await request(app).get('/v1/settlements/by-agent');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
