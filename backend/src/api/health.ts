
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import os from 'os';
import process from 'process';

// ============================================
// Custom Error Classes
// ============================================

/**
 * Base error class for health check failures
 */
export class HealthCheckError extends Error {
  public readonly service: string;
  public readonly status: 'unhealthy' | 'degraded';

  constructor(
    message: string,
    service: string,
    status: 'unhealthy' | 'degraded' = 'unhealthy'
  ) {
    super(message);
    this.name = 'HealthCheckError';
    this.service = service;
    this.status = status;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error specific to database health check failures
 */
export class DatabaseHealthError extends HealthCheckError {
  constructor(message: string) {
    super(message, 'database', 'unhealthy');
    this.name = 'DatabaseHealthError';
  }
}

/**
 * Error specific to Redis health check failures
 */
export class RedisHealthError extends HealthCheckError {
  constructor(message: string) {
    super(message, 'redis', 'unhealthy');
    this.name = 'RedisHealthError';
  }
}

/**
 * Error for timeout-related health check failures
 */
export class HealthCheckTimeoutError extends HealthCheckError {
  constructor(service: string, timeoutMs: number) {
    super(`Health check for ${service} timed out after ${timeoutMs}ms`, service, 'unhealthy');
    this.name = 'HealthCheckTimeoutError';
  }
}

// ============================================
// Zod Validation Schemas
// ============================================

/**
 * Schema for individual service health status
 */
const ServiceHealthSchema = z.object({
  status: z.enum(['healthy', 'unhealthy']),
  responseTime: z.number().optional(),
  error: z.string().optional(),
});

/**
 * Schema for the complete health check response
 */
export const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  uptime: z.number(),
  version: z.string(),
  timestamp: z.string(),
  services: z.object({
    database: ServiceHealthSchema,
    redis: ServiceHealthSchema,
  }),
  system: z.object({
    cpuUsage: z.number(),
    memoryUsage: z.object({
      total: z.number(),
      free: z.number(),
      used: z.number(),
      usagePercent: z.number(),
    }),
    platform: z.string(),
    nodeVersion: z.string(),
  }).optional(),
});

/**
 * Type inferred from the health check response schema
 */
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

// ============================================
// Configuration
// ============================================

/**
 * Configuration options for health checks
 */
export interface HealthCheckConfig {
  /** Timeout in milliseconds for database health check */
  databaseTimeoutMs: number;
  /** Timeout in milliseconds for Redis health check */
  redisTimeoutMs: number;
  /** Whether to include system information in response */
  includeSystemInfo: boolean;
  /** Application version string */
  version: string;
}

/**
 * Default health check configuration
 */
export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  databaseTimeoutMs: 5000,
  redisTimeoutMs: 5000,
  includeSystemInfo: true,
  version: process.env.APP_VERSION || process.env.npm_package_version || '1.0.0',
};

// ============================================
// Service Clients
// ============================================

/**
 * Global Prisma client instance
 */
const prisma = new PrismaClient();

/**
 * Redis client instance with lazy initialization
 */
let redisClient: Redis | null = null;
let redisConnectionPromise: Promise<Redis> | null = null;

/**
 * Gets or creates the Redis client with connection management
 */
const getRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 10000,
      retryStrategy: (times) => {
        if (times > 1) {
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000);
      },
    });

    redisClient.on('error', (err) => {
      console.error('[HealthCheck] Redis client error:', err.message);
    });

    redisClient.on('close', () => {
      console.log('[HealthCheck] Redis connection closed');
      redisClient = null;
      redisConnectionPromise = null;
    });
  }
  return redisClient;
};

/**
 * Establishes Redis connection with proper cleanup
 */
const connectRedis = async (): Promise<Redis> => {
  const client = getRedisClient();
  
  if (client.status === 'wait') {
    try {
      await client.connect();
    } catch (error) {
      // Connection may already be in progress or failed
      if (client.status !== 'ready') {
        throw error;
      }
    }
  }
  
  return client;
};

/**
 * Safely closes Redis connection and cleans up resources
 */
export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (error) {
      console.error('[HealthCheck] Error closing Redis connection:', error);
    } finally {
      redisClient = null;
      redisConnectionPromise = null;
    }
  }
};

/**
 * Safely disconnects Prisma client
 */
export const closeDatabaseConnection = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error('[HealthCheck] Error closing database connection:', error);
  }
};

// ============================================
// Health Check Functions
// ============================================

/**
 * Result type for individual service health checks
 */
export interface ServiceHealthResult {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}

/**
 * Checks database health with timeout support
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Promise resolving to health check result
 */
