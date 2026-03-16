jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import invoiceRouter from '../invoices';

const mockCreateClient = createClient as jest.Mock;

const INVOICE_ROW = {
  id: 'inv-uuid-abc123',
  invoiceNumber: 7,
  status: 'SETTLED',
  amount: 500,
  currency: 'USDC',
  customerEmail: 'payer@example.com',
  customerName: 'Payer Inc',
  companyId: 'agent-001',
  paymentDetails: JSON.stringify({ txHash: '0xabc', network: 'base' }),
  settledAt: '2026-03-10T12:00:00Z',
  completedAt: null,
  createdAt: '2026-03-09T00:00:00Z',
  updatedAt: '2026-03-10T12:00:00Z',
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

describe('GET /v1/invoices/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 with full invoice when found', async () => {
    const app = buildApp({ data: INVOICE_ROW, error: null });
    const res = await request(app).get('/v1/invoices/inv-uuid-abc123');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('inv-uuid-abc123');
    expect(res.body.data.status).toBe('SETTLED');
    expect(res.body.data.amount).toBe(500);
  });

  test('404 when invoice not found', async () => {
    const app = buildApp({ data: null, error: { message: 'not found' } });
    const res = await request(app).get('/v1/invoices/no-such-uuid');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('response includes paymentDetails with txHash and network', async () => {
    const app = buildApp({ data: INVOICE_ROW, error: null });
    const res = await request(app).get('/v1/invoices/inv-uuid-abc123');
    expect(res.body.data.paymentDetails.txHash).toBe('0xabc');
    expect(res.body.data.paymentDetails.network).toBe('base');
  });

  test('response includes settledAt timestamp', async () => {
    const app = buildApp({ data: INVOICE_ROW, error: null });
    const res = await request(app).get('/v1/invoices/inv-uuid-abc123');
    expect(res.body.data.settledAt).toBe('2026-03-10T12:00:00Z');
  });

  test('response shape has all required invoice fields', async () => {
    const app = buildApp({ data: INVOICE_ROW, error: null });
    const res = await request(app).get('/v1/invoices/inv-uuid-abc123');
    const d = res.body.data;
    ['id', 'invoiceNumber', 'status', 'amount', 'currency',
     'customerEmail', 'customerName', 'paymentDetails', 'createdAt', 'updatedAt'].forEach(field => {
      expect(d).toHaveProperty(field);
    });
  });
});
