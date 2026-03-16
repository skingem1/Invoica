jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import agentRouter from '../agents';

const mockCreateClient = createClient as jest.Mock;

function buildApp(reputationResult: any, invoicesResult: any) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  mockCreateClient.mockReturnValue({
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'AgentReputation') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue(reputationResult),
        };
      }
      // Invoice table
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue(invoicesResult),
      };
    }),
  });

  const app = express();
  app.use(agentRouter);
  return app;
}

describe('GET /v1/agents/:agentId', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 full-profile — returns reputation and invoice stats', async () => {
    const app = buildApp(
      { data: { score: 88, tier: 'gold' }, error: null },
      {
        data: [
          { status: 'SETTLED', amount: 100 },
          { status: 'COMPLETED', amount: 200 },
          { status: 'PENDING', amount: 50 },
        ],
        error: null,
      }
    );
    const res = await request(app).get('/v1/agents/agent-001');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agentId).toBe('agent-001');
    expect(res.body.data.reputation).toEqual({ score: 88, tier: 'gold' });
    expect(res.body.data.invoices.total).toBe(3);
    expect(res.body.data.invoices.byStatus['SETTLED']).toBe(1);
    expect(res.body.data.invoices.byStatus['COMPLETED']).toBe(1);
    expect(res.body.data.totalValueSettled).toBe(300);
  });

  test('200 no-reputation — agent has invoices but no reputation entry', async () => {
    const app = buildApp(
      { data: null, error: null },
      { data: [{ status: 'PENDING', amount: 75 }], error: null }
    );
    const res = await request(app).get('/v1/agents/agent-002');
    expect(res.status).toBe(200);
    expect(res.body.data.reputation).toBeNull();
    expect(res.body.data.invoices.total).toBe(1);
  });

  test('200 no-invoices — agent has reputation but no invoices', async () => {
    const app = buildApp(
      { data: { score: 72, tier: 'silver' }, error: null },
      { data: [], error: null }
    );
    const res = await request(app).get('/v1/agents/agent-003');
    expect(res.status).toBe(200);
    expect(res.body.data.reputation).toEqual({ score: 72, tier: 'silver' });
    expect(res.body.data.invoices.total).toBe(0);
    expect(res.body.data.totalValueSettled).toBe(0);
  });

  test('404 agent-not-found — no invoices AND no reputation', async () => {
    const app = buildApp(
      { data: null, error: null },
      { data: [], error: null }
    );
    const res = await request(app).get('/v1/agents/unknown-agent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('500 db-error — database failure returns 500', async () => {
    const app = buildApp(
      { data: null, error: new Error('DB down') },
      { data: null, error: null }
    );
    const res = await request(app).get('/v1/agents/agent-x');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DB_ERROR');
  });
});
