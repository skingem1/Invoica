jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  prisma: {},
}));

const mockListAll = jest.fn();

jest.mock('../../services/webhook/types', () => ({
  WebhookRepository: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    listAll: mockListAll,
    findById: jest.fn(),
    delete: jest.fn(),
  })),
}));

import express from 'express';
import request from 'supertest';
import webhookRouter from '../webhooks';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(webhookRouter);
  app.use((err: Error, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

const WEBHOOKS = [
  { id: 'wh-1', url: 'https://a.com/hook', events: ['invoice.created'], active: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'wh-2', url: 'https://b.com/hook', events: ['invoice.settled'], active: true, createdAt: '2026-01-02T00:00:00Z' },
  { id: 'wh-3', url: 'https://c.com/hook', events: ['invoice.cancelled'], active: false, createdAt: '2026-01-03T00:00:00Z' },
];

describe('GET /v1/webhooks (paginated)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 returns-array — returns success:true with data as array', async () => {
    mockListAll.mockResolvedValue(WEBHOOKS);
    const app = buildApp();
    const res = await request(app).get('/v1/webhooks');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('200 has-meta — response includes meta with total, limit, offset', async () => {
    mockListAll.mockResolvedValue(WEBHOOKS);
    const app = buildApp();
    const res = await request(app).get('/v1/webhooks');
    expect(res.status).toBe(200);
    expect(res.body.meta).toHaveProperty('total', 3);
    expect(res.body.meta).toHaveProperty('limit');
    expect(res.body.meta).toHaveProperty('offset');
  });

  test('200 respects-limit — ?limit=2 returns at most 2 items', async () => {
    mockListAll.mockResolvedValue(WEBHOOKS);
    const app = buildApp();
    const res = await request(app).get('/v1/webhooks?limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.limit).toBe(2);
    expect(res.body.meta.total).toBe(3);
  });

  test('200 empty-state — returns empty array when no webhooks exist', async () => {
    mockListAll.mockResolvedValue([]);
    const app = buildApp();
    const res = await request(app).get('/v1/webhooks');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.total).toBe(0);
  });

  test('500 db-error — returns 500 when repo throws', async () => {
    mockListAll.mockRejectedValue(new Error('DB down'));
    const app = buildApp();
    const res = await request(app).get('/v1/webhooks');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
