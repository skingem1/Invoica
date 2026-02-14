import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { createClient, RedisClientType } from 'redis';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('health-api');

/**
 * Environment configuration for health checks
 */
interface HealthConfig {
  redisUrl: string;
  version: string;
}

/**
 * Response schema for health check endpoint
 * Validated with Zod for type safety
 */
export const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  uptime: z.number().positive(),
  version: z.string(),
  timestamp: z.string().datetime(),
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

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/**
 * Service status types
 */
type ServiceStatus = 'connected' | 'disconnected' | 'error';

/**
 * Health check result for a single service
 */
interface ServiceHealth {
  status: ServiceStatus;
  latencyMs: number | null;
  error?: string;
}

/**
 * Health check service that monitors system components
 */
export class HealthCheckService {
  private prisma: PrismaClient;
  private redisClient: RedisClientType | null = null;
  private config: HealthConfig;
  private startTime: number;

  /**
   * Creates a new HealthCheckService instance
   * @param prisma - Prisma client instance for database checks
   * @param config - Health check configuration
   */
  constructor(prisma: PrismaClient, config: HealthConfig) {
    this.prisma = prisma;
    this.config = config;
    this.startTime = process.uptime() as number;
  }

  /**
   * Initializes Redis connection for health checks
   * @param redisUrl - Redis connection URL
   */
  async initializeRedis(redisUrl: string): Promise<void> {
    try {
      this.redisClient = createClient({ url: redisUrl });
      this.redisClient.on('error', (err) => {
        logger.error({ err }, 'Redis health check error');
      });
      await this.redisClient.connect();
    } catch (error) {
      logger.warn({ error }, 'Failed to connect Redis for health checks');
      this.redisClient = null;
    }
  }

  /**
   * Closes Redis connection
   */
  async close(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
    }
  }

  /**
   * Checks database connectivity and latency
   * @returns Promise resolving to database health status
   */
  async checkDatabase(): Promise<ServiceHealth> {
    const start = performance.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Math.round(performance.now() - start);
      
      return {
        status: 'connected',
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Math.round(performance.now() - start);
      logger.error({ error }, 'Database health check failed');
      
      return {
        status: 'error',
        latencyMs,
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  /**
   * Checks Redis connectivity and latency
   * @returns Promise resolving to Redis health status
   */
  async checkRedis(): Promise<ServiceHealth> {
    if (!this.redisClient) {
      return {
        status: 'disconnected',
        latencyMs: null,
        error: 'Redis client not initialized',
      };
    }

    const start = performance.now();
    try {
      await this.redisClient.ping();
      const latencyMs = Math.round(performance.now() - start);
      
      return {
        status: 'connected',
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Math.round(performance.now() - start);
      logger.error({ error }, 'Redis health check failed');
      
      return {
        status: 'error',
        latencyMs,
        error: error instanceof Error ? error.message : 'Unknown Redis error',
      };
    }
  }

  /**
   * Performs comprehensive health check
   * @returns Promise resolving to complete health response
   */
  async check(): Promise<HealthResponse> {
    const [dbHealth, redisHealth] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    // Determine overall status based on service health
    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (dbHealth.status === 'connected' && redisHealth.status === 'connected') {
      status = 'healthy';
    } else if (dbHealth.status === 'error' || redisHealth.status === 'error') {
      status = 'unhealthy';
    } else {
      status = 'degraded';
    }

    const response: HealthResponse = {
      status,
      uptime: Math.floor(process.uptime()),
      version: this.config.version,
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbHealth.status,
          latencyMs: dbHealth.latencyMs,
          error: dbHealth.error ?? undefined,
        },
        redis: {
          status: redisHealth.status,
          latencyMs: redisHealth.latencyMs,
          error: redisHealth.error ?? undefined,
        },
      },
    };

    // Validate response against schema
    return HealthResponseSchema.parse(response);
  }
}

/**
 * Creates health check router with /api/health endpoint
 * @param healthService - HealthCheckService instance
 * @returns Express router configured with health check endpoint
 */
export function createHealthRouter(healthService: HealthCheckService): Router {
  const router = Router();

  /**
   * Health check endpoint
   * GET /api/health
   * 
   * Returns server status, uptime, version, and connected services status
   * 
   * @route GET /api/health
   * @returns {HealthResponse} Health status including all service states
   * @throws {500} Internal server error if health check fails
   */
  router.get('/', async (_req: Request, res: Response): Promise<void> => {
    try {
      const health = await healthService.check();
      const statusCode = health.status === 'healthy' ? 200 
        : health.status === 'degraded' ? 200 
        : 503;
      
      res.status(statusCode).json(health);
    } catch (error) {
      logger.error({ error }, 'Health check failed');
      res.status(500).json({
        status: 'unhealthy',
        uptime: Math.floor(process.uptime()),
        version: 'unknown',
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

  return router;
}

export default { HealthCheckService, createHealthRouter, HealthResponseSchema };
