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

const INVOICES = [
  { agentId: 'agent-a', amount: 500, status: 'SETTLED' },
  { agentId: 'agent-a', amount: 300, status: 'COMPLETED' },
  { agentId: 'agent-b', amount: 1000, status: 'SETTLED' },
  { agentId: 'agent-c', amount: 100, status: 'SETTLED' },
];

function buildMockChain(resolveWith: any) {
  const chain: any = {
    select: jest.fn(),
    in:     jest.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.in.mockResolvedValue(resolveWith);
  return chain;
}

describe('GET /v1/metrics/agents/top', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  test('200 returns-array — response has success and data array', async () => {
    const chain = buildMockChain({ data: INVOICES, error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/agents/top');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('200 sorted-by-value — agents sorted by totalSettledAmount DESC', async () => {
    const chain = buildMockChain({ data: INVOICES, error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/agents/top');
    expect(res.status).toBe(200);
    // agent-b: 1000, agent-a: 800, agent-c: 100
    expect(res.body.data[0].agentId).toBe('agent-b');
    expect(res.body.data[1].agentId).toBe('agent-a');
    expect(res.body.data[0].totalSettledAmount).toBeGreaterThan(res.body.data[1].totalSettledAmount);
  });

  test('200 has-required-fields — each entry has agentId, settledCount, totalSettledAmount', async () => {
    const chain = buildMockChain({ data: INVOICES, error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/agents/top');
    expect(res.status).toBe(200);
    const first = res.body.data[0];
    expect(first).toHaveProperty('agentId');
    expect(first).toHaveProperty('settledCount');
    expect(first).toHaveProperty('totalSettledAmount');
  });

  test('200 empty-state — returns empty array when no settled invoices', async () => {
    const chain = buildMockChain({ data: [], error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/agents/top');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('500 db-error — returns 500 when DB query fails', async () => {
    const chain = buildMockChain({ data: null, error: new Error('DB down') });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/agents/top');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
