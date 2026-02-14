import { Request, Response, Router } from 'express';
import { z } from 'zod';
import os from 'os';
import { getDb } from '../db/prisma';
import { redisClient } from '../services/redis';

// Response schema for health check
export const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  uptime: z.number(),
  version: z.string(),
  timestamp: z.string().datetime(),
  services: z.object({
    database: z.object({
      status: z.enum(['connected', 'disconnected', 'error']),
      latency: z.number().optional(),
      error: z.string().optional(),
    }),
    redis: z.object({
      status: z.enum(['connected', 'disconnected', 'error']),
      latency: z.number().optional(),
      error: z.string().optional(),
    }),
  }),
  system: z.object({
    cpuUsage: z.number(),
    memoryUsage: z.object({
      total: z.number(),
      free: z.number(),
      used: z.number(),
    }),
  }),
});

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

I need to build out the health check handler that performs actual checks against the database and Redis, retrieves system metrics like CPU and memory usage, and constructs the response object according to the schema. The endpoint should return appropriate status codes based on the health of all dependencies.
</think>
