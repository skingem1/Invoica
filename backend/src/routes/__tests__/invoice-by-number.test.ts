jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import invoiceRouter from '../invoices';

const mockCreateClient = createClient as jest.Mock;

const INVOICE_ROW = {
  id: 'inv-uuid-001',
  invoiceNumber: 42,
  status: 'PENDING',
  amount: 150,
  currency: 'USDC',
  customerEmail: 'buyer@example.com',
  customerName: 'Buyer Corp',
  companyId: 'co-001',
  paymentDetails: null,
  settledAt: null,
  completedAt: null,
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
};

function buildApp(singleResult: { data: any; error: any }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(singleResult),
  };
  mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  const app = express();
  app.use(express.json());
  app.use(invoiceRouter);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

describe('GET /v1/invoices/number/:number', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 with invoice when found', async () => {
    const app = buildApp({ data: INVOICE_ROW, error: null });
    const res = await request(app).get('/v1/invoices/number/42');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoiceNumber).toBe(42);
    expect(res.body.data.id).toBe('inv-uuid-001');
  });

  test('404 when invoice number not found', async () => {
    const app = buildApp({ data: null, error: { message: 'not found' } });
    const res = await request(app).get('/v1/invoices/number/9999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('400 for non-numeric number param', async () => {
    const app = buildApp({ data: null, error: null });
    const res = await request(app).get('/v1/invoices/number/abc');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_NUMBER');
  });

  test('400 for zero or negative number', async () => {
    const app = buildApp({ data: null, error: null });
    const res = await request(app).get('/v1/invoices/number/0');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_NUMBER');
  });

  test('response shape has required invoice fields', async () => {
    const app = buildApp({ data: INVOICE_ROW, error: null });
    const res = await request(app).get('/v1/invoices/number/42');
    const d = res.body.data;
    expect(d).toHaveProperty('id');
    expect(d).toHaveProperty('invoiceNumber');
    expect(d).toHaveProperty('status');
    expect(d).toHaveProperty('amount');
    expect(d).toHaveProperty('currency');
    expect(d).toHaveProperty('paymentDetails');
  });
});
