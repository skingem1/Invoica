jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import settlementsRouter from '../settlements';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(settlementsRouter);
  app.use((err: Error, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

const PROCESSING_ROWS = [
  { id: 'inv-1', invoiceNumber: 5, status: 'PROCESSING', amount: 100, currency: 'USD', agentId: 'agent-a', createdAt: '2026-03-16T09:00:00Z', updatedAt: '2026-03-16T09:00:00Z' },
  { id: 'inv-2', invoiceNumber: 4, status: 'PROCESSING', amount: 200, currency: 'USD', agentId: 'agent-b', createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-15T09:00:00Z' },
];

function buildMockChain(resolveWith: any) {
  const chain: any = {
    eq: jest.fn(),
    order: jest.fn(),
  };
  chain.eq.mockReturnValue(chain);
  chain.order.mockResolvedValue(resolveWith);
  return chain;
}

describe('GET /v1/settlements/pending', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  test('200 returns-array — response has data array and meta', async () => {
    const chain = buildMockChain({ data: PROCESSING_ROWS, error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(chain) }) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/settlements/pending');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
  });

  test('200 only-processing-status — all returned rows have PROCESSING status', async () => {
    const chain = buildMockChain({ data: PROCESSING_ROWS, error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(chain) }) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/settlements/pending');
    expect(res.body.data.every((r: any) => r.status === 'PROCESSING')).toBe(true);
    // Verify eq was called with PROCESSING filter
    expect(chain.eq).toHaveBeenCalledWith('status', 'PROCESSING');
  });

  test('200 total-correct — meta.total matches data length', async () => {
    const chain = buildMockChain({ data: PROCESSING_ROWS, error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(chain) }) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/settlements/pending');
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
  });

  test('200 empty-state — returns empty array and total 0 when none pending', async () => {
    const chain = buildMockChain({ data: [], error: null });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(chain) }) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/settlements/pending');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  test('500 db-error — returns 500 when DB query fails', async () => {
    const chain = buildMockChain({ data: null, error: new Error('DB down') });
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(chain) }) } as any);
    const app = buildApp();
    const res = await request(app).get('/v1/settlements/pending');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
