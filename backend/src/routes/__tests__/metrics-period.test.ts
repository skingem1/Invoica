jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import metricsRouter from '../metrics';

const mockCreateClient = createClient as jest.Mock;

function buildApp(invoices: any[], settlements: any[], reputation: any[], error: any = null) {
  const makeQuery = (data: any[]) => ({
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    mockResult: Promise.resolve({ data: error ? null : data, error }),
    then(res: any, rej: any) { return this.mockResult.then(res, rej); },
  });

  const fromMock = jest.fn()
    .mockReturnValueOnce(makeQuery(invoices))
    .mockReturnValueOnce(makeQuery(settlements))
    .mockReturnValueOnce(makeQuery(reputation));

  mockCreateClient.mockReturnValue({ from: fromMock });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  const app = express();
  app.use(metricsRouter);
  return app;
}

const INVOICES = [{ status: 'PENDING' }, { status: 'COMPLETED' }];
const SETTLEMENTS = [{ id: 'inv-1' }];
const AGENTS = [{ agentId: 'agent-1', score: 75 }];

describe('GET /v1/metrics with period filtering', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 with ?from= returns period.from in response', async () => {
    const app = buildApp(INVOICES, SETTLEMENTS, AGENTS);
    const res = await request(app).get('/v1/metrics?from=2026-03-01T00:00:00Z');
    expect(res.status).toBe(200);
    expect(res.body.period.from).toBe('2026-03-01T00:00:00Z');
    expect(res.body.period.to).toBeNull();
    expect(res.body.invoices.total).toBe(2);
  });

  test('200 with ?to= returns period.to in response', async () => {
    const app = buildApp(INVOICES, SETTLEMENTS, AGENTS);
    const res = await request(app).get('/v1/metrics?to=2026-03-31T23:59:59Z');
    expect(res.status).toBe(200);
    expect(res.body.period.to).toBe('2026-03-31T23:59:59Z');
    expect(res.body.period.from).toBeNull();
  });

  test('200 with both ?from= and ?to= sets period correctly', async () => {
    const app = buildApp(INVOICES, SETTLEMENTS, AGENTS);
    const res = await request(app).get('/v1/metrics?from=2026-03-01T00:00:00Z&to=2026-03-31T23:59:59Z');
    expect(res.status).toBe(200);
    expect(res.body.period.from).toBe('2026-03-01T00:00:00Z');
    expect(res.body.period.to).toBe('2026-03-31T23:59:59Z');
  });

  test('200 without params returns period nulls (backward compatible)', async () => {
    const app = buildApp(INVOICES, SETTLEMENTS, AGENTS);
    const res = await request(app).get('/v1/metrics');
    expect(res.status).toBe(200);
    expect(res.body.period.from).toBeNull();
    expect(res.body.period.to).toBeNull();
    expect(res.body.invoices).toBeDefined();
    expect(res.body.settlements).toBeDefined();
    expect(res.body.reputation).toBeDefined();
  });

  test('500 on database error still returns error shape', async () => {
    const app = buildApp([], [], [], new Error('DB fail'));
    const res = await request(app).get('/v1/metrics?from=2026-03-01T00:00:00Z');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
