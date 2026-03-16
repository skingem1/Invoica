jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import invoiceRouter from '../invoices';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function buildApp(selectResult: any, updateResult?: any) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  let callCount = 0;
  const selectChain: any = {
    select: jest.fn().mockReturnThis(),
    in:     jest.fn().mockReturnThis(),
    eq:     jest.fn(),
  };
  selectChain.eq.mockResolvedValue(selectResult);

  const updateChain: any = {
    update: jest.fn().mockReturnThis(),
    in:     jest.fn(),
  };
  updateChain.in.mockResolvedValue(updateResult || { error: null });

  mockCreateClient.mockReturnValue({
    from: jest.fn().mockImplementation(() => {
      const chain = callCount === 0 ? selectChain : updateChain;
      callCount++;
      return chain;
    }),
  } as any);

  const app = express();
  app.use(express.json());
  app.use(invoiceRouter);
  app.use((err: Error, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

describe('POST /v1/invoices/bulk/cancel', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 returns-cancelled-count — cancels all PENDING invoices and returns count', async () => {
    const selectResult = { data: [{ id: 'inv-1' }, { id: 'inv-2' }], error: null };
    const app = buildApp(selectResult);
    const res = await request(app)
      .post('/v1/invoices/bulk/cancel')
      .send({ ids: ['inv-1', 'inv-2'] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cancelled).toBe(2);
    expect(Array.isArray(res.body.data.ids)).toBe(true);
    expect(res.body.data.skipped).toBe(0);
  });

  test('200 skips-non-pending — only cancels PENDING invoices, reports skipped count', async () => {
    // Only 1 of the 2 requested IDs is PENDING
    const selectResult = { data: [{ id: 'inv-1' }], error: null };
    const app = buildApp(selectResult);
    const res = await request(app)
      .post('/v1/invoices/bulk/cancel')
      .send({ ids: ['inv-1', 'inv-settled'] });
    expect(res.status).toBe(200);
    expect(res.body.data.cancelled).toBe(1);
    expect(res.body.data.skipped).toBe(1);
    expect(res.body.data.ids).toContain('inv-1');
  });

  test('400 missing-ids — returns 400 when ids is missing', async () => {
    const app = buildApp({ data: [], error: null });
    const res = await request(app)
      .post('/v1/invoices/bulk/cancel')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_IDS');
  });

  test('400 too-many-ids — returns 400 when ids array exceeds 50', async () => {
    const app = buildApp({ data: [], error: null });
    const ids = Array.from({ length: 51 }, (_, i) => `inv-${i}`);
    const res = await request(app)
      .post('/v1/invoices/bulk/cancel')
      .send({ ids });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOO_MANY_IDS');
  });

  test('500 db-error — returns 500 when DB fetch fails', async () => {
    const selectResult = { data: null, error: new Error('DB down') };
    const app = buildApp(selectResult);
    const res = await request(app)
      .post('/v1/invoices/bulk/cancel')
      .send({ ids: ['inv-1'] });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
