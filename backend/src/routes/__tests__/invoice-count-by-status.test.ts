jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import invoicesRouter from '../invoices';

const mockCreateClient = createClient as jest.Mock;

function buildApp(data: any[], error: any = null) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  mockCreateClient.mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ data, error }),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: new Error('not found') }),
      update: jest.fn().mockReturnThis(),
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(invoicesRouter);
  app.use((err: Error, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

const INVOICES = [
  { status: 'PENDING' },
  { status: 'PENDING' },
  { status: 'SETTLED' },
  { status: 'COMPLETED' },
  { status: 'CANCELLED' },
];

describe('GET /v1/invoices/count', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 returns-total — total equals all invoice count', async () => {
    const app = buildApp(INVOICES);
    const res = await request(app).get('/v1/invoices/count');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBe(5);
  });

  test('200 by-status-correct — counts per status are accurate', async () => {
    const app = buildApp(INVOICES);
    const res = await request(app).get('/v1/invoices/count');
    expect(res.body.data.byStatus.PENDING).toBe(2);
    expect(res.body.data.byStatus.SETTLED).toBe(1);
    expect(res.body.data.byStatus.COMPLETED).toBe(1);
    expect(res.body.data.byStatus.CANCELLED).toBe(1);
  });

  test('200 zero-counts-included — all 6 statuses present even if zero', async () => {
    const app = buildApp([{ status: 'PENDING' }]);
    const res = await request(app).get('/v1/invoices/count');
    const s = res.body.data.byStatus;
    expect(s).toHaveProperty('PENDING');
    expect(s).toHaveProperty('PROCESSING');
    expect(s).toHaveProperty('SETTLED');
    expect(s).toHaveProperty('COMPLETED');
    expect(s).toHaveProperty('CANCELLED');
    expect(s).toHaveProperty('REFUNDED');
    expect(s.PROCESSING).toBe(0);
  });

  test('200 empty-state — total 0 and all statuses zero', async () => {
    const app = buildApp([]);
    const res = await request(app).get('/v1/invoices/count');
    expect(res.body.data.total).toBe(0);
    expect(Object.values(res.body.data.byStatus).every((v) => v === 0)).toBe(true);
  });

  test('500 db-error — returns 500 on database failure', async () => {
    const app = buildApp(null as any, new Error('DB down'));
    const res = await request(app).get('/v1/invoices/count');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
