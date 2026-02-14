import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { redisClient } from '../config/redis.js';
import { version } from '../../package.json';

const router = Router();

/**
 * Response schema for health check endpoint
 */
const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string().datetime(),
  uptime: z.number().positive(),
  version: z.string(),
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
 * Server start timestamp for uptime calculation
 */
const serverStartTime = Date.now();

/**
 * Checks the health status of the database connection
 * @returns Promise<{ status: 'connected' | 'disconnected' | 'error', latencyMs: number | null, error: string | null }>
 */
async function checkDatabaseHealth(): Promise<{
  status: 'connected' | 'disconnected' | 'error';
  latencyMs: number | null;
  error: string | null;
}> {
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
    return {
      status: 'error',
      latencyMs: null,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Checks the health status of the Redis connection
 * @returns Promise<{ status: 'connected' | 'disconnected' | 'error', latencyMs: number | null, error: string | null }>
 */
async function checkRedisHealth(): Promise<{
  status: 'connected' | 'disconnected' | 'error';
  latencyMs: number | null;
  error: string | null;
}> {
  const startTime = Date.now();
  
  try {
    if (!redisClient || !redisClient.isOpen) {
      return {
        status: 'disconnected',
        latencyMs: null,
        error: 'Redis client not connected',
      };
    }
    
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
 * Determines overall health status based on service statuses
 * @param dbStatus - Database connection status
 * @param redisStatus - Redis connection status
 * @returns Overall health status
 */
function determineOverallStatus(
  dbStatus: 'connected' | 'disconnected' | 'error',
  redisStatus: 'connected' | 'disconnected' | 'error'
): 'healthy' | 'degraded' | 'unhealthy' {
  const servicesUp = [dbStatus, redisStatus].filter(s => s === 'connected').length;
  const totalServices = 2;
  
  if (servicesUp === totalServices) {
    return 'healthy';
  } else if (servicesUp >= 1) {
    return 'degraded';
  }
  return 'unhealthy';
}

/**
 * Health check endpoint that returns server status, uptime, version, and connected services status
 * 
 * @route GET /api/health
 * @returns {Object} Health check response with server and service statuses
 * @throws {Error} If health check fails unexpectedly
 * 
 * @example
 * // Successful response
 * {
 *   "status": "healthy",
 *   "timestamp": "2024-01-15T10:30:00.000Z",
 *   "uptime": 3600.5,
 *   "version": "1.0.0",
 *   "services": {
 *     "database": { "status": "connected", "latencyMs": 5 },
 *     "redis": { "status": "connected", "latencyMs": 2 }
 *   }
 * }
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const overallStatus = determineOverallStatus(
      dbHealth.status,
      redisHealth.status
    );

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version,
      services: {
        database: dbHealth,
        redis: redisHealth,
      },
    };

    // Validate response against schema
    const validatedResponse = HealthCheckResponseSchema.parse(response);

    const statusCode = overallStatus === 'healthy' ? 200 
      : overallStatus === 'degraded' ? 200 
      : 503;

    res.status(statusCode).json(validatedResponse);
  } catch (error) {
    // Unexpected error during health check
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('Health check failed:', errorMessage);
    
    const errorResponse = {
      status: 'unhealthy' as const,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version,
      services: {
        database: {
          status: 'error' as const,
          latencyMs: null,
          error: 'Health check failed',
        },
        redis: {
          status: 'error' as const,
          latencyMs: null,
          error: 'Health check failed',
        },
      },
    };

    res.status(503).json(errorResponse);
  }
});

export default router;
