import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';

/**
 * Schema for health check response validation
 */
export const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  uptime: z.number().positive(),
  version: z.string(),
  timestamp: z.string().datetime(),
  services: z.object({
    database: z.object({
      status: z.enum(['connected', 'disconnected', 'error']),
      latencyMs: z.number().optional(),
      error: z.string().optional(),
    }),
    redis: z.object({
      status: z.enum(['connected', 'disconnected', 'error']),
      latencyMs: z.number().optional(),
      error: z.string().optional(),
    }),
  }),
});

/**
 * Type for health check response
 */
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

/**
 * Server start time for uptime calculation
 */
const serverStartTime = Date.now();

/**
 * Checks the health status of the application and its dependencies.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @returns Promise<void>
 * 
 * @endpoint GET /api/health
 * @response 200 - Health check successful
 * @response 503 - One or more services are unhealthy
 */
export async function healthCheck(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Check database connection
    const dbHealth = await checkDatabaseHealth();
    
    // Check Redis connection
    const redisHealth = await checkRedisHealth();
    
    // Determine overall status
    const overallStatus = determineOverallStatus(dbHealth, redisHealth);
    
    const response: HealthCheckResponse = {
      status: overallStatus,
      uptime: Math.floor((Date.now() - serverStartTime) / 1000),
      version: process.env.APP_VERSION || '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth,
        redis: redisHealth,
      },
    };
    
    // Validate response matches schema
    const validatedResponse = HealthCheckResponseSchema.parse(response);
    
    const responseTime = Date.now() - startTime;
    logger.info('Health check completed', {
      status: overallStatus,
      responseTimeMs: responseTime,
      services: {
        database: dbHealth.status,
        redis: redisHealth.status,
      },
    });
    
    // Return appropriate status code based on overall health
    const statusCode = overallStatus === 'healthy' ? 200 : 
                       overallStatus === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(validatedResponse);
  } catch (error) {
    logger.error('Health check failed', { error: String(error) });
    
    const response: HealthCheckResponse = {
      status: 'unhealthy',
      uptime: Math.floor((Date.now() - serverStartTime) / 1000),
      version: process.env.APP_VERSION || '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: 'error',
          error: 'Health check failed',
        },
        redis: {
          status: 'error',
          error: 'Health check failed',
        },
      },
    };
    
    res.status(503).json(response);
  }
}

/**
 * Checks the health of the database connection
 */
async function checkDatabaseHealth(): Promise<{
  status: 'connected' | 'disconnected' | 'error';
  latencyMs?: number;
  error?: string;
}> {
  const checkStart = Date.now();
  
  try {
    // Perform a simple database query to check connectivity
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - checkStart;
    
    return {
      status: 'connected',
      latencyMs,
    };
  } catch (error) {
    logger.error('Database health check failed', { error: String(error) });
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Checks the health of the Redis connection
 */
async function checkRedisHealth(): Promise<{
  status: 'connected' | 'disconnected' | 'error';
  latencyMs?: number;
  error?: string;
}> {
  const checkStart = Date.now();
  
  try {
    // Perform a simple Redis ping
    const result = await redis.ping();
    const latencyMs = Date.now() - checkStart;
    
    if (result === 'PONG') {
      return {
        status: 'connected',
        latencyMs,
      };
    }
    
    return {
      status: 'disconnected',
      error: 'Unexpected Redis response',
    };
  } catch (error) {
    logger.error('Redis health check failed', { error: String(error) });
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown Redis error',
    };
  }
}

/**
 * Determines the overall health status based on individual service statuses
 */
function determineOverallStatus(
  dbHealth: ReturnType<typeof checkDatabaseHealth>,
  redisHealth: ReturnType<typeof checkRedisHealth>
): 'healthy' | 'degraded' | 'unhealthy' {
  const dbStatus = dbHealth.status;
  const redisStatus = redisHealth.status;
  
  // All services connected = healthy
  if (dbStatus === 'connected' && redisStatus === 'connected') {
    return 'healthy';
  }
  
  // One or more services errored = unhealthy
  if (dbStatus === 'error' || redisStatus === 'error') {
    return 'unhealthy';
  }
  
  // One or more services disconnected = degraded
  if (dbStatus === 'disconnected' || redisStatus === 'disconnected') {
    return 'degraded';
  }
  
  // Default to degraded if uncertain
  return 'degraded';
}

export default healthCheck;
