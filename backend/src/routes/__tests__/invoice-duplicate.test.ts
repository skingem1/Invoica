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

const SOURCE = {
  id: 'src-001', invoiceNumber: 5, status: 'PENDING', amount: '250.00',
  currency: 'USD', customerEmail: 'alice@example.com', customerName: 'Alice',
  companyId: 'co-1', paymentDetails: { network: 'base-mainnet' },
  settledAt: null, completedAt: null,
  createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z',
};
const NEW_INVOICE = {
  id: 'new-001', invoiceNumber: 6, status: 'PENDING', amount: '250.00',
  currency: 'USD', customerEmail: 'alice@example.com', customerName: 'Alice',
  companyId: 'co-1', paymentDetails: { network: 'base-mainnet' },
  settledAt: null, completedAt: null,
  createdAt: '2026-03-16T00:00:00Z', updatedAt: '2026-03-16T00:00:00Z',
};

function buildApp(source: any, sourceErr: any, maxNumber: any, created: any, insertErr: any = null) {
  const fetchQuery: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: source, error: sourceErr }),
  };
  const maxQuery: any = {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: maxNumber, error: null }),
  };
  const insertQuery: any = {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: created, error: insertErr }),
  };
  const fromMock = jest.fn()
    .mockReturnValueOnce(fetchQuery)
    .mockReturnValueOnce(maxQuery)
    .mockReturnValue(insertQuery);

  mockCreateClient.mockReturnValue({ from: fromMock });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  const app = express();
  app.use(express.json());
  app.use(invoicesRouter);
  app.use((err: Error, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message, code: 'INTERNAL_ERROR' } });
  });
  return app;
}

describe('POST /v1/invoices/:id/duplicate', () => {
  beforeEach(() => jest.clearAllMocks());

  test('201 returns new invoice with a different id', async () => {
    const app = buildApp(SOURCE, null, { invoiceNumber: 5 }, NEW_INVOICE);
    const res = await request(app).post('/v1/invoices/src-001/duplicate');
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('new-001');
    expect(res.body.data.id).not.toBe('src-001');
  });

  test('201 new invoice has PENDING status regardless of source', async () => {
    const completed = { ...SOURCE, status: 'COMPLETED' };
    const app = buildApp(completed, null, { invoiceNumber: 5 }, NEW_INVOICE);
    const res = await request(app).post('/v1/invoices/src-001/duplicate');
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
  });

  test('201 new invoice copies customerEmail, customerName, amount, currency', async () => {
    const app = buildApp(SOURCE, null, { invoiceNumber: 5 }, NEW_INVOICE);
    const res = await request(app).post('/v1/invoices/src-001/duplicate');
    expect(res.status).toBe(201);
    expect(res.body.data.customerEmail).toBe('alice@example.com');
    expect(res.body.data.customerName).toBe('Alice');
    expect(res.body.data.amount).toBe('250.00');
    expect(res.body.data.currency).toBe('USD');
  });

  test('404 when source invoice not found', async () => {
    const app = buildApp(null, { message: 'not found' }, null, null);
    const res = await request(app).post('/v1/invoices/missing-id/duplicate');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('500 on insert database error', async () => {
    const app = buildApp(SOURCE, null, { invoiceNumber: 5 }, null, new Error('Insert failed'));
    const res = await request(app).post('/v1/invoices/src-001/duplicate');
    expect(res.status).toBe(500);
  });
});
