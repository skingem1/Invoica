import express from 'express';
import request from 'supertest';

jest.mock('../lib/prisma', () => ({ __esModule: true, default: { $queryRaw: jest.fn() } }));
jest.mock('../lib/redis', () => ({ __esModule: true, default: { ping: jest.fn() } }));

import prisma from '../lib/prisma';
import redis from '../lib/redis';
import router from '../health';

const app = express();
app.use(router);

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedRedis = redis as jest.Mocked<typeof redis>;

beforeEach(() => {
  jest.clearAllMocks();
  (mockedPrisma.$queryRaw as jest.Mock).mockResolvedValue([{ 1: 1 }]);
  (mockedRedis.ping as jest.Mock).mockResolvedValue('PONG');
});

describe('GET /v1/health', () => {
  it('returns 200 with status ok when database is healthy', async () => {
    const res = await request(app).get('/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('ok');
  });

  it('returns 503 when database is down', async () => {
    (mockedPrisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('connection refused'));
    const res = await request(app).get('/v1/health');
    expect(res.status).toBe(503);
    expect(res.body.database).toBe('error');
  });

  it('returns redis not_configured when REDIS_URL is not set', async () => {
    const orig = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    const res = await request(app).get('/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.redis).toBe('not_configured');
    if (orig) process.env.REDIS_URL = orig;
  });

  it('returns redis ok when REDIS_URL is set and redis.ping resolves', async () => {
    const orig = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://localhost';
    const res = await request(app).get('/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.redis).toBe('ok');
    if (orig) process.env.REDIS_URL = orig; else delete process.env.REDIS_URL;
  });

  it('includes version, uptime, and timestamp in response body', async () => {
    const res = await request(app).get('/v1/health');
    expect(res.body).toHaveProperty('version');
    expect(typeof res.body.uptime).toBe('number');
    expect(typeof res.body.timestamp).toBe('string');
  });
});