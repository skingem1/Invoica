jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import exportRouter from '../invoices-export';

const mockCreateClient = createClient as jest.Mock;

function buildApp(mockData: any[], mockError: any = null) {
  // Make query a thenable so both `.limit()` (no status) and `.eq()` (with status) work
  const resolved = Promise.resolve({ data: mockData, error: mockError });
  const mockQuery: any = {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
  };
  mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(mockQuery) });

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  const app = express();
  app.use(exportRouter);
  return app;
}

const SAMPLE_INVOICES = [
  {
    id: 'inv-001',
    invoiceNumber: 1,
    status: 'completed',
    amount: 100,
    currency: 'USD',
    customerEmail: 'alice@example.com',
    customerName: 'Alice',
    createdAt: '2026-03-01T00:00:00Z',
    settledAt: '2026-03-02T00:00:00Z',
  },
  {
    id: 'inv-002',
    invoiceNumber: 2,
    status: 'pending',
    amount: 50.5,
    currency: 'EUR',
    customerEmail: 'bob@example.com',
    customerName: 'Bob',
    createdAt: '2026-03-03T00:00:00Z',
    settledAt: null,
  },
];

describe('GET /v1/invoices/export', () => {
  it('returns 200 with text/csv content-type', async () => {
    const app = buildApp(SAMPLE_INVOICES);
    const res = await request(app).get('/v1/invoices/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  it('returns Content-Disposition attachment header with .csv filename', async () => {
    const app = buildApp(SAMPLE_INVOICES);
    const res = await request(app).get('/v1/invoices/export');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="invoices-.*\.csv"/);
  });

  it('CSV includes header row with all 9 columns', async () => {
    const app = buildApp([]);
    const res = await request(app).get('/v1/invoices/export');
    const firstLine = res.text.split('\n')[0];
    expect(firstLine).toBe('id,invoiceNumber,status,amount,currency,customerEmail,customerName,createdAt,settledAt');
  });

  it('CSV data rows match invoice count', async () => {
    const app = buildApp(SAMPLE_INVOICES);
    const res = await request(app).get('/v1/invoices/export');
    const lines = res.text.trim().split('\n');
    // 1 header + 2 data rows
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('inv-001');
    expect(lines[2]).toContain('inv-002');
  });

  it('empty result returns only header row', async () => {
    const app = buildApp([]);
    const res = await request(app).get('/v1/invoices/export');
    const lines = res.text.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('id,invoiceNumber');
  });

  it('handles null settledAt as empty cell', async () => {
    const app = buildApp([SAMPLE_INVOICES[1]]); // Bob with null settledAt
    const res = await request(app).get('/v1/invoices/export');
    const dataLine = res.text.split('\n')[1];
    // Last column should be empty (null settledAt)
    expect(dataLine).toMatch(/,$/);
  });

  it('returns 500 JSON on Supabase error', async () => {
    const app = buildApp([], { message: 'DB error' });
    const res = await request(app).get('/v1/invoices/export');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('accepts status query param without error', async () => {
    const app = buildApp(SAMPLE_INVOICES.slice(0, 1));
    const res = await request(app).get('/v1/invoices/export?status=completed');
    expect(res.status).toBe(200);
  });
});
