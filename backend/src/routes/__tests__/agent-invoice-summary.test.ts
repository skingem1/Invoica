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

const INVOICES = [
  { status: 'SETTLED',   amount: 500 },
  { status: 'SETTLED',   amount: 300 },
  { status: 'PENDING',   amount: 200 },
  { status: 'CANCELLED', amount: 100 },
];

function buildMockChain(resolveWith: any) {
  const chain: any = {
    select: jest.fn(),
    eq:     jest.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockResolvedValue(resolveWith);
  return chain;
}

describe('GET /v1/agents/:agentId/invoices/summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  test('200 returns-shape — response has agentId, total, byStatus, totalAmount, settledAmount', async () => {
    const chain = buildMockChain({ data: INVOICES, error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/agents/agent-1/invoices/summary');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('agentId', 'agent-1');
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('byStatus');
    expect(res.body.data).toHaveProperty('totalAmount');
    expect(res.body.data).toHaveProperty('settledAmount');
  });

  test('200 counts-by-status — byStatus has correct counts per status', async () => {
    const chain = buildMockChain({ data: INVOICES, error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/agents/agent-1/invoices/summary');
    expect(res.status).toBe(200);
    const { byStatus, total } = res.body.data;
    expect(total).toBe(4);
    expect(byStatus.SETTLED).toBe(2);
    expect(byStatus.PENDING).toBe(1);
    expect(byStatus.CANCELLED).toBe(1);
  });

  test('200 zero-when-empty — returns zeros when agent has no invoices', async () => {
    const chain = buildMockChain({ data: [], error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/agents/no-agent/invoices/summary');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.totalAmount).toBe(0);
    expect(res.body.data.settledAmount).toBe(0);
    expect(res.body.data.byStatus).toEqual({});
  });

  test('200 settled-amount-correct — settledAmount includes only SETTLED and COMPLETED', async () => {
    const chain = buildMockChain({ data: INVOICES, error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/agents/agent-1/invoices/summary');
    expect(res.status).toBe(200);
    // SETTLED: 500+300=800, PENDING: 200, CANCELLED: 100 → totalAmount=1100, settledAmount=800
    expect(res.body.data.settledAmount).toBe(800);
    expect(res.body.data.totalAmount).toBe(1100);
  });

  test('500 db-error — returns 500 when DB query fails', async () => {
    const chain = buildMockChain({ data: null, error: new Error('DB down') });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/agents/agent-1/invoices/summary');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
