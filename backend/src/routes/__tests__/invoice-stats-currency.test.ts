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

describe('GET /v1/invoices/stats/currency', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 returns-array — returns success:true with data as an array', async () => {
    const rows = [
      { currency: 'USDC', amount: 100 },
      { currency: 'ETH',  amount: 50  },
    ];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/invoices/stats/currency');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('200 has-currency-field — each entry has currency, count, totalAmount fields', async () => {
    const rows = [
      { currency: 'USDC', amount: 100 },
      { currency: 'USDC', amount: 200 },
    ];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/invoices/stats/currency');
    expect(res.status).toBe(200);
    const entry = res.body.data[0];
    expect(entry).toHaveProperty('currency');
    expect(entry).toHaveProperty('count');
    expect(entry).toHaveProperty('totalAmount');
    expect(entry.count).toBe(2);
    expect(entry.totalAmount).toBe(300);
  });

  test('200 sorted-by-amount — results sorted by totalAmount descending', async () => {
    const rows = [
      { currency: 'ETH',  amount: 50  },
      { currency: 'USDC', amount: 500 },
      { currency: 'SOL',  amount: 200 },
    ];
    const app = buildApp({ data: rows, error: null });
    const res = await request(app).get('/v1/invoices/stats/currency');
    expect(res.status).toBe(200);
    const amounts = res.body.data.map((d: any) => d.totalAmount);
    expect(amounts[0]).toBeGreaterThanOrEqual(amounts[1]);
    expect(amounts[1]).toBeGreaterThanOrEqual(amounts[2]);
  });

  test('200 empty-state — returns empty array when no invoices exist', async () => {
    const app = buildApp({ data: [], error: null });
    const res = await request(app).get('/v1/invoices/stats/currency');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test('500 db-error — returns 500 when DB query fails', async () => {
    const app = buildApp({ data: null, error: new Error('DB down') });
    const res = await request(app).get('/v1/invoices/stats/currency');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
