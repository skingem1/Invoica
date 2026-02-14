import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { createClient, RedisClientType } from 'redis';

/**
 * Configuration interface for health check dependencies
 */
interface HealthCheckConfig {
  prisma: PrismaClient;
  redisUrl: string;
  appVersion: string;
}

/**
 * Health status of a single service
 */
const ServiceStatusSchema = z.object({
  status: z.enum(['healthy', 'unhealthy', 'degraded']),
  latencyMs: z.number().optional(),
  error: z.string().optional(),
});

/**
 * Complete health check response schema
 */
const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'unhealthy', 'degraded']),
  timestamp: z.string().datetime(),
  uptime: z.number(),
  version: z.string(),
  services: z.object({
    database: ServiceStatusSchema,
    redis: ServiceStatusSchema,
  }),
});

type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
type ServiceStatus = z.infer<typeof ServiceStatusSchema>;

/**
 * Creates a health check router with configurable dependencies
 * @param config - Configuration object containing Prisma, Redis, and app version
 * @returns Configured Express router
 */
export function createHealthRouter(config: HealthCheckConfig): Router {
  const router = Router();
  let redisClient: RedisClientType | null = null;

  /**
   * Initializes Redis connection for health checks
   * @returns Redis client or null if connection fails
   */
  async function getRedisClient(): Promise<RedisClientType | null> {
    if (redisClient && redisClient.isOpen) {
      return redisClient;
    }

    try {
      redisClient = createClient({ url: config.redisUrl });
      await redisClient.connect();
      return redisClient;
    } catch {
      return null;
    }
  }

  /**
   * Checks database connectivity and returns status
   * @returns Service status object with health state and latency
   */
  async function checkDatabase(): Promise<ServiceStatus> {
    const start = Date.now();
    
    try {
      await config.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - start;
      
      return {
        status: 'healthy',
        latencyMs,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  /**
   * Checks Redis connectivity and returns status
   * @returns Service status object with health state and latency
   */
  async function checkRedis(): Promise<ServiceStatus> {
    const start = Date.now();
    
    try {
      const client = await getRedisClient();
      
      if (!client || !client.isOpen) {
        return {
          status: 'unhealthy',
          latencyMs: Date.now() - start,
          error: 'Redis connection failed',
        };
      }

      await client.ping();
      const latencyMs = Date.now() - start;
      
      return {
        status: 'healthy',
        latencyMs,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Redis ping failed',
      };
    }
  }

  /**
   * Determines overall system health based on service statuses
   * @param dbStatus - Database service status
   * @param redisStatus - Redis service status
   * @returns Overall health status
   */
  function determineOverallStatus(
    dbStatus: ServiceStatus,
    redisStatus: ServiceStatus
  ): 'healthy' | 'unhealthy' | 'degraded' {
    const statuses = [dbStatus.status, redisStatus.status];
    
    if (statuses.every((s) => s === 'healthy')) {
      return 'healthy';
    }
    
    if (statuses.some((s) => s === 'unhealthy')) {
      return 'unhealthy';
    }
    
    return 'degraded';
  }

  /**
   * GET /api/health
   * 
   * Returns comprehensive health status including server info and service connectivity
   * @route GET /api/health
   * @returns {HealthCheckResponse} Health status object
   * @throws {500} Internal server error if health check fails
   */
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const [dbStatus, redisStatus] = await Promise.all([
        checkDatabase(),
        checkRedis(),
      ]);

      const overallStatus = determineOverallStatus(dbStatus, redisStatus);

      const response: HealthCheckResponse = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: config.appVersion,
        services: {
          database: dbStatus,
          redis: redisStatus,
        },
      };

      const validatedResponse = HealthCheckResponseSchema.parse(response);
      const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(validatedResponse);
    } catch (error) {
      const response = {
        status: 'unhealthy' as const,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: config.appVersion,
        services: {
          database: { status: 'unhealthy' as const, error: 'Health check failed' },
          redis: { status: 'unhealthy' as const, error: 'Health check failed' },
        },
      };

      res.status(500).json(response);
    }
  });

  /**
   * GET /api/health/live
   * 
   * Simple liveness probe - returns 200 if server is running
   * @route GET /api/health/live
   * @returns {object} Simple alive status
   */
  router.get('/live', (req: Request, res: Response): void => {
    res.status(200).json({ status: 'alive' });
  });

  /**
   * GET /api/health/ready
   * 
   * Readiness probe - returns 200 if server can handle requests
   * @route GET /api/health/ready
   * @returns {object} Readiness status
   */
  router.get('/ready', async (req: Request, res: Response): Promise<void> => {
    try {
      const [dbStatus, redisStatus] = await Promise.all([
        checkDatabase(),
        checkRedis(),
      ]);

      const isReady = dbStatus.status !== 'unhealthy' && redisStatus.status !== 'unhealthy';
      
      res.status(isReady ? 200 : 503).json({
        ready: isReady,
        services: {
          database: dbStatus.status,
          redis: redisStatus.status,
        },
      });
    } catch {
      res.status(503).json({ ready: false });
    }
  });

  return router;
}

export { HealthCheckResponseSchema, ServiceStatusSchema };
export type { HealthCheckResponse, ServiceStatus, HealthCheckConfig };
