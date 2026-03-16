jest.mock('../../lib/prisma', () => ({
  prisma: {},
}));

jest.mock('../../services/webhook/types', () => ({
  WebhookRepository: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    listAll: jest.fn(),
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
  return app;
}

describe('GET /v1/webhooks/events', () => {
  const app = buildApp();

  test('200 returns-array — response is an array', async () => {
    const res = await request(app).get('/v1/webhooks/events');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('200 has-invoice-events — contains invoice event types', async () => {
    const res = await request(app).get('/v1/webhooks/events');
    expect(res.body.data).toContain('invoice.created');
    expect(res.body.data).toContain('invoice.settled');
    expect(res.body.data).toContain('invoice.completed');
  });

  test('200 has-settlement-events — contains settlement event type', async () => {
    const res = await request(app).get('/v1/webhooks/events');
    expect(res.body.data).toContain('settlement.confirmed');
  });

  test('response-shape — all event strings are dot-separated namespaced strings', async () => {
    const res = await request(app).get('/v1/webhooks/events');
    for (const event of res.body.data) {
      expect(typeof event).toBe('string');
      expect(event).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  test('registered-before-/:id-param — /events resolves correctly and not as :id', async () => {
    const res = await request(app).get('/v1/webhooks/events');
    // If captured by /:id param, it would return 404 (webhook "events" not found in DB)
    // Here we expect 200 from the static route
    expect(res.status).toBe(200);
    expect(res.body.data).toContain('agent.reputation_changed');
  });
});
