import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';

/**
 * Structured logger interface for health check operations
 */
interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Default console logger implementation
 */
const defaultLogger: Logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(JSON.stringify({ level: 'info', message, ...meta }));
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(JSON.stringify({ level: 'error', message, ...meta }));
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(JSON.stringify({ level: 'warn', message, ...meta }));
  },
};

/**
 * Application version retrieved from package.json
 */
const APP_VERSION = process.env.APP_VERSION || '1.0.0';

/**
 * Dependencies required for health check
 */
export interface HealthCheckDependencies {
  prisma: PrismaClient;
  redis: Redis;
  logger?: Logger;
  version?: string;
}

/**
 * Health check response schema for validation
 */
const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'unhealthy']),
  version: z.string(),
  uptime: z.number(),
  timestamp: z.string(),
  services: z.object({
    database: z.object({
      status: z.enum(['connected', 'disconnected', 'error']),
      latencyMs: z.number().nullable(),
      error: z.string().nullable(),
    }),
    redis: z.object({
      status: z.enum(['connected', 'disconnected', 'error']),
      latencyMs: z.number().nullable(),
      error: z.string().nullable(),
    }),
  }),
});

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

/**
 * Database health check result
 */
interface ServiceHealth {
  status: 'connected' | 'disconnected' | 'error';
  latencyMs: number | null;
  error: string | null;
}

/**
 * Checks the health of the PostgreSQL database connection
 * 
 * @param prisma - PrismaClient instance for database queries
 * @param logger - Optional logger for error reporting
 * @returns Promise resolving to database health status
 */
async function checkDatabaseHealth(
  prisma: PrismaClient,
  logger: Logger
): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;
    
    return {
      status: 'connected',
      latencyMs,
      error: null,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    
    logger.error('Database health check failed', { error: errorMessage, latencyMs });
    
    return {
      status: 'error',
      latencyMs,
      error: errorMessage,
    };
  }
}

/**
 * Checks the health of the Redis connection
 * 
 * @param redis - Redis client instance
 * @param logger - Optional logger for error reporting
 * @returns Promise resolving to Redis health status
 */
async function checkRedisHealth(
  redis: Redis,
  logger: Logger
): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    const result = await redis.ping();
    const latencyMs = Date.now() - startTime;
    
    if (result === 'PONG') {
      return {
        status: 'connected',
        latencyMs,
        error: null,
      };
    }
    
    return {
      status: 'disconnected',
      latencyMs,
      error: 'Unexpected ping response',
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown Redis error';
    
    logger.error('Redis health check failed', { error: errorMessage, latencyMs });
    
    return {
      status: 'error',
      latencyMs,
      error: errorMessage,
    };
  }
}

/**
 * Gets the process uptime in seconds
 * 
 * @returns Number of seconds the process has been running
 */
function getProcessUptime(): number {
  return Math.floor(process.uptime());
}

/**
 * Creates the health check router with injected dependencies
 * 
 * @param deps - Health check dependencies (prisma, redis, logger, version)
 * @returns Express router configured for health checks
 */
export function createHealthCheckRouter(deps: HealthCheckDependencies): Router {
  const router = Router();
  const { prisma, redis, logger = defaultLogger, version = APP_VERSION } = deps;

  /**
   * GET /api/health
   * 
   * Returns the health status of the server including connected services.
   * Returns 200 if all services are healthy, 503 if any service is unhealthy.
   */
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const timestamp = new Date().toISOString();
    
    // Run health checks in parallel for better performance
    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabaseHealth(prisma, logger),
      checkRedisHealth(redis, logger),
    ]);

    const isHealthy = 
      dbHealth.status === 'connected' && 
      redisHealth.status === 'connected';

    const response: HealthCheckResponse = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      version,
      uptime: getProcessUptime(),
      timestamp,
      services: {
        database: dbHealth,
        redis: redisHealth,
      },
    };

    // Validate response schema
    const validationResult = HealthCheckResponseSchema.safeParse(response);
    
    if (!validationResult.success) {
      logger.error('Health check response validation failed', {
        errors: validationResult.error.errors,
      });
      res.status(500).json({ 
        status: 'unhealthy', 
        error: 'Internal validation error' 
      });
      return;
    }

    // Return appropriate status code based on health
    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(response);
  });

  return router;
}

/**
 * Default health check router using global instances
 * For backward compatibility - prefer using createHealthCheckRouter with DI
 */
let globalPrisma: PrismaClient | null = null;
let globalRedis: Redis | null = null;

function getGlobalPrisma(): PrismaClient {
  if (!globalPrisma) {
    globalPrisma = new PrismaClient();
  }
  return globalPrisma;
}

function getGlobalRedis(): Redis {
  if (!globalRedis) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    globalRedis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }
  return globalRedis;
}

// Default export for easy importing
export default createHealthCheckRouter({
  prisma: getGlobalPrisma(),
  redis: getGlobalRedis(),
  logger: defaultLogger,
  version: APP_VERSION,
});
