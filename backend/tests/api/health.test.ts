import express, { Express } from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import {
  createHealthRouter,
  checkDatabase,
  checkRedis,
  deriveOverallStatus,
  HealthResponseSchema,
} from '../../src/api/health';

/**
 * Creates a mock PrismaClient with configurable $queryRaw behavior.
 */
function createMockPrisma(queryRawImpl?: () => Promise<unknown>): PrismaClient {
  return {
    $queryRaw: queryRawImpl ?? jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  } as unknown as PrismaClient;
}

/**
 * Creates a mock Redis client with configurable ping behavior.
 */
function createMockRedis(pingImpl?: () => Promise<string>): Redis {
  return {
    ping: pingImpl ?? jest.fn().mockResolvedValue('PONG'),
  } as unknown as Redis;
}

/**
 * Builds an Express app with the health router mounted.
 */
function buildApp(prisma: PrismaClient, redis: Redis, version?: string): Express {
  const app = express();
  app.use(createHealthRouter({ prisma, redis, version }));
  return app;
}

describe('Health Check Endpoint', () => {
  describe('GET /api/health - all services healthy', () => {
    let app: Express;

    beforeEach(() => {
      app = buildApp(createMockPrisma(), createMockRedis(), '1.2.3');
    });

    it('returns 200 with healthy status', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });

    it('includes version from configuration', async () => {
      const res = await request(app).get('/api/health');

      expect(res.body.version).toBe('1.2.3');
    });

    it('includes uptime as a non-negative number', async () => {
      const res = await request(app).get('/api/health');

      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('includes a valid ISO-8601 timestamp', async () => {
      const res = await request(app).get('/api/health');

      expect(() => new Date(res.body.timestamp)).not.toThrow();
      expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    });

    it('reports both services as connected', async () => {
      const res = await request(app).get('/api/health');

      expect(res.body.services.database.status).toBe('connected');
      expect(res.body.services.redis.status).toBe('connected');
    });

    it('includes latency measurements for both services', async () => {
      const res = await request(app).get('/api/health');

      expect(typeof res.body.services.database.latencyMs).toBe('number');
      expect(typeof res.body.services.redis.latencyMs).toBe('number');
      expect(res.body.services.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(res.body.services.redis.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('passes Zod schema validation', async () => {
      const res = await request(app).get('/api/health');

      expect(() => HealthResponseSchema.parse(res.body)).not.toThrow();
    });
  });

  describe('GET /api/health - database down', () => {
    let app: Express;

    beforeEach(() => {
      const brokenPrisma = createMockPrisma(() =>
        Promise.reject(new Error('Connection refused'))
      );
      app = buildApp(brokenPrisma, createMockRedis(), '1.0.0');
    });

    it('returns 200 with degraded status', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('degraded');
    });

    it('reports database as disconnected with error message', async () => {
      const res = await request(app).get('/api/health');

      expect(res.body.services.database.status).toBe('disconnected');
      expect(res.body.services.database.error).toBe('Connection refused');
    });

    it('reports redis as still connected', async () => {
      const res = await request(app).get('/api/health');

      expect(res.body.services.redis.status).toBe('connected');
    });
  });

  describe('GET /api/health - redis down', () => {
    let app: Express;

    beforeEach(() => {
      const brokenRedis = createMockRedis(() =>
        Promise.reject(new Error('ECONNREFUSED'))
      );
      app = buildApp(createMockPrisma(), brokenRedis, '1.0.0');
    });

    it('returns 200 with degraded status', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('degraded');
    });

    it('reports redis as disconnected with error', async () => {
      const res = await request(app).get('/api/health');

      expect(res.body.services.redis.status).toBe('disconnected');
      expect(res.body.services.redis.error).toBe('ECONNREFUSED');
    });
  });

  describe('GET /api/health - all services down', () => {
    let app: Express;

    beforeEach(() => {
      const brokenPrisma = createMockPrisma(() =>
        Promise.reject(new Error('DB down'))
      );
      const brokenRedis = createMockRedis(() =>
        Promise.reject(new Error('Redis down'))
      );
      app = buildApp(brokenPrisma, brokenRedis, '1.0.0');
    });

    it('returns 503 with unhealthy status', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('unhealthy');
    });

    it('reports both services as disconnected', async () => {
      const res = await request(app).get('/api/health');

      expect(res.body.services.database.status).toBe('disconnected');
      expect(res.body.services.redis.status).toBe('disconnected');
    });

    it('still passes Zod validation', async () => {
      const res = await request(app).get('/api/health');

      expect(() => HealthResponseSchema.parse(res.body)).not.toThrow();
    });
  });

  describe('GET /api/health - redis returns unexpected response', () => {
    it('reports redis as disconnected when PING does not return PONG', async () => {
      const oddRedis = createMockRedis(() => Promise.resolve('NOT_PONG'));
      const app = buildApp(createMockPrisma(), oddRedis, '1.0.0');

      const res = await request(app).get('/api/health');

      expect(res.body.services.redis.status).toBe('disconnected');
      expect(res.body.services.redis.error).toContain('Unexpected PING response');
    });
  });

  describe('GET /api/health - default version', () => {
    it('uses 0.0.0 when no version or env var is provided', async () => {
      const originalEnv = process.env.APP_VERSION;
      delete process.env.APP_VERSION;

      const app = buildApp(createMockPrisma(), createMockRedis());
      const res = await request(app).get('/api/health');

      expect(res.body.version).toBe('0.0.0');

      if (originalEnv !== undefined) {
        process.env.APP_VERSION = originalEnv;
      }
    });
  });

  describe('checkDatabase', () => {
    it('returns connected with latency on success', async () => {
      const prisma = createMockPrisma();
      const result = await checkDatabase(prisma);

      expect(result.status).toBe('connected');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('returns disconnected with error message on failure', async () => {
      const prisma = createMockPrisma(() =>
        Promise.reject(new Error('timeout'))
      );
      const result = await checkDatabase(prisma);

      expect(result.status).toBe('disconnected');
      expect(result.error).toBe('timeout');
    });

    it('handles non-Error throws gracefully', async () => {
      const prisma = createMockPrisma(() => Promise.reject('string error'));
      const result = await checkDatabase(prisma);

      expect(result.status).toBe('disconnected');
      expect(result.error).toBe('Unknown database error');
    });
  });

  describe('checkRedis', () => {
    it('returns connected with latency on PONG response', async () => {
      const redis = createMockRedis();
      const result = await checkRedis(redis);

      expect(result.status).toBe('connected');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('returns disconnected on failure', async () => {
      const redis = createMockRedis(() => Promise.reject(new Error('closed')));
      const result = await checkRedis(redis);

      expect(result.status).toBe('disconnected');
      expect(result.error).toBe('closed');
    });

    it('handles non-Error throws gracefully', async () => {
      const redis = createMockRedis(() => Promise.reject(42));
      const result = await checkRedis(redis);

      expect(result.status).toBe('disconnected');
      expect(result.error).toBe('Unknown Redis error');
    });
  });

  describe('deriveOverallStatus', () => {
    it('returns healthy when all services connected', () => {
      const result = deriveOverallStatus({
        database: { status: 'connected', latencyMs: 1 },
        redis: { status: 'connected', latencyMs: 1 },
      });
      expect(result).toBe('healthy');
    });

    it('returns degraded when some services disconnected', () => {
      const result = deriveOverallStatus({
        database: { status: 'connected', latencyMs: 1 },
        redis: { status: 'disconnected', latencyMs: 0, error: 'down' },
      });
      expect(result).toBe('degraded');
    });

    it('returns unhealthy when all services disconnected', () => {
      const result = deriveOverallStatus({
        database: { status: 'disconnected', latencyMs: 0, error: 'down' },
        redis: { status: 'disconnected', latencyMs: 0, error: 'down' },
      });
      expect(result).toBe('unhealthy');
    });
  });

  describe('Content-Type', () => {
    it('responds with application/json', async () => {
      const app = buildApp(createMockPrisma(), createMockRedis(), '1.0.0');
      const res = await request(app).get('/api/health');

      expect(res.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Non-existent routes', () => {
    it('does not respond on other paths', async () => {
      const app = buildApp(createMockPrisma(), createMockRedis());
      const res = await request(app).get('/api/healthz');

      expect(res.status).toBe(404);
    });
  });
});
