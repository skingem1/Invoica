jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import agentsRouter from '../agents';

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
  app.use(agentsRouter);
  app.use((err: Error, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

describe('GET /v1/agents/top-earners', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 returns-array — returns success:true with data as array', async () => {
    const rows = [
      { agentId: 'ag-1', amount: 500 },
      { agentId: 'ag-2', amount: 300 },
    ];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/agents/top-earners');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('200 sorted-by-revenue — results sorted by totalRevenue descending', async () => {
    const rows = [
      { agentId: 'ag-1', amount: 100 },
      { agentId: 'ag-2', amount: 500 },
      { agentId: 'ag-3', amount: 250 },
    ];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/agents/top-earners');
    expect(res.status).toBe(200);
    const revenues = res.body.data.map((d: any) => d.totalRevenue);
    expect(revenues[0]).toBeGreaterThanOrEqual(revenues[1]);
  });

  test('200 has-avg-revenue — each entry has avgRevenue calculated correctly', async () => {
    const rows = [
      { agentId: 'ag-1', amount: 100 },
      { agentId: 'ag-1', amount: 300 },
    ];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/agents/top-earners');
    expect(res.status).toBe(200);
    const entry = res.body.data[0];
    expect(entry).toHaveProperty('agentId', 'ag-1');
    expect(entry).toHaveProperty('totalRevenue', 400);
    expect(entry).toHaveProperty('invoiceCount', 2);
    expect(entry).toHaveProperty('avgRevenue', 200);
  });

  test('200 respects-limit — ?limit=2 returns at most 2 agents', async () => {
    const rows = [
      { agentId: 'ag-1', amount: 100 },
      { agentId: 'ag-2', amount: 200 },
      { agentId: 'ag-3', amount: 300 },
      { agentId: 'ag-4', amount: 400 },
    ];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/agents/top-earners?limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  test('500 db-error — returns 500 when DB query fails', async () => {
    const app = buildApp({ data: null, error: new Error('DB down') });
    const res = await request(app).get('/v1/agents/top-earners');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
