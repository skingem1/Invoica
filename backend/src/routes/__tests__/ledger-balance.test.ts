jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import ledgerRouter from '../ledger';

const mockCreateClient = createClient as jest.Mock;

function buildApp(data: any[], error: any = null) {
  const query: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ data, error }),
  };
  mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(query) });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  const app = express();
  app.use(ledgerRouter);
  return app;
}

describe('GET /v1/ledger/:agentId/balance', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 with-entries — returns totalCredits, totalDebits, balance', async () => {
    const data = [
      { status: 'SETTLED', amount: 100 },
      { status: 'COMPLETED', amount: 50 },
      { status: 'REFUNDED', amount: 30 },
    ];
    const app = buildApp(data);
    const res = await request(app).get('/v1/ledger/agent-123/balance');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agentId).toBe('agent-123');
    expect(res.body.data.totalDebits).toBe(150);
    expect(res.body.data.totalCredits).toBe(30);
    expect(res.body.data.balance).toBe(-120);
  });

  test('200 zero-balance — agent with no debits or credits (DRAFT only)', async () => {
    const data = [
      { status: 'DRAFT', amount: 200 },
    ];
    const app = buildApp(data);
    const res = await request(app).get('/v1/ledger/agent-zero/balance');
    expect(res.status).toBe(200);
    expect(res.body.data.totalDebits).toBe(0);
    expect(res.body.data.totalCredits).toBe(0);
    expect(res.body.data.balance).toBe(0);
  });

  test('200 credits-only — all invoices REFUNDED', async () => {
    const data = [
      { status: 'REFUNDED', amount: 75 },
      { status: 'REFUNDED', amount: 25 },
    ];
    const app = buildApp(data);
    const res = await request(app).get('/v1/ledger/agent-refund/balance');
    expect(res.status).toBe(200);
    expect(res.body.data.totalCredits).toBe(100);
    expect(res.body.data.totalDebits).toBe(0);
    expect(res.body.data.balance).toBe(100);
  });

  test('404 not-found — agent has no invoices', async () => {
    const app = buildApp([]);
    const res = await request(app).get('/v1/ledger/unknown-agent/balance');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('500 db-error — database failure returns 500', async () => {
    const app = buildApp(null as any, new Error('DB down'));
    const res = await request(app).get('/v1/ledger/agent-x/balance');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DB_ERROR');
  });
});
