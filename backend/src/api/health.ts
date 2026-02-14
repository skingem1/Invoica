import { z } from 'zod';

/**
 * Health check response schema
 */
const HealthCheckResponseSchema = z.object({
  status: z.literal('healthy'),
  uptime: z.number(),
  timestamp: z.string().datetime(),
  version: z.string(),
});

/**
 * Health check response type
 */
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

/**
 * Performs a basic health check of the server.
 * Returns core health metrics without checking external dependencies.
 *
 * @returns Health check response with server status, uptime, timestamp, and version
 * @throws Error if health check fails
 *
 * @example
 * const health = await checkHealth();
 * console.log(health.status); // 'healthy'
 */
export function checkHealth(): HealthCheckResponse {
  const healthCheckResponse = {
    status: 'healthy' as const,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  };

  return HealthCheckResponseSchema.parse(healthCheckResponse);
}
