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

function buildMockChain(resolveWith: any) {
  const chain: any = {
    update: jest.fn(),
    in: jest.fn(),
    select: jest.fn(),
  };
  chain.update.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.select.mockResolvedValue(resolveWith);
  return chain;
}

describe('POST /v1/invoices/bulk/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  test('200 returns-updated-count — returns updated count and ids array', async () => {
    const chain = buildMockChain({ data: [{ id: 'inv-1' }, { id: 'inv-2' }], error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app)
      .post('/v1/invoices/bulk/status')
      .send({ ids: ['inv-1', 'inv-2'], status: 'COMPLETED' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.updated).toBe(2);
    expect(Array.isArray(res.body.data.ids)).toBe(true);
  });

  test('200 validates-ids-array — accepts valid ids and status', async () => {
    const chain = buildMockChain({ data: [{ id: 'inv-1' }], error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app)
      .post('/v1/invoices/bulk/status')
      .send({ ids: ['inv-1'], status: 'SETTLED' });
    expect(res.status).toBe(200);
    expect(res.body.data.ids).toContain('inv-1');
  });

  test('400 missing-ids — returns 400 when ids is missing or empty', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/v1/invoices/bulk/status')
      .send({ status: 'COMPLETED' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MISSING_IDS');
  });

  test('400 ids-too-many — returns 400 when ids array exceeds 50', async () => {
    const app = buildApp();
    const ids = Array.from({ length: 51 }, (_, i) => `inv-${i}`);
    const res = await request(app)
      .post('/v1/invoices/bulk/status')
      .send({ ids, status: 'CANCELLED' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOO_MANY_IDS');
  });

  test('500 db-error — returns 500 when DB update fails', async () => {
    const chain = buildMockChain({ data: null, error: new Error('DB down') });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app)
      .post('/v1/invoices/bulk/status')
      .send({ ids: ['inv-1'], status: 'SETTLED' });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
