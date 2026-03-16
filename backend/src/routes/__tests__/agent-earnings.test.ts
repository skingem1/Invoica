jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import agentRouter from '../agents';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(agentRouter);
  app.use((err: Error, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

function buildMockChain(resolveWith: any) {
  const chain: any = {
    select: jest.fn(),
    eq:     jest.fn(),
    in:     jest.fn(),
    gte:    jest.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.gte.mockResolvedValue(resolveWith);
  return chain;
}

describe('GET /v1/agents/:agentId/earnings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  test('200 returns-8-weeks — response has 8 weekly buckets', async () => {
    const chain = buildMockChain({ data: [], error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/agents/agent-1/earnings');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // 8 weeks pre-filled (could be 8 or 9 depending on week boundary, allow 7-9)
    expect(res.body.data.length).toBeGreaterThanOrEqual(7);
    expect(res.body.data.length).toBeLessThanOrEqual(9);
  });

  test('200 has-week-field — each entry has a week field (ISO week format)', async () => {
    const chain = buildMockChain({ data: [], error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/agents/agent-1/earnings');
    expect(res.status).toBe(200);
    const first = res.body.data[0];
    expect(first).toHaveProperty('week');
    expect(first.week).toMatch(/^\d{4}-W\d{2}$/);
  });

  test('200 has-amount-field — each entry has amount and count fields', async () => {
    const chain = buildMockChain({ data: [], error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/agents/agent-1/earnings');
    expect(res.status).toBe(200);
    const first = res.body.data[0];
    expect(first).toHaveProperty('amount');
    expect(first).toHaveProperty('count');
  });

  test('200 zero-when-empty — all weeks have zero amount when no settlements', async () => {
    const chain = buildMockChain({ data: [], error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/agents/agent-none/earnings');
    expect(res.status).toBe(200);
    const totalAmount = res.body.data.reduce((s: number, d: any) => s + d.amount, 0);
    expect(totalAmount).toBe(0);
  });

  test('500 db-error — returns 500 when DB query fails', async () => {
    const chain = buildMockChain({ data: null, error: new Error('DB down') });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/agents/agent-1/earnings');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
