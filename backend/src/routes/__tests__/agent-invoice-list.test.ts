jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import agentRouter from '../agents';

const mockCreateClient = createClient as jest.Mock;

const INVOICES = [
  { id: 'i1', invoiceNumber: 1, status: 'SETTLED', amount: 100, currency: 'USD', customerEmail: 'a@b.com', customerName: 'Alice', createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z' },
  { id: 'i2', invoiceNumber: 2, status: 'PENDING', amount: 50, currency: 'USD', customerEmail: 'a@b.com', customerName: 'Alice', createdAt: '2026-03-02T00:00:00Z', updatedAt: '2026-03-02T00:00:00Z' },
  { id: 'i3', invoiceNumber: 3, status: 'COMPLETED', amount: 200, currency: 'USD', customerEmail: 'a@b.com', customerName: 'Alice', createdAt: '2026-03-03T00:00:00Z', updatedAt: '2026-03-03T00:00:00Z' },
];

function buildApp(data: any[], error: any = null) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  mockCreateClient.mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data, error }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  });

  const app = express();
  app.use(agentRouter);
  return app;
}

describe('GET /v1/agents/:agentId/invoices', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 returns-array — response contains invoice array', async () => {
    const app = buildApp(INVOICES);
    const res = await request(app).get('/v1/agents/agent-001/invoices');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(3);
  });

  test('200 pagination-meta — meta has total, limit, offset, hasMore', async () => {
    const app = buildApp(INVOICES);
    const res = await request(app).get('/v1/agents/agent-001/invoices');
    expect(res.body.meta.total).toBe(3);
    expect(res.body.meta.limit).toBe(20);
    expect(res.body.meta.offset).toBe(0);
    expect(res.body.meta.hasMore).toBe(false);
  });

  test('200 empty-agent — returns empty array with total 0 (no 404)', async () => {
    const app = buildApp([]);
    const res = await request(app).get('/v1/agents/unknown/invoices');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  test('200 limit-param — ?limit=2 returns only 2 invoices', async () => {
    const app = buildApp(INVOICES);
    const res = await request(app).get('/v1/agents/agent-001/invoices?limit=2');
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.hasMore).toBe(true);
  });

  test('500 db-error — returns 500 on database failure', async () => {
    const app = buildApp(null as any, new Error('DB fail'));
    const res = await request(app).get('/v1/agents/agent-001/invoices');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DB_ERROR');
  });
});
