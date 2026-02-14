import { Router, Request, Response } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";

/**
 * Schema for individual service health status.
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

/** Inferred TypeScript types from Zod schemas */
type ServiceStatus = z.infer<typeof ServiceStatusSchema>;
type HealthResponse = z.infer<typeof HealthResponseSchema>;

/**
 * Checks database connectivity by executing a lightweight query.
 * @param prisma - The Prisma client instance
 * @returns A ServiceStatus indicating database health
 */
async function checkDatabase(prisma: PrismaClient): Promise<ServiceStatus> {
  const start = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    return { status: "connected", latencyMs };
  } catch (err: unknown) {
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    const message = err instanceof Error ? err.message : "Unknown database error";
    return { status: "disconnected", latencyMs, error: message };
  }
}

/**
 * Checks Redis connectivity by issuing a PING command.
 * @param redis - The ioredis client instance
 * @returns A ServiceStatus indicating Redis health
 */
async function checkRedis(redis: Redis): Promise<ServiceStatus> {
  const start = performance.now();
  try {
    const pong = await redis.ping();
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    if (pong !== "PONG") {
      return { status: "disconnected", latencyMs, error: `Unexpected PING response: ${pong}` };
    }
    return { status: "connected", latencyMs };
  } catch (err: unknown) {
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    const message = err instanceof Error ? err.message : "Unknown Redis error";
    return { status: "disconnected", latencyMs, error: message };
  }
}

/**
 * Derives the overall system status from individual service statuses.
 * - "healthy" if all services are connected
 * - "degraded" if at least one service is connected
 * - "unhealthy" if no services are connected
 * @param services - Record of service statuses
 * @returns The aggregate status
 */
function deriveOverallStatus(
  services: Record<string, ServiceStatus>
): HealthResponse["status"] {
  const statuses = Object.values(services);
  const connectedCount = statuses.filter((s) => s.status === "connected").length;

  if (connectedCount === statuses.length) {
    return "healthy";
  }
  if (connectedCount > 0) {
    return "degraded";
  }
  return "unhealthy";
}

/**
 * Configuration for the health check router.
 */
interface HealthRouterDependencies {
  prisma: PrismaClient;
  redis: Redis;
  version?: string;
}

/**
 * Creates an Express Router with a GET /api/health endpoint.
 *
 * The endpoint returns the current server status, uptime in seconds,
 * application version, and connectivity status of database and Redis.
 *
 * @param deps - External dependencies (Prisma client, Redis client, optional version)
 * @returns An Express Router bound to the health check handler
 *
 * @example
 *
