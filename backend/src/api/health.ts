import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { redisClient } from '../queue/redis.js';
import { version } from '../../package.json';

const router = Router();

/**
 * Response schema for health check endpoint
 * Validates all fields returned by the health check
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

type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

/**
 * Server start time for uptime calculation
 */
const serverStartTime = Date.now();

/**
 * Checks the health of the PostgreSQL database connection
 * @returns Promise resolving to database health status
 */
async function checkDatabaseHealth(): Promise<{
  status: 'connected' | 'disconnected' | 'error';
  latencyMs: number | null;
  error: string | null;
}> {
  const startTime = performance.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Math.round(performance.now() - startTime);
    
    return {
      status: 'connected',
      latencyMs,
      error: null,
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startTime);
    
    return {
      status: 'error',
      latencyMs,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Checks the health of the Redis connection
 * @returns Promise resolving to Redis health status
 */
async function checkRedisHealth(): Promise<{
  status: 'connected' | 'disconnected' | 'error';
  latencyMs: number | null;
  error: string | null;
}> {
  const startTime = performance.now();
  
  try {
    if (!redisClient || !redisClient.isOpen) {
      return {
        status: 'disconnected',
        latencyMs: null,
        error: 'Redis client not initialized or connection closed',
      };
    }
    
    await redisClient.ping();
    const latencyMs = Math.round(performance.now() - startTime);
    
    return {
      status: 'connected',
      latencyMs,
      error: null,
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startTime);
    
    return {
      status: 'error',
      latencyMs,
      error: error instanceof Error ? error.message : 'Unknown Redis error',
    };
  }
}

/**
 * Health check endpoint
 * Returns server status, uptime, version, and connected services status
 * 
 * @route GET /api/health
 * @returns {HealthCheckResponse} Complete health status of server and services
 * @throws {500} If health check fails completely
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  const [databaseHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);
  
  // Determine overall status based on service health
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  
  if (
    databaseHealth.status === 'connected' &&
    redisHealth.status === 'connected'
  ) {
    overallStatus = 'healthy';
  } else if (
    databaseHealth.status === 'disconnected' ||
    redisHealth.status === 'disconnected' ||
    databaseHealth.status === 'error' ||
    redisHealth.status === 'error'
  ) {
    overallStatus = 'unhealthy';
  } else {
    overallStatus = 'degraded';
  }
  
  const response: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    version,
    services: {
      database: databaseHealth,
      redis: redisHealth,
    },
  };
  
  // Validate response matches schema
  const validatedResponse = HealthCheckResponseSchema.parse(response);
  
  // Return appropriate HTTP status based on health
  const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
  
  res.status(httpStatus).json(validatedResponse);
});

export default router;
