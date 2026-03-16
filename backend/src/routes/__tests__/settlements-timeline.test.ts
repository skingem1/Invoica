jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import settlementsRouter from '../settlements';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function buildApp(selectResult: any) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  const chain: any = {
    select: jest.fn().mockReturnThis(),
    in:     jest.fn().mockReturnThis(),
    gte:    jest.fn().mockReturnThis(),
    lte:    jest.fn().mockResolvedValue(selectResult),
  };

  mockCreateClient.mockReturnValue({
    from: jest.fn().mockReturnValue(chain),
  } as any);

  const app = express();
  app.use(express.json());
  app.use(settlementsRouter);
  app.use((err: Error, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

describe('GET /v1/settlements/timeline', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 returns-array — returns success:true with data as array', async () => {
    const app = buildApp({ data: [], error: null });
    const res = await request(app).get('/v1/settlements/timeline?from=2026-03-01&to=2026-03-03');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('200 has-date-field — each entry has date, count, amount fields', async () => {
    const app = buildApp({ data: [], error: null });
    const res = await request(app).get('/v1/settlements/timeline?from=2026-03-01&to=2026-03-02');
    expect(res.status).toBe(200);
    const entry = res.body.data[0];
    expect(entry).toHaveProperty('date');
    expect(entry).toHaveProperty('count');
    expect(entry).toHaveProperty('amount');
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('200 has-count-field — fills all days in range including zeros', async () => {
    const app = buildApp({ data: [], error: null });
    const res = await request(app).get('/v1/settlements/timeline?from=2026-03-01&to=2026-03-05');
    expect(res.status).toBe(200);
    // 5 days: Mar 1, 2, 3, 4, 5
    expect(res.body.data).toHaveLength(5);
    expect(res.body.data.every((d: any) => d.count === 0)).toBe(true);
  });

  test('200 empty-range — single day range returns 1 entry', async () => {
    const app = buildApp({ data: [], error: null });
    const res = await request(app).get('/v1/settlements/timeline?from=2026-03-15&to=2026-03-15');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].date).toBe('2026-03-15');
  });

  test('500 db-error — returns 500 when DB query fails', async () => {
    const app = buildApp({ data: null, error: new Error('DB down') });
    const res = await request(app).get('/v1/settlements/timeline?from=2026-03-01&to=2026-03-05');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
