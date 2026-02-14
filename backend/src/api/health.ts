import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { createClient, RedisClientType } from 'redis';
import os from 'os';

/**
 * Health check response schema for validation
 */
const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string().datetime(),
  uptime: z.number().positive(),
  version: z.string(),
  services: z.object({
    database: z.object({
      status: z.enum(['up', 'down']),
      latencyMs: z.number().nullable(),
      error: z.string().nullable(),
    }),
    redis: z.object({
      status: z.enum(['up', 'down']),
      latencyMs: z.number().nullable(),
      error: z.string().nullable(),
    }),
  }),
  system: z.object({
    cpuLoad: z.array(z.number()),
    freeMemory: z.number(),
    totalMemory: z.number(),
    platform: z.string(),
  }),
});

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

const router = Router();

const prisma = new PrismaClient();

let redisClient: RedisClientType | null = null;

/**
 * Initialize Redis connection for health checks
 * @returns Redis client or null if connection fails
 */
async function getRedisClient(): Promise<RedisClientType | null> {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    return null;
  }
}

/**
 * Check database health
 * @returns Promise resolving to database health status
 */
async function checkDatabaseHealth(): Promise<{
  status: 'up' | 'down';
  latencyMs: number | null;
  error: string | null;
}> {
  const startTime = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'up',
      latencyMs: Date.now() - startTime,
      error: null,
    };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: null,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Check Redis health
 * @returns Promise resolving to Redis health status
 */
async function checkRedisHealth(): Promise<{
  status: 'up' | 'down';
  latencyMs: number | null;
  error: string | null;
}> {
  const startTime = Date.now();
  try {
    const client = await getRedisClient();
    if (!client || !client.isOpen) {
      return {
        status: 'down',
        latencyMs: null,
        error: 'Redis client not connected',
      };
    }
    await client.ping();
    return {
      status: 'up',
      latencyMs: Date.now() - startTime,
      error: null,
    };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: null,
      error: error instanceof Error ? error.message : 'Unknown Redis error',
    };
  }
}

/**
 * Get application start time (in milliseconds)
 */
function getApplicationUptime(): number {
  return process.uptime() * 1000;
}

/**
 * Determine overall health status based on service checks
 * @param dbStatus - Database service status
 * @param redisStatus - Redis service status
 * @returns Overall health status
 */
function determineOverallStatus(
  dbStatus: 'up' | 'down',
  redisStatus: 'up' | 'down'
): 'healthy' | 'degraded' | 'unhealthy' {
  const servicesUp = [dbStatus, redisStatus].filter((s) => s === 'up').length;
  const totalServices = 2;

  if (servicesUp === totalServices) {
    return 'healthy';
  } if (servicesUp === 0) {
    return 'unhealthy';
  }
  return 'degraded';
}

/**
 * GET /api/health
 * Returns server status, uptime, version, and connected services status
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Run both health checks in parallel
    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const overallStatus = determineOverallStatus(dbHealth.status, redisHealth.status);

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: getApplicationUptime(),
      version: process.env.APP_VERSION || '1.0.0',
      services: {
        database: dbHealth,
        redis: redisHealth,
      },
      system: {
        cpuLoad: os.loadavg(),
        freeMemory: os.freemem(),
        totalMemory: os.totalmem(),
        platform: os.platform(),
      },
    };

    // Validate response against schema
    const validatedResponse = HealthCheckResponseSchema.parse(response);

    // Set appropriate HTTP status based on health
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
    res.status(statusCode).json(validatedResponse);
  } catch (error) {
    // Handle unexpected errors
    console.error('Health check failed:', error);

    const errorResponse = {
      status: 'unhealthy' as const,
      timestamp: new Date().toISOString(),
      uptime: getApplicationUptime(),
      version: process.env.APP_VERSION || '1.0.0',
      services: {
        database: {
          status: 'down' as const,
          latencyMs: null,
          error: error instanceof Error ? error.message : 'Health check failed',
        },
        redis: {
          status: 'down' as const,
          latencyMs: null,
          error: error instanceof Error ? error.message : 'Health check failed',
        },
      },
      system: {
        cpuLoad: os.loadavg(),
        freeMemory: os.freemem(),
        totalMemory: os.totalmem(),
        platform: os.platform(),
      },
    };

    res.status(503).json(errorResponse);
  }
});

export default router;
