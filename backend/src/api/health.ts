import { Router, Request, Response } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

/**
 * Schema for an individual service health status.
 */
const ServiceStatusSchema = z.object({
  status: z.enum(["connected", "disconnected"]),
  latencyMs: z.number().nonnegative(),
  error: z.string().optional(),
});

/**
 * Schema for the complete health check response.
 */
const HealthResponseSchema = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  uptime: z.number().nonnegative(),
  version: z.string(),
  timestamp: z.string().datetime(),
  services: z.object({
    database: ServiceStatusSchema,
    redis: ServiceStatusSchema,
  }),
});

/** Inferred TypeScript type for a single service status. */
type ServiceStatus = z.infer<typeof ServiceStatusSchema>;

/** Inferred TypeScript type for the full health response payload. */
type HealthResponse = z.infer<typeof HealthResponseSchema>;

/**
 * Probes the PostgreSQL database via Prisma and returns its connection status.
 *
 * @param prisma - The Prisma client instance to check.
 * @returns A `ServiceStatus` indicating whether the database is reachable.
 */
async function checkDatabase(prisma: PrismaClient): Promise<ServiceStatus> {
  const start = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    return { status: "connected", latencyMs };
  } catch (err: unknown) {
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    const message =
      err instanceof Error ? err.message : "Unknown database error";
    return { status: "disconnected", latencyMs, error: message };
  }
}

/**
 * Probes the Redis instance and returns its connection status.
 *
 * @param redis - The ioredis client instance to check.
 * @returns A `ServiceStatus` indicating whether Redis is reachable.
 */
async function checkRedis(redis: Redis): Promise<ServiceStatus> {
  const start = performance.now();
  try {
    const result = await redis.ping();
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    if (result !== "PONG") {
      return {
        status: "disconnected",
        latencyMs,
        error: `Unexpected PING response: ${result}`,
      };
    }
    return { status: "connected", latencyMs };
  } catch (err: unknown) {
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    const message =
      err instanceof Error ? err.message : "Unknown Redis error";
    return { status: "disconnected", latencyMs, error: message };
  }
}

/**
 * Derives the overall server status from individual service statuses.
 *
 * - `healthy`   – all services connected
 * - `degraded`  – at least one service disconnected but not all
 * - `unhealthy` – all services disconnected
 *
 * @param services - Map of service names to their statuses.
 * @returns The aggregate health status string.
 */
function deriveOverallStatus(
  services: Record<string, ServiceStatus>
): HealthResponse["status"] {
  const statuses = Object.values(services);
  const disconnectedCount = statuses.filter(
    (s) => s.status === "disconnected"
  ).length;

  if (disconnectedCount === 0) {
    return "healthy";
  }
  if (disconnectedCount === statuses.length) {
    return "unhealthy";
  }
  return "degraded";
}

/**
 * Options required to create the health check router.
 */
export interface HealthRouterDependencies {
  /** Prisma client used to probe the database. */
  prisma: PrismaClient;
  /** ioredis client used to probe Redis. */
  redis: Redis;
  /** Application version string (e.g. from package.json). */
  version: string;
}

/**
 * Creates an Express Router with a GET /api/health endpoint.
 *
 * The endpoint returns the server status, uptime, application version,
 * current timestamp, and the connection status of PostgreSQL and Redis.
 *
 * @param deps - External dependencies injected into the router.
 * @returns An Express `Router` instance mounted at /api/health.
 *
 * @example
 *
