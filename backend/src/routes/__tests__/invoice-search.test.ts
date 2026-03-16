jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));
jest.mock('../../services/tax/calculator', () => ({
  calculateTax: jest.fn(),
  US_NEXUS_RATES: {},
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import invoicesRouter from '../invoices';

const mockCreateClient = createClient as jest.Mock;

const INVOICE_EMAIL = {
  id: 'inv-001', invoiceNumber: 1, status: 'PENDING', amount: '100.00',
  currency: 'USD', customerEmail: 'alice@example.com', customerName: 'Alice',
  companyId: null, paymentDetails: null, settledAt: null, completedAt: null,
  createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z',
};
const INVOICE_NAME = {
  id: 'inv-002', invoiceNumber: 2, status: 'PENDING', amount: '200.00',
  currency: 'USD', customerEmail: 'bob@other.com', customerName: 'Bob Smith',
  companyId: null, paymentDetails: null, settledAt: null, completedAt: null,
  createdAt: '2026-03-02T00:00:00Z', updatedAt: '2026-03-02T00:00:00Z',
};

function buildApp(data: any[], error: any = null) {
  const query: any = {
    select: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data, error }),
    single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
  };
  mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(query) });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  const app = express();
  app.use(express.json());
  app.use(invoicesRouter);
  return app;
}

describe('GET /v1/invoices/search', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 returns invoices matching customer email', async () => {
    const app = buildApp([INVOICE_EMAIL]);
    const res = await request(app).get('/v1/invoices/search?q=alice');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].customerEmail).toBe('alice@example.com');
    expect(res.body.meta.query).toBe('alice');
    expect(res.body.meta.count).toBe(1);
  });

  test('200 returns invoices matching customer name', async () => {
    const app = buildApp([INVOICE_NAME]);
    const res = await request(app).get('/v1/invoices/search?q=Bob');
    expect(res.status).toBe(200);
    expect(res.body.data[0].customerName).toBe('Bob Smith');
  });

  test('200 returns empty array when no matches found', async () => {
    const app = buildApp([]);
    const res = await request(app).get('/v1/invoices/search?q=nomatch');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.count).toBe(0);
  });

  test('400 when query is too short (1 char)', async () => {
    const app = buildApp([]);
    const res = await request(app).get('/v1/invoices/search?q=a');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('QUERY_TOO_SHORT');
  });

  test('400 when q param is missing', async () => {
    const app = buildApp([]);
    const res = await request(app).get('/v1/invoices/search');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('QUERY_TOO_SHORT');
  });

  test('500 on database error', async () => {
    const app = buildApp(null as any, new Error('DB fail'));
    const res = await request(app).get('/v1/invoices/search?q=alice');
    expect(res.status).toBe(500);
  });
});
