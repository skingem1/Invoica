import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const router = Router();

router.get('/v1/health', async (_req: Request, res: Response) => {
  const services: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error' | 'not_configured';
  } = {
    database: 'error',
    redis: 'not_configured',
  };

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    services.database = 'ok';
  } catch {
    services.database = 'error';
  }

  // Check Redis connectivity if REDIS_URL is configured
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      await redis.ping();
      services.redis = 'ok';
    } catch {
      services.redis = 'error';
    }
  }

  const status: 'ok' | 'error' = services.database === 'ok' ? 'ok' : 'error';
  const statusCode = services.database === 'ok' ? 200 : 503;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { version } = require('../../package.json');

  res.status(statusCode).json({
    status,
    version,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services,
  });
});

router.get('/v1/health/services', async (_req: Request, res: Response) => {
  const services: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error' | 'not_configured';
  } = {
    database: 'error',
    redis: 'not_configured',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    services.database = 'ok';
  } catch { /* stays error */ }

  if (process.env.REDIS_URL) {
    try {
      await redis.ping();
      services.redis = 'ok';
    } catch {
      services.redis = 'error';
    }
  }

  res.json({ success: true, data: { ...services, uptime: process.uptime() } });
});

router.get('/v1/health/detailed', async (_req: Request, res: Response) => {
  const services: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error' | 'not_configured';
    openclaw: 'ok' | 'error';
  } = {
    database: 'error',
    redis: 'not_configured',
    openclaw: 'error',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    services.database = 'ok';
  } catch { /* database stays error */ }

  if (process.env.REDIS_URL) {
    try {
      await redis.ping();
      services.redis = 'ok';
    } catch {
      services.redis = 'error';
    }
  }

  try {
    const ctrl = await fetch('http://127.0.0.1:18791/', {
      signal: AbortSignal.timeout(1000),
    });
    if (ctrl.status < 500) services.openclaw = 'ok';
  } catch { /* openclaw stays error */ }

  const dbDown = services.database === 'error';
  const anyDown = services.redis === 'error' || services.openclaw === 'error';
  const status: 'ok' | 'degraded' = dbDown || anyDown ? 'degraded' : 'ok';
  const statusCode = dbDown ? 503 : 200;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { version } = require('../../package.json');

  res.status(statusCode).json({
    status,
    version,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services,
  });
});

export default router;