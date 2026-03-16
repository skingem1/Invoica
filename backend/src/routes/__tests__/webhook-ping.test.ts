jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  prisma: {},
}));

const mockFindById = jest.fn();
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

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

const app = express();
app.use(express.json());
app.use(webhookRouter);
app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(500).json({ success: false, error: { message: err.message } });
});

const WEBHOOK = { id: 'wh-001', url: 'https://example.com/hook', events: ['invoice.settled'], secret: 'supersecretvalue16' };

describe('POST /v1/webhooks/:id/test', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 delivered when endpoint responds with 2xx', async () => {
    mockFindById.mockResolvedValue(WEBHOOK);
    mockFetch.mockResolvedValue({ status: 200 });

    const res = await request(app).post('/v1/webhooks/wh-001/test');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('delivered');
    expect(res.body.data.responseCode).toBe(200);
    expect(typeof res.body.data.latencyMs).toBe('number');
  });

  test('200 delivered when endpoint responds with 4xx (not our failure)', async () => {
    mockFindById.mockResolvedValue(WEBHOOK);
    mockFetch.mockResolvedValue({ status: 404 });

    const res = await request(app).post('/v1/webhooks/wh-001/test');
    expect(res.body.data.status).toBe('delivered');
    expect(res.body.data.responseCode).toBe(404);
  });

  test('200 failed when endpoint responds with 5xx', async () => {
    mockFindById.mockResolvedValue(WEBHOOK);
    mockFetch.mockResolvedValue({ status: 500 });

    const res = await request(app).post('/v1/webhooks/wh-001/test');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('failed');
    expect(res.body.data.responseCode).toBe(500);
  });

  test('200 failed when fetch throws (network error / timeout)', async () => {
    mockFindById.mockResolvedValue(WEBHOOK);
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await request(app).post('/v1/webhooks/wh-001/test');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('failed');
    expect(res.body.data.responseCode).toBeNull();
  });

  test('404 when webhook not found', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await request(app).post('/v1/webhooks/no-such-id/test');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
