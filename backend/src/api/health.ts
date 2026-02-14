<think>
The user wants me to create a health check endpoint at `/api/health` that returns:
- Server status
- Uptime
- Version
- Connected services status (database, redis)

Requirements:
- TypeScript strict mode
- Zod for response validation
- JSDoc comments
- File: backend/src/api/health.ts

I need to create a complete file with:
1. Imports (Express, Zod, Prisma, Redis client)
2. Zod schema for response validation
3. Health check logic for database and Redis
4. Express route handler
5. Proper error handling
6. JSDoc comments

Let me structure this properly:

```typescript
import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

// Need to get version from package.json somehow - might need to import from config
import { config } from '../config/index.js';

const router = Router();

// Prisma client instance - would typically be injected or imported
const prisma = new PrismaClient();

// Redis client instance - would typically be injected or imported
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
});

// Track server start time
const serverStartTime = Date.now();

// Zod schema for health check response
const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  uptime: z.number(),
  version: z.string(),
  timestamp: z.string(),
  services: z.object({
    database: z.object({
      status: z.enum(['connected', 'disconnected', 'error']),
      latency: z.number().nullable(),
      error: z.string().nullable().optional(),
    }),
    redis: z.object({
      status: z.enum(['connected', 'disconnected', 'error']),
      latency: z.number().nullable(),
      error: z.string().nullable().optional(),
    }),
  }),
});

type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
```

I'll create helper functions to check database and Redis connectivity, then implement the main endpoint handler with proper validation and error handling.

```typescript
/**
 * Checks the health of the database connection
 */
async function checkDatabaseHealth(): Promise<{
  status: 'connected' | 'disconnected' | 'error';
  latency: number | null;
  error: string | null;
}> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    return { status: 'connected', latency, error: null };
  } catch (error) {
    return {
      status: 'error',
      latency: null,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Checks the health of the Redis connection
 */
async function checkRedisHealth(): Promise<{
  status: 'connected' | 'disconnected' | 'error';
  latency: number | null;
  error: string | null;
}> {
  const start = Date.now();
  try {
    await redis.ping();
    const latency = Date.now() - start;
    return { status: 'connected', latency, error: null };
  } catch (error) {
    return {
      status: 'error',
      latency: null,
      error: error instanceof Error ? error.message : 'Unknown Redis error',
    };
  }
}

/**
 * GET /api/health
 * Returns server health status including uptime, version, and service dependencies
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const overallStatus = 
      dbHealth.status === 'connected' && redisHealth.status === 'connected'
        ? 'healthy'
        : dbHealth.status === 'error' || redisHealth.status === 'error'
          ? 'unhealthy'
          : 'degraded';

    const response: HealthCheckResponse = {
      status: overallStatus,
      uptime: Date.now() - serverStartTime,
      version: config.app.version,
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth,
        redis: redisHealth,
      },
    };

    const validatedResponse = HealthCheckResponseSchema.parse(response);
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
    res.status(statusCode).json(validatedResponse);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed',
    });
  }
});

export default router;
```

I need to ensure the Redis client is properly typed and update the imports accordingly. Since this is a complete file, I'll remove placeholder comments and add proper JSDoc documentation. The health check endpoint validates service connectivity and returns the appropriate status code based on dependency availability.
</think>

```typescript
import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const router = Router();

// Prisma client for database connection
const prisma = new PrismaClient();

// Redis client for cache/queue connection
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
});

// Server start time for uptime calculation
const serverStartTime = Date.now();

/**
 * Application version from environment or package.json
 * Defaults to '1.0.0' if not set
 */
const APP_VERSION = process.env.APP_VERSION || '1.0.0';

/**
 * Zod schema for health check response validation
 */
const ServiceHealthSchema = z.object({
  status: z.enum(['connected', 'disconnected', 'error']),
  latency: z.number().nullable(),
  error: z.string().nullable().optional(),
});

const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  uptime: z.number(),
  version: z.string(),
  timestamp: z.string(),
  services: z.object({
    database: ServiceHealthSchema,
    redis: ServiceHealthSchema,
  }),
});

type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

/**
 * Checks the health status of the PostgreSQL database connection
 * @returns Promise resolving to database health status with latency in milliseconds
 */
async function checkDatabaseHealth(): Promise<{
  status: 'connected' | 'disconnected' | 'error';
  latency: number | null;
  error: string | null;
}> {
  const start = Date.now();
  try {
    // Simple query to verify database connectivity
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    return { status: 'connected', latency, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    return {
      status: 'error',
      latency: null,
      error: errorMessage,
    };
  }
}

/**
 * Checks the health status of the Redis connection
 * @returns Promise resolving to Redis health status with latency in milliseconds
 */
async function checkRedisHealth(): Promise<{
  status: 'connected' | 'disconnected' | 'error';
  latency: number | null;
  error: string | null;
}> {
  const start = Date.now();
  try {
    // Ping Redis to verify connection
    await redis.ping();
    const latency = Date.now() - start;
    return { status: 'connected', latency, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Redis error';
    return {
      status: 'error',
      latency: null,
      error: errorMessage,
    };
  }
}

/**
 * Determines the overall health status based on service statuses
 * @param dbStatus - Database connection status
 * @param redisStatus - Redis connection status
 * @returns Overall health status enum value
 */
function determineOverallStatus(
  dbStatus: 'connected' | 'disconnected' | 'error',
  redisStatus: 'connected' | 'disconnected' | 'error'
): 'healthy' | 'degraded' | 'unhealthy' {
  // All services connected = healthy
  if (dbStatus === 'connected' && redisStatus === 'connected') {
    return 'healthy';
  }
  
  // Any service in error state = unhealthy
  if (dbStatus === 'error' || redisStatus === 'error') {
    return 'unhealthy';
  }
  
  // Any service disconnected but not error = degraded
  return 'degraded';
}

/**
 * GET /api/health
 * 
 * Returns server health status including:
 * - Overall status (healthy/degraded/unhealthy)
 * - Server uptime in milliseconds
 * - Application version
 * - Timestamp of the health check
 * - Individual service status for database and Redis
 * 
 * @route GET /api/health
 * @returns {200} Health check successful - server is operational
 * @returns {503} Health check failed - one or more services unavailable
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Check all services in parallel for better performance
    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    // Determine overall health status
    const overallStatus = determineOverallStatus(dbHealth.status, redisHealth.status);

    // Calculate uptime in milliseconds
    const uptime = Date.now() - serverStartTime;

    // Build the response object
    const response: HealthCheckResponse = {
      status: overallStatus,
      uptime,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth,
        redis: redisHealth,
      },
    };

    // Validate response against Zod schema
    const validatedResponse = HealthCheckResponseSchema.parse(response);

    // Set appropriate HTTP status code based on health
    const httpStatus = overallStatus === 'healthy' || overallStatus === 'degraded' 
      ? 200 
      : 503;

    res.status(httpStatus).json(validatedResponse);
  } catch (error) {
    // Log the error for debugging
    console.error('Health check failed:', error);

    // Return error response
    const errorResponse = {
      status: 'unhealthy' as const,
      uptime: Date.now() - serverStartTime,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: 'error' as const,
          latency: null,
          error: 'Health check failed',
        },
        redis: {
          status: 'error' as const,
          latency: null,
          error: 'Health check failed',
        },
      },
    };

    res.status(503).json(errorResponse);
  }
});

export default router;
```