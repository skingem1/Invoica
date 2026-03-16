jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import metricsRouter from '../metrics';

const mockCreateClient = createClient as jest.Mock;

function buildApp(data: any[], error: any = null) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  mockCreateClient.mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ data, error }),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  });

  const app = express();
  app.use(metricsRouter);
  return app;
}

describe('GET /v1/metrics/summary', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 returns-kpis — returns all expected fields', async () => {
    const data = [
      { agentId: 'a1', amount: 100, status: 'SETTLED' },
      { agentId: 'a1', amount: 50, status: 'PENDING' },
      { agentId: 'a2', amount: 200, status: 'COMPLETED' },
    ];
    const app = buildApp(data);
    const res = await request(app).get('/v1/metrics/summary');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalInvoices).toBe(3);
    expect(res.body.data.totalAgents).toBe(2);
    expect(res.body.data.totalVolumeSettled).toBe(300);
    expect(res.body.data.avgInvoiceAmount).toBe(116.67);
  });

  test('200 empty-state-zeroes — all zeros when no invoices', async () => {
    const app = buildApp([]);
    const res = await request(app).get('/v1/metrics/summary');
    expect(res.status).toBe(200);
    expect(res.body.data.totalInvoices).toBe(0);
    expect(res.body.data.totalAgents).toBe(0);
    expect(res.body.data.totalVolumeSettled).toBe(0);
    expect(res.body.data.avgInvoiceAmount).toBe(0);
    expect(res.body.data.topAgentId).toBeNull();
  });

  test('200 top-agent-correct — topAgentId is agent with highest settled volume', async () => {
    const data = [
      { agentId: 'a1', amount: 100, status: 'SETTLED' },
      { agentId: 'a2', amount: 500, status: 'COMPLETED' },
      { agentId: 'a2', amount: 300, status: 'SETTLED' },
    ];
    const app = buildApp(data);
    const res = await request(app).get('/v1/metrics/summary');
    expect(res.body.data.topAgentId).toBe('a2');
  });

  test('response-shape-keys — response has all required keys', async () => {
    const app = buildApp([{ agentId: 'x', amount: 10, status: 'PENDING' }]);
    const res = await request(app).get('/v1/metrics/summary');
    expect(res.body.data).toHaveProperty('totalInvoices');
    expect(res.body.data).toHaveProperty('totalAgents');
    expect(res.body.data).toHaveProperty('totalVolumeSettled');
    expect(res.body.data).toHaveProperty('avgInvoiceAmount');
    expect(res.body.data).toHaveProperty('topAgentId');
  });

  test('500 db-error — returns 500 on database failure', async () => {
    const app = buildApp(null as any, new Error('DB fail'));
    const res = await request(app).get('/v1/metrics/summary');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