export const checkDatabaseHealth = async (timeoutMs: number = DEFAULT_HEALTH_CHECK_CONFIG.databaseTimeoutMs): Promise<ServiceHealthResult> => {
  const startTime = Date.now();

  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Database health check timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // Race the actual health check against the timeout
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      timeoutPromise,
    ]);

    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';

    return {
      status: 'unhealthy',
      responseTime,
      error: errorMessage,
    };
  }
};

/**
 * Checks Redis health with timeout support
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Promise resolving to health check result
 */
export const checkRedisHealth = async (timeoutMs: number = DEFAULT_HEALTH_CHECK_CONFIG.redisTimeoutMs): Promise<ServiceHealthResult> => {
  const startTime = Date.now();

  let client: Redis | null = null;

  try {
    // Connect to Redis
    client = await connectRedis();

    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Redis health check timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // Race the actual health check against the timeout
    await Promise.race([
      client.ping(),
      timeoutPromise,
    ]);

    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown Redis error';

    // Clean up failed connection
    if (client && client.status !== 'ready') {
      try {
        await client.quit();
      } catch {
        // Ignore cleanup errors
      }
      redisClient = null;
      redisConnectionPromise = null;
    }

    return {
      status: 'unhealthy',
      responseTime,
      error: errorMessage,
    };
  }
};

/**
 * Collects system information for health check response
 * @returns Object containing system metrics
 */
const getSystemInfo = () => {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  return {
    cpuUsage: os.loadavg()[0] / os.cpus().length,
    memoryUsage: {
      total: totalMemory,
      free: freeMemory,
      used: usedMemory,
      usagePercent: (usedMemory / totalMemory) * 100,
    },
    platform: os.platform(),
    nodeVersion: process.version,
  };
};

// ============================================
// Main Route Handler
// ============================================

/**
 * Express route handler for health check endpoint
 * 
 * Performs comprehensive health checks on all connected services:
 * - Database (PostgreSQL via Prisma)
 * - Redis cache
 * 
 * Returns a JSON response with:
 * - Overall system status (healthy/degraded/unhealthy)
 * - Server uptime in seconds
 * - Application version
 * - Timestamp of the check
 * - Individual service health status
 * - Optional system information (CPU, memory)
 * 
 * Response codes:
 * - 200: All services healthy
 * - 503: One or more services unhealthy
 * - 500: Internal server error during health check
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function for error handling
 */
export const healthCheck = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Run both health checks in parallel with timeout handling
    const [databaseHealth, redisHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

    if (databaseHealth.status === 'healthy' && redisHealth.status === 'healthy') {
      overallStatus = 'healthy';
    } else if (
      databaseHealth.status === 'unhealthy' &&
      redisHealth.status === 'unhealthy'
    ) {
      overallStatus = 'unhealthy';
    } else {
      overallStatus = 'degraded';
    }

    // Build the response object
    const response: HealthCheckResponse = {
      status: overallStatus,
      uptime: process.uptime(),
      version: DEFAULT_HEALTH_CHECK_CONFIG.version,
      timestamp: new Date().toISOString(),
      services: {
        database: databaseHealth,
        redis: redisHealth,
      },
    };

    // Add system information if enabled
    if (DEFAULT_HEALTH_CHECK_CONFIG.includeSystemInfo) {
      response.system = getSystemInfo();
    }

    // Validate response against schema
    const validatedResponse = HealthCheckResponseSchema.parse(response);

    // Return appropriate status code based on overall health
    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    res.status(statusCode).json(validatedResponse);
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      console.error('[HealthCheck] Response validation failed:', error.errors);
      res.status(500).json({
        status: 'unhealthy' as const,
        uptime: process.uptime(),
        version: DEFAULT_HEALTH_CHECK_CONFIG.version,
        timestamp: new Date().toISOString(),
        services: {
          database: { status: 'unhealthy' as const, error: 'Health check failed' },
          redis: { status: 'unhealthy' as const, error: 'Health check failed' },
        },
      });
      return;
    }

    // Pass other errors to Express error handler
    next(error);
  }
};

// ============================================
// Express Router Setup
// ============================================

/**
 * Creates and configures the health check router
 * This can be imported and used in the main Express app
 */
export const createHealthCheckRouter = () => {
  const express = require('express');
  const router = express.Router();

  router.get('/health', healthCheck);

  return router;
};

// ============================================
// Utility Functions for Testing
// ============================================

/**
 * Resets the Redis client state (useful for testing)
 * @internal - Should only be used in test scenarios
 */
export const __resetHealthCheckState = (): void => {
  redisClient = null;
  redisConnectionPromise = null;
};

/**
 * Gets the current Redis client instance
 * @internal - Should only be used in test scenarios
 */
export const __getRedisClient = (): Redis | null => {
  return redisClient;
};

export default healthCheck;
