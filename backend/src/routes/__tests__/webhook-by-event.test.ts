jest.mock('../../lib/prisma', () => ({
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
  app.use(webhookRouter);
  app.use((err: Error, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

const app = buildApp();

const WEBHOOKS = [
  { id: '1', url: 'https://a.com', events: ['invoice.created', 'invoice.settled'] },
  { id: '2', url: 'https://b.com', events: ['invoice.created', 'settlement.confirmed'] },
  { id: '3', url: 'https://c.com', events: ['agent.reputation_changed'] },
];

describe('GET /v1/webhooks/by-event/:eventType', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 returns-array — response has data array and meta', async () => {
    mockListAll.mockResolvedValue(WEBHOOKS);
    const res = await request(app).get('/v1/webhooks/by-event/invoice.created');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.eventType).toBe('invoice.created');
  });

  test('200 total-correct — returns webhooks subscribed to the event', async () => {
    mockListAll.mockResolvedValue(WEBHOOKS);
    const res = await request(app).get('/v1/webhooks/by-event/invoice.created');
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
  });

  test('200 all-have-event — all returned webhooks contain the event type', async () => {
    mockListAll.mockResolvedValue(WEBHOOKS);
    const res = await request(app).get('/v1/webhooks/by-event/settlement.confirmed');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('2');
  });

  test('200 empty-when-no-match — returns empty array when no webhook subscribes to event', async () => {
    mockListAll.mockResolvedValue(WEBHOOKS);
    const res = await request(app).get('/v1/webhooks/by-event/invoice.completed');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  test('500 db-error — returns 500 when listAll throws', async () => {
    mockListAll.mockRejectedValue(new Error('DB down'));
    const res = await request(app).get('/v1/webhooks/by-event/invoice.created');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
