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

const ROWS = [
  { currency: 'USD', amount: 100 },
  { currency: 'USD', amount: 200 },
  { currency: 'USD', amount: 150 },
  { currency: 'EUR', amount: 300 },
  { currency: 'EUR', amount: 100 },
];

describe('GET /v1/metrics/top-currencies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  test('200 returns-array — response has success and data array', async () => {
    mockCreateClient.mockReturnValue({
      from: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ data: ROWS, error: null }) }),
    } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/top-currencies');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('200 sorted-by-count — data is sorted by invoiceCount descending', async () => {
    mockCreateClient.mockReturnValue({
      from: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ data: ROWS, error: null }) }),
    } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/top-currencies');
    const data = res.body.data;
    expect(data[0].currency).toBe('USD');
    expect(data[0].invoiceCount).toBe(3);
    expect(data[1].currency).toBe('EUR');
    expect(data[1].invoiceCount).toBe(2);
  });

  test('200 has-total-amount — each entry has totalAmount number', async () => {
    mockCreateClient.mockReturnValue({
      from: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ data: ROWS, error: null }) }),
    } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/top-currencies');
    expect(res.body.data[0].totalAmount).toBe(450); // 100+200+150
    expect(res.body.data.every((d: any) => typeof d.totalAmount === 'number')).toBe(true);
  });

  test('200 empty-state — returns empty array when no invoices', async () => {
    mockCreateClient.mockReturnValue({
      from: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ data: [], error: null }) }),
    } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/top-currencies');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('500 db-error — returns 500 when DB query fails', async () => {
    mockCreateClient.mockReturnValue({
      from: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ data: null, error: new Error('DB down') }) }),
    } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/top-currencies');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
