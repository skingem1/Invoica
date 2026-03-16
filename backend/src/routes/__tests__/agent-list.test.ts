jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import agentRouter from '../agents';

const mockCreateClient = createClient as jest.Mock;

function buildApp(data: any[], error: any = null) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  mockCreateClient.mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ data, error }),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  });

  const app = express();
  app.use(agentRouter);
  return app;
}

const INVOICES = [
  { agentId: 'agent-a', amount: 100, status: 'SETTLED' },
  { agentId: 'agent-a', amount: 50, status: 'PENDING' },
  { agentId: 'agent-b', amount: 200, status: 'COMPLETED' },
  { agentId: 'agent-b', amount: 75, status: 'COMPLETED' },
];

describe('GET /v1/agents', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 returns-array — response contains array of agents', async () => {
    const app = buildApp(INVOICES);
    const res = await request(app).get('/v1/agents');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
  });

  test('200 invoice-count-correct — invoiceCount sums all statuses', async () => {
    const app = buildApp(INVOICES);
    const res = await request(app).get('/v1/agents');
    const agentA = res.body.data.find((a: any) => a.agentId === 'agent-a');
    expect(agentA.invoiceCount).toBe(2);
    const agentB = res.body.data.find((a: any) => a.agentId === 'agent-b');
    expect(agentB.invoiceCount).toBe(2);
  });

  test('200 total-value-settled-correct — only SETTLED/COMPLETED counted', async () => {
    const app = buildApp(INVOICES);
    const res = await request(app).get('/v1/agents');
    const agentA = res.body.data.find((a: any) => a.agentId === 'agent-a');
    expect(agentA.totalValueSettled).toBe(100); // 50 PENDING excluded
    const agentB = res.body.data.find((a: any) => a.agentId === 'agent-b');
    expect(agentB.totalValueSettled).toBe(275);
  });

  test('200 empty-state — returns empty array when no invoices', async () => {
    const app = buildApp([]);
    const res = await request(app).get('/v1/agents');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  test('500 db-error — returns 500 on database failure', async () => {
    const app = buildApp(null as any, new Error('DB down'));
    const res = await request(app).get('/v1/agents');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DB_ERROR');
  });
});
