jest.mock('../../lib/prisma', () => ({
  prisma: {},
}));

const mockFindById = jest.fn();
jest.mock('../../services/webhook/types', () => ({
  WebhookRepository: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    listAll: jest.fn(),
    findById: mockFindById,
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

const app = buildApp();

const WEBHOOK = {
  id: 'wh-123',
  url: 'https://example.com/hook',
  events: ['invoice.created', 'invoice.settled'],
  secret: 'supersecretvalue1234',
  createdAt: '2026-03-16T00:00:00.000Z',
};

describe('GET /v1/webhooks/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 returns-webhook — returns the webhook object for a valid ID', async () => {
    mockFindById.mockResolvedValue(WEBHOOK);
    const res = await request(app).get('/v1/webhooks/wh-123');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  test('200 has-id-field — returned webhook has the expected id', async () => {
    mockFindById.mockResolvedValue(WEBHOOK);
    const res = await request(app).get('/v1/webhooks/wh-123');
    expect(res.body.data.id).toBe('wh-123');
  });

  test('200 has-events-array — returned webhook has an events array', async () => {
    mockFindById.mockResolvedValue(WEBHOOK);
    const res = await request(app).get('/v1/webhooks/wh-123');
    expect(Array.isArray(res.body.data.events)).toBe(true);
    expect(res.body.data.events.length).toBeGreaterThan(0);
  });

  test('404 not-found — returns 404 when webhook does not exist', async () => {
    mockFindById.mockResolvedValue(null);
    const res = await request(app).get('/v1/webhooks/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('500 db-error — returns 500 when findById throws', async () => {
    mockFindById.mockRejectedValue(new Error('DB down'));
    const res = await request(app).get('/v1/webhooks/wh-123');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
