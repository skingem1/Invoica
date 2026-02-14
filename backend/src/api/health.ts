import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

/**
 * Schema for individual service health status.
 */
const ServiceStatusSchema = z.object({
  status: z.enum(['connected', 'disconnected']),
  latencyMs: z.number().nonnegative(),
  error: z.string().optional(),
});

/**
 * Schema for the complete health check response.
 */
const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  version: z.string(),
  uptime: z.number().nonnegative(),
  timestamp: z.string().datetime(),
  services: z.object({
    database: ServiceStatusSchema,
    redis: ServiceStatusSchema,
  }),
});

type ServiceStatus = z.infer<typeof ServiceStatusSchema>;
type HealthResponse = z.infer<typeof HealthResponseSchema>;

/**
 * Checks PostgreSQL database connectivity via Prisma.
 * Executes a lightweight query and measures round-trip latency.
 *
 * @param prisma - The Prisma client instance
 * @returns A ServiceStatus object indicating database health
 */
async function checkDatabase(prisma: PrismaClient): Promise<ServiceStatus> {
  const start = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Math.round(performance.now() - start);
    return { status: 'connected', latencyMs };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : 'Unknown database error';
    return { status: 'disconnected', latencyMs, error: message };
  }
}

/**
 * Checks Redis connectivity by issuing a PING command.
 * Measures round-trip latency for the operation.
 *
 * @param redis - The ioredis client instance
 * @returns A ServiceStatus object indicating Redis health
 */
async function checkRedis(redis: Redis): Promise<ServiceStatus> {
  const start = performance.now();
  try {
    const result = await redis.ping();
    const latencyMs = Math.round(performance.now() - start);
    if (result !== 'PONG') {
      return { status: 'disconnected', latencyMs, error: `Unexpected PING response: ${result}` };
    }
    return { status: 'connected', latencyMs };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : 'Unknown Redis error';
    return { status: 'disconnected', latencyMs, error: message };
  }
}

/**
 * Derives the overall server status from individual service statuses.
 *
 * @param services - Object containing status of each downstream service
 * @returns 'healthy' if all connected, 'degraded' if some connected, 'unhealthy' if none
 */
function deriveOverallStatus(
  services: HealthResponse['services']
): HealthResponse['status'] {
  const statuses = Object.values(services).map((s) => s.status);
  const connectedCount = statuses.filter((s) => s === 'connected').length;

  if (connectedCount === statuses.length) {
    return 'healthy';
  }
  if (connectedCount > 0) {
    return 'degraded';
  }
  return 'unhealthy';
}

/**
 * Configuration options for the health check router.
 */
export interface HealthRouterDependencies {
  /** Prisma client for database connectivity checks */
  prisma: PrismaClient;
  /** ioredis client for Redis connectivity checks */
  redis: Redis;
  /** Application version string (defaults to package.json version or '0.0.0') */
  version?: string;
}

/**
 * Creates an Express Router with a GET /api/health endpoint.
 *
 * The endpoint performs concurrent connectivity checks against PostgreSQL
 * and Redis, then returns a Zod-validated JSON response containing:
 * - Overall server status (healthy | degraded | unhealthy)
 * - Application version
 * - Process uptime in seconds
 * - ISO-8601 timestamp
 * - Per-service status with latency measurements
 *
 * Returns HTTP 200 when healthy or degraded, HTTP 503 when unhealthy.
 *
 * @param deps - Injected dependencies (prisma, redis, optional version)
 * @returns Express Router bound to GET /api/health
 *
 * @example
 *
