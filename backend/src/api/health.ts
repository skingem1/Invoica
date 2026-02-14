import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { createClient } from 'redis';

/**
 * Health check response schema for validation
 */
const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  uptime: z.number(),
  version: z.string(),
  timestamp: z.string(),
  services: z.object({
    database: z.object({
      status: z.enum(['connected', 'disconnected', 'error']),
      latencyMs: z.number().nullable(),
      error: z.string().nullable().optional(),
    }),
    redis: z.object({
      status: z.enum(['connected', 'disconnected', 'error']),
      latencyMs: z.number().nullable(),
      error: z.string().nullable().optional(),
    }),
  }),
});

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

/**
 * Application start time for uptime calculation
 */
const APP_START_TIME = Date.now();

/**
 * Package.json version (would be imported from package.json in production)
 */
const APP_VERSION = process.env.npm_package_version || '1.0.0';

/**
 * Express router for health check endpoint
 */
export const healthRouter = Router();

/**
 * Database client instance (injected or created)
 */
let prismaClient: PrismaClient | null = null;

/**
 * Redis client instance (injected or created)
 */
let redisClient: Redis | null = null;

/**
 * Set the database client instance
 * @param client - Prisma client instance
 */
export function setPrismaClient(client: PrismaClient): void {
  prismaClient = client;
}

/**
 * Set the Redis client instance
 * @param client - Redis client instance
 */
export function setRedisClient(client: Redis): void {
  redisClient = client;
}

/**
 * Check database connectivity and latency
 * @returns Database health status with latency
 */
async function checkDatabaseHealth(): Promise<{
  status: 'connected' | 'disconnected' | 'error';
  latencyMs: number | null;
  error: string | null;
}> {
  if (!prismaClient) {
    return {
      status: 'disconnected',
      latencyMs: null,
      error: 'Database client not initialized',
    };
  }

  const startTime = Date.now();
  
  try {
    await prismaClient.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;
    
    return {
      status: 'connected',
      latencyMs,
      error: null,
    };
  } catch (error) {
    return {
      status: 'error',
      latencyMs: null,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Check Redis connectivity and latency
 * @returns Redis health status with latency
 */
async function checkRedisHealth(): Promise<{
  status: 'connected' | 'disconnected' | 'error';
  latencyMs: number | null;
  error: string | null;
}> {
  if (!redisClient) {
    return {
      status: 'disconnected',
      latencyMs: null,
      error: 'Redis client not initialized',
    };
  }

  const startTime = Date.now();
  
  try {
    await redisClient.ping();
    const latencyMs = Date.now() - startTime;
    
    return {
      status: 'connected',
      latencyMs,
      error: null,
    };
  } catch (error) {
    return {
      status: 'error',
      latencyMs: null,
      error: error instanceof Error ? error.message : 'Unknown Redis error',
    };
  }
}

/**
 * Calculate server uptime in milliseconds
 * @returns Uptime in milliseconds
 */
function getUptime(): number {
  return Date.now() - APP_START_TIME;
}

/**
 * Determine overall health status based on service statuses
 * @param dbStatus - Database health status
 * @param redisStatus - Redis health status
 * @returns Overall health status
 */
function determineOverallStatus(
  dbStatus: 'connected' | 'disconnected' | 'error',
  redisStatus: 'connected' | 'disconnected' | 'error'
): 'healthy' | 'degraded' | 'unhealthy' {
  const dbOk = dbStatus === 'connected';
  const redisOk = redisStatus === 'connected';
  
  if (dbOk && redisOk) {
    return 'healthy';
  }
  
  if (dbOk || redisOk) {
    return 'degraded';
  }
  
  return 'unhealthy';
}

/**
 * GET /api/health
 * 
 * Health check endpoint that returns server status, uptime, version,
 * and connected services status (database, redis).
 * 
 * @param _req - Express request object (unused)
 * @param res - Express response object
 * @returns JSON response with health check data
 * 
 * @throws Will return 503 if service is unhealthy
 */
healthRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Check all services in parallel
    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    // Determine overall status
    const overallStatus = determineOverallStatus(
      dbHealth.status,
      redisHealth.status
    );

    // Build response object
    const response: HealthCheckResponse = {
      status: overallStatus,
      uptime: getUptime(),
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbHealth.status,
          latencyMs: dbHealth.latencyMs,
          error: dbHealth.error,
        },
        redis: {
          status: redisHealth.status,
          latencyMs: redisHealth.latencyMs,
          error: redisHealth.error,
        },
      },
    };

    // Validate response against schema
    const validatedResponse = HealthCheckResponseSchema.parse(response);

    // Return appropriate status code based on health
    const statusCode = overallStatus === 'healthy' ? 200 
      : overallStatus === 'degraded' ? 200 
      : 503;

    res.status(statusCode).json(validatedResponse);
  } catch (error) {
    // Handle unexpected errors
    const message = error instanceof Error ? error.message : 'Internal server error';
    
    // Log the error (in production, use proper logger)
    console.error('[HealthCheck] Unexpected error:', error);

    res.status(500).json({
      status: 'unhealthy',
      uptime: getUptime(),
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: 'error',
          latencyMs: null,
          error: 'Health check failed',
        },
        redis: {
          status: 'error',
          latencyMs: null,
          error: 'Health check failed',
        },
      },
    });
  }
});

export default healthRouter;
