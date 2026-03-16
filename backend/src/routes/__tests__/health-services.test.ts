import request from 'supertest';
import express from 'express';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  prisma: { $queryRaw: jest.fn() },
}));

jest.mock('../../lib/redis', () => ({
  __esModule: true,
  redis: { ping: jest.fn() },
}));

import router from '../health';
import { prisma } from '../../lib/prisma';

const app = express();
app.use(router);

describe('GET /v1/health/services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.REDIS_URL;
  });

  test('200 returns-services-object — response has success and data.database', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
    const res = await request(app).get('/v1/health/services');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  test('200 database-field-present — data.database is ok or error', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
    const res = await request(app).get('/v1/health/services');
    expect(['ok', 'error']).toContain(res.body.data.database);
  });

  test('200 redis-field-present — data.redis is not_configured, ok, or error', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
    const res = await request(app).get('/v1/health/services');
    expect(['ok', 'error', 'not_configured']).toContain(res.body.data.redis);
  });

  test('200 uptime-is-number — data.uptime is a positive number', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
    const res = await request(app).get('/v1/health/services');
    expect(typeof res.body.data.uptime).toBe('number');
    expect(res.body.data.uptime).toBeGreaterThanOrEqual(0);
  });

  test('response-shape — always returns 200 regardless of DB status', async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('DB down'));
    const res = await request(app).get('/v1/health/services');
    expect(res.status).toBe(200);
    expect(res.body.data.database).toBe('error');
  });
});
