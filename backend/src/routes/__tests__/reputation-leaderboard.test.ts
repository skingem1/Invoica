import request from 'supertest';
import express from 'express';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';

function makeApp() {
  const app = express();
  app.use(express.json());
  const router = require('../reputation-leaderboard').default;
  app.use(router);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

const app = makeApp();

function buildChain(resolveWith: object) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(resolveWith),
  };
  return chain;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
});

describe('GET /v1/reputation/leaderboard', () => {
  it('returns sorted list with rank field', async () => {
    const mockData = [
      { agentId: 'a1', score: 95, tier: 'platinum', invoicesCompleted: 50, invoicesDisputed: 0, totalValueSettled: 10000, lastUpdated: '2026-01-01' },
      { agentId: 'a2', score: 80, tier: 'gold', invoicesCompleted: 30, invoicesDisputed: 1, totalValueSettled: 5000, lastUpdated: '2026-01-02' },
    ];
    (createClient as jest.Mock).mockReturnValue({ from: jest.fn(() => buildChain({ data: mockData, error: null })) });

    const res = await request(app).get('/v1/reputation/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].rank).toBe(1);
    expect(res.body.data[1].rank).toBe(2);
    expect(res.body.data[0].agentId).toBe('a1');
    expect(res.body.meta.total).toBe(2);
  });

  it('applies tier filter when valid tier provided', async () => {
    const chain = buildChain({ data: [], error: null });
    (createClient as jest.Mock).mockReturnValue({ from: jest.fn(() => chain) });

    await request(app).get('/v1/reputation/leaderboard?tier=gold');
    expect(chain.eq).toHaveBeenCalledWith('tier', 'gold');
  });

  it('ignores invalid tier — no eq filter applied', async () => {
    const chain = buildChain({ data: [], error: null });
    (createClient as jest.Mock).mockReturnValue({ from: jest.fn(() => chain) });

    await request(app).get('/v1/reputation/leaderboard?tier=INVALID');
    expect(chain.eq).not.toHaveBeenCalled();
  });

  it('respects limit param', async () => {
    const chain = buildChain({ data: [], error: null });
    (createClient as jest.Mock).mockReturnValue({ from: jest.fn(() => chain) });

    await request(app).get('/v1/reputation/leaderboard?limit=5');
    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  it('caps limit at 100 even if larger value provided', async () => {
    const chain = buildChain({ data: [], error: null });
    (createClient as jest.Mock).mockReturnValue({ from: jest.fn(() => chain) });

    await request(app).get('/v1/reputation/leaderboard?limit=200');
    expect(chain.limit).toHaveBeenCalledWith(100);
  });
});
