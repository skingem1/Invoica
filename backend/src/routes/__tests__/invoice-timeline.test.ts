jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import invoiceRouter from '../invoices';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(invoiceRouter);
  app.use((err: Error, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

const PENDING_INVOICE = {
  id: 'inv-1',
  status: 'PENDING',
  createdAt: '2026-03-10T10:00:00Z',
  settledAt: null,
  completedAt: null,
};

const SETTLED_INVOICE = {
  id: 'inv-2',
  status: 'SETTLED',
  createdAt: '2026-03-10T10:00:00Z',
  settledAt: '2026-03-11T12:00:00Z',
  completedAt: null,
};

function buildMockSingle(resolveWith: any) {
  return {
    eq: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue(resolveWith),
    }),
  };
}

describe('GET /v1/invoices/:id/timeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  test('200 returns-array — response has data array and meta', async () => {
    mockCreateClient.mockReturnValue({
      from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(buildMockSingle({ data: PENDING_INVOICE, error: null })) }),
    } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/invoices/inv-1/timeline');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
  });

  test('200 has-meta — meta contains invoiceId and currentStatus', async () => {
    mockCreateClient.mockReturnValue({
      from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(buildMockSingle({ data: PENDING_INVOICE, error: null })) }),
    } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/invoices/inv-1/timeline');
    expect(res.body.meta.invoiceId).toBe('inv-1');
    expect(res.body.meta.currentStatus).toBe('PENDING');
  });

  test('200 pending-always-first — first event is always PENDING', async () => {
    mockCreateClient.mockReturnValue({
      from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(buildMockSingle({ data: SETTLED_INVOICE, error: null })) }),
    } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/invoices/inv-2/timeline');
    expect(res.body.data[0].status).toBe('PENDING');
    expect(res.body.data.some((e: any) => e.status === 'SETTLED')).toBe(true);
  });

  test('404 not-found — returns 404 when invoice does not exist', async () => {
    mockCreateClient.mockReturnValue({
      from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(buildMockSingle({ data: null, error: new Error('not found') })) }),
    } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/invoices/nonexistent/timeline');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('500 db-error — returns 500 when DB throws', async () => {
    mockCreateClient.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('DB down')),
          }),
        }),
      }),
    } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/invoices/inv-1/timeline');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
