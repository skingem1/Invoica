jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import settlementSummaryRouter from '../settlement-summary';

const mockCreateClient = createClient as jest.Mock;

const SETTLEMENTS = [
  { amount: '100.00', paymentDetails: { network: 'base-mainnet' }, createdAt: '2026-03-01T10:00:00Z', settledAt: '2026-03-01T10:05:00Z' },
  { amount: '200.00', paymentDetails: { network: 'base-mainnet' }, createdAt: '2026-03-02T10:00:00Z', settledAt: '2026-03-02T10:10:00Z' },
  { amount: '150.00', paymentDetails: { network: 'polygon' }, createdAt: '2026-03-03T10:00:00Z', settledAt: '2026-03-03T10:15:00Z' },
];

function buildApp(data: any[], error: any = null) {
  const query: any = {
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({ data, error }),
    eq: jest.fn().mockReturnThis(),
  };
  mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(query) });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  const app = express();
  app.use(settlementSummaryRouter);
  app.use((err: Error, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

describe('GET /v1/settlements/stats', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 returns total, totalValue, byNetwork, and avgSettlementTimeMs', async () => {
    const app = buildApp(SETTLEMENTS);
    const res = await request(app).get('/v1/settlements/stats');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.totalValue).toBe(450);
    expect(res.body.data.byNetwork['base-mainnet'].count).toBe(2);
    expect(res.body.data.byNetwork['polygon'].count).toBe(1);
    expect(typeof res.body.data.avgSettlementTimeMs).toBe('number');
    expect(res.body.data.avgSettlementTimeMs).toBeGreaterThan(0);
  });

  test('200 returns empty stats when no settlements exist', async () => {
    const app = buildApp([]);
    const res = await request(app).get('/v1/settlements/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.totalValue).toBe(0);
    expect(res.body.data.byNetwork).toEqual({});
    expect(res.body.data.avgSettlementTimeMs).toBeNull();
  });

  test('avgSettlementTimeMs is null when no settledAt timestamps present', async () => {
    const noTimestamps = [
      { amount: '100.00', paymentDetails: null, createdAt: null, settledAt: null },
    ];
    const app = buildApp(noTimestamps);
    const res = await request(app).get('/v1/settlements/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.avgSettlementTimeMs).toBeNull();
  });

  test('byNetwork groups correctly with unknown network fallback', async () => {
    const noNetwork = [
      { amount: '50.00', paymentDetails: null, createdAt: '2026-03-01T10:00:00Z', settledAt: '2026-03-01T10:01:00Z' },
    ];
    const app = buildApp(noNetwork);
    const res = await request(app).get('/v1/settlements/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.byNetwork['unknown']).toBeDefined();
    expect(res.body.data.byNetwork['unknown'].count).toBe(1);
  });

  test('500 on database error', async () => {
    const query: any = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: null, error: new Error('DB fail') }),
      eq: jest.fn().mockReturnThis(),
    };
    (mockCreateClient as jest.Mock).mockReturnValue({ from: jest.fn().mockReturnValue(query) });
    const app = express();
    app.use(settlementSummaryRouter);
    app.use((err: Error, _req: any, res: any, _next: any) => {
      res.status(500).json({ success: false, error: { message: err.message } });
    });
    const res = await request(app).get('/v1/settlements/stats');
    expect(res.status).toBe(500);
  });
});
