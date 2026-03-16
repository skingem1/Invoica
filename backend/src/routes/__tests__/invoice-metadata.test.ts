jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import invoiceRouter from '../invoices';

const mockCreateClient = createClient as jest.Mock;

const EXISTING_ROW = {
  id: 'inv-001',
  invoiceNumber: 1, status: 'PENDING', amount: 100, currency: 'USDC',
  customerEmail: 'a@b.com', customerName: 'Test', companyId: null,
  paymentDetails: JSON.stringify({ txHash: '0xabc' }),
  settledAt: null, completedAt: null,
  createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z',
};

function buildApp(fetchResult: { data: any; error: any }, updateResult: { data: any; error: any }) {
  const fetchChain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(fetchResult),
  };
  const updateChain: any = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(updateResult),
  };
  const fromMock = jest.fn()
    .mockReturnValueOnce(fetchChain)
    .mockReturnValueOnce(updateChain);
  mockCreateClient.mockReturnValue({ from: fromMock });
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

const UPDATED_ROW = { ...EXISTING_ROW, paymentDetails: JSON.stringify({ txHash: '0xabc', note: 'test note' }), updatedAt: '2026-03-16T00:00:00Z' };

describe('PATCH /v1/invoices/:id/metadata', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 success merges metadata into paymentDetails', async () => {
    const app = buildApp({ data: EXISTING_ROW, error: null }, { data: UPDATED_ROW, error: null });
    const res = await request(app).patch('/v1/invoices/inv-001/metadata').send({ metadata: { note: 'test note' } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('400 when metadata is not an object', async () => {
    const app = buildApp({ data: null, error: null }, { data: null, error: null });
    const res = await request(app).patch('/v1/invoices/inv-001/metadata').send({ metadata: 'invalid' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_METADATA');
  });

  test('400 when metadata is an array', async () => {
    const app = buildApp({ data: null, error: null }, { data: null, error: null });
    const res = await request(app).patch('/v1/invoices/inv-001/metadata').send({ metadata: [1, 2, 3] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_METADATA');
  });

  test('400 when metadata exceeds 20 keys', async () => {
    const bigMetadata = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`key${i}`, i]));
    const app = buildApp({ data: null, error: null }, { data: null, error: null });
    const res = await request(app).patch('/v1/invoices/inv-001/metadata').send({ metadata: bigMetadata });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_METADATA');
  });

  test('404 when invoice not found', async () => {
    const app = buildApp({ data: null, error: { message: 'not found' } }, { data: null, error: null });
    const res = await request(app).patch('/v1/invoices/no-such-id/metadata').send({ metadata: { key: 'val' } });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
