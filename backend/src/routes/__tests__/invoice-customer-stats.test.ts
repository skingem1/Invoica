jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import invoiceRouter from '../invoices';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function buildApp(selectResult: any) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  const chain: any = {
    select: jest.fn().mockResolvedValue(selectResult),
  };

  mockCreateClient.mockReturnValue({
    from: jest.fn().mockReturnValue(chain),
  } as any);

  const app = express();
  app.use(express.json());
  app.use(invoiceRouter);
  app.use((err: Error, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

describe('GET /v1/invoices/stats/customers', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 returns-array — returns success:true with data as array', async () => {
    const rows = [
      { customerEmail: 'a@b.com', customerName: 'Alice', amount: 100 },
    ];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/invoices/stats/customers');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('200 has-customer-email — each entry has customerEmail, count, totalAmount', async () => {
    const rows = [
      { customerEmail: 'a@b.com', customerName: 'Alice', amount: 100 },
      { customerEmail: 'a@b.com', customerName: 'Alice', amount: 200 },
    ];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/invoices/stats/customers');
    expect(res.status).toBe(200);
    const entry = res.body.data[0];
    expect(entry).toHaveProperty('customerEmail', 'a@b.com');
    expect(entry).toHaveProperty('count', 2);
    expect(entry).toHaveProperty('totalAmount', 300);
  });

  test('200 sorted-by-amount — results sorted by totalAmount descending', async () => {
    const rows = [
      { customerEmail: 'low@b.com',  customerName: 'Low',  amount: 50  },
      { customerEmail: 'high@b.com', customerName: 'High', amount: 500 },
      { customerEmail: 'mid@b.com',  customerName: 'Mid',  amount: 200 },
    ];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/invoices/stats/customers');
    expect(res.status).toBe(200);
    const amounts = res.body.data.map((d: any) => d.totalAmount);
    expect(amounts[0]).toBeGreaterThanOrEqual(amounts[1]);
  });

  test('200 respects-limit — ?limit=1 returns at most 1 customer', async () => {
    const rows = [
      { customerEmail: 'a@b.com', customerName: 'A', amount: 100 },
      { customerEmail: 'b@b.com', customerName: 'B', amount: 200 },
      { customerEmail: 'c@b.com', customerName: 'C', amount: 300 },
    ];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/invoices/stats/customers?limit=1');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('500 db-error — returns 500 when DB query fails', async () => {
    const app = buildApp({ data: null, error: new Error('DB down') });
    const res = await request(app).get('/v1/invoices/stats/customers');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
