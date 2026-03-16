jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  prisma: {},
}));

const mockRegister = jest.fn();
const mockListAll = jest.fn();
const mockFindById = jest.fn();
const mockDelete = jest.fn();

jest.mock('../../services/webhook/types', () => ({
  WebhookRepository: jest.fn().mockImplementation(() => ({
    register: mockRegister,
    listAll: mockListAll,
    findById: mockFindById,
    delete: mockDelete,
  })),
}));

import express from 'express';
import request from 'supertest';
import webhookRouter from '../webhooks';

const app = express();
app.use(express.json());
app.use(webhookRouter);

const WEBHOOK = {
  id: 'wh-001',
  url: 'https://example.com/hook',
  events: ['invoice.settled'],
  secret: 'supersecretvalue16',
  createdAt: '2026-03-01T00:00:00Z',
};

describe('POST /v1/webhooks', () => {
  beforeEach(() => jest.clearAllMocks());

  test('201 on valid registration', async () => {
    mockRegister.mockResolvedValue(WEBHOOK);
    const res = await request(app).post('/v1/webhooks').send({
      url: 'https://example.com/hook',
      events: ['invoice.settled'],
      secret: 'supersecretvalue16',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('wh-001');
  });

  test('400 when url is missing', async () => {
    const res = await request(app).post('/v1/webhooks').send({ events: ['invoice.settled'], secret: 'supersecretvalue16' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('400 when events array is empty', async () => {
    const res = await request(app).post('/v1/webhooks').send({ url: 'https://x.com', events: [], secret: 'supersecretvalue16' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('400 when secret is shorter than 16 characters', async () => {
    const res = await request(app).post('/v1/webhooks').send({ url: 'https://x.com', events: ['e'], secret: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /v1/webhooks', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 with list of webhooks', async () => {
    mockListAll.mockResolvedValue([WEBHOOK]);
    const res = await request(app).get('/v1/webhooks');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  test('200 with empty list when no webhooks registered', async () => {
    mockListAll.mockResolvedValue([]);
    const res = await request(app).get('/v1/webhooks');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });
});

describe('DELETE /v1/webhooks/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 on successful delete', async () => {
    mockFindById.mockResolvedValue(WEBHOOK);
    mockDelete.mockResolvedValue(undefined);
    const res = await request(app).delete('/v1/webhooks/wh-001');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deleted).toBe(true);
    expect(res.body.data.id).toBe('wh-001');
  });

  test('404 when webhook not found', async () => {
    mockFindById.mockResolvedValue(null);
    const res = await request(app).delete('/v1/webhooks/no-such-id');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
