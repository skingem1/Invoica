jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import metricsRouter from '../metrics';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(metricsRouter);
  app.use((err: Error, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

function buildMockChain(resolveWith: any) {
  const chain: any = {
    select: jest.fn().mockResolvedValue(resolveWith),
  };
  return chain;
}

describe('GET /v1/metrics/chains/breakdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  test('200 returns-array — returns success:true with data as array', async () => {
    const chain = buildMockChain({ data: [], error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/chains/breakdown');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('200 has-chain-field — each entry has chain, count, and totalAmount fields', async () => {
    const rows = [
      { amount: 100, status: 'SETTLED',   paymentDetails: { network: 'base' } },
      { amount: 50,  status: 'PENDING',   paymentDetails: { network: 'base' } },
    ];
    const chain = buildMockChain({ data: rows, error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/chains/breakdown');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const entry = res.body.data[0];
    expect(entry).toHaveProperty('chain');
    expect(entry).toHaveProperty('count');
    expect(entry).toHaveProperty('totalAmount');
  });

  test('200 has-settled-count — settledCount correctly counts SETTLED+COMPLETED', async () => {
    const rows = [
      { amount: 100, status: 'SETTLED',   paymentDetails: { network: 'polygon' } },
      { amount: 200, status: 'COMPLETED', paymentDetails: { network: 'polygon' } },
      { amount: 50,  status: 'PENDING',   paymentDetails: { network: 'polygon' } },
    ];
    const chain = buildMockChain({ data: rows, error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/chains/breakdown');
    expect(res.status).toBe(200);
    const entry = res.body.data[0];
    expect(entry).toHaveProperty('settledCount', 2);
    expect(entry.count).toBe(3);
  });

  test('200 empty-state — returns empty array when no invoices exist', async () => {
    const chain = buildMockChain({ data: [], error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/chains/breakdown');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test('500 db-error — returns 500 when DB query fails', async () => {
    const chain = buildMockChain({ data: null, error: new Error('DB down') });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/metrics/chains/breakdown');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
