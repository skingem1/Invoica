import { Request, Response, Router } from 'express';
import { HealthCheckResponseSchema, healthRouter, setPrismaClient, setRedisClient } from '../../src/api/health';

// Mock dependencies
jest.mock('../../src/api/health', () => {
  const actual = jest.requireActual('../../src/api/health');
  return {
    ...actual,
  };
});

// Mock Prisma Client
const mockPrisma = {
  $queryRaw: jest.fn(),
};

// Mock Redis Client
const mockRedis = {
  ping: jest.fn(),
};

describe('Health Check API', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup response mocks
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    mockRequest = {};
    mockResponse = {
      json: jsonMock,
      status: statusMock,
    };

    // Set up mocked clients
    setPrismaClient(mockPrisma as any);
    setRedisClient(mockRedis as any);
  });

  describe('Health Check Response Schema', () => {
    it('should validate a healthy response', () => {
      const healthyResponse = {
        status: 'healthy' as const,
        uptime: 1000,
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00.000Z',
        services: {
          database: {
            status: 'connected' as const,
            latencyMs: 10,
            error: null,
          },
          redis: {
            status: 'connected' as const,
            latencyMs: 5,
            error: null,
          },
        },
      };

      const result = HealthCheckResponseSchema.safeParse(healthyResponse);
      expect(result.success).toBe(true);
    });

    it('should validate a degraded response', () => {
      const degradedResponse = {
        status: 'degraded' as const,
        uptime: 5000,
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00.000Z',
        services: {
          database: {
            status: 'connected' as const,
            latencyMs: 10,
            error: null,
          },
          redis: {
            status: 'disconnected' as const,
            latencyMs: null,
            error: 'Redis client not initialized',
          },
        },
      };

      const result = HealthCheckResponseSchema.safeParse(degradedResponse);
      expect(result.success).toBe(true);
    });

    it('should validate an unhealthy response', () => {
      const unhealthyResponse = {
        status: 'unhealthy' as const,
        uptime: 10000,
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00.000Z',
        services: {
          database: {
            status: 'error' as const,
            latencyMs: null,
            error: 'Connection refused',
          },
          redis: {
            status: 'error' as const,
            latencyMs: null,
            error: 'Connection refused',
          },
        },
      };

      const result = HealthCheckResponseSchema.safeParse(unhealthyResponse);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status values', () => {
      const invalidResponse = {
        status: 'invalid',
        uptime: 1000,
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00.000Z',
        services: {
          database: {
            status: 'connected',
            latencyMs: 10,
          },
          redis: {
            status: 'connected',
            latencyMs: 5,
          },
        },
      };

      const result = HealthCheckResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should require all required fields', () => {
      const incompleteResponse = {
        status: 'healthy',
        uptime: 1000,
      };

      const result = HealthCheckResponseSchema.safeParse(incompleteResponse);
      expect(result.success).toBe(false);
    });
  });

  describe('GET /api/health', () => {
    it('should return 200 with healthy status when all services are connected', async () => {
      // Setup successful database ping
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockRedis.ping.mockResolvedValue('PONG');

      // Get the route handler
      const handler = healthRouter.stack[0].route.stack[0].handle;
      
      await handler(mockRequest as Request, mockResponse as Response);

      // Verify response
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          version: expect.any(String),
          uptime: expect.any(Number),
          timestamp: expect.any(String),
          services: {
            database: {
              status: 'connected',
              latencyMs: expect.any(Number),
              error: null,
            },
            redis: {
              status: 'connected',
              latencyMs: expect.any(Number),
              error: null,
            },
          },
        })
      );
    });

    it('should return 200 with degraded status when one service is down', async () => {
      // Database connected, Redis disconnected
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

      const handler = healthRouter.stack[0].route.stack[0].handle;
      
      await handler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'degraded',
          services: {
            database: { status: 'connected' },
            redis: { status: 'error' },
          },
        })
      );
    });

    it('should return 503 with unhealthy status when all services are down', async () => {
      // Both services fail
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB Connection failed'));
      mockRedis.ping.mockRejectedValue(new Error('Redis Connection failed'));

      const handler = healthRouter.stack[0].route.stack[0].handle;
      
      await handler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy',
          services: {
            database: { status: 'error' },
            redis: { status: 'error' },
          },
        })
      );
    });

    it('should return degraded when database is disconnected', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Not initialized'));
      mockRedis.ping.mockResolvedValue('PONG');

      const handler = healthRouter.stack[0].route.stack[0].handle;
      
      await handler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'degraded',
          services: {
            database: { status: 'error' },
            redis: { status: 'connected' },
          },
        })
      );
    });

    it('should include latency measurements in response', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockRedis.ping.mockResolvedValue('PONG');

      const handler = healthRouter.stack[0].route.stack[0].handle;
      
      await handler(mockRequest as Request, mockResponse as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response.services.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.services.redis.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should include version from environment', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockRedis.ping.mockResolvedValue('PONG');

      const handler = healthRouter.stack[0].route.stack[0].handle;
      
      await handler(mockRequest as Request, mockResponse as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response.version).toBeDefined();
      expect(typeof response.version).toBe('string');
    });

    it('should include uptime greater than zero', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockRedis.ping.mockResolvedValue('PONG');

      const handler = healthRouter.stack[0].route.stack[0].handle;
      
      await handler(mockRequest as Request, mockResponse as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response.uptime).toBeGreaterThan(0);
    });

    it('should include ISO timestamp', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockRedis.ping.mockResolvedValue('PONG');

      const handler = healthRouter.stack[0].route.stack[0].handle;
      
      await handler(mockRequest as Request, mockResponse as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Force an unexpected error by making Prisma throw
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Unexpected'));
      
      // Make Redis also throw to trigger error handling path
      mockRedis.ping.mockRejectedValue(new Error('Unexpected'));

      const handler = healthRouter.stack[0].route.stack[0].handle;
      
      await handler(mockRequest as Request, mockResponse as Response);

      // Should still return a valid response structure
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy',
          version: expect.any(String),
          uptime: expect.any(Number),
          timestamp: expect.any(String),
          services: expect.any(Object),
        })
      );
    });
  });

  describe('Service Status Determination', () => {
    it('should return healthy when both services connected', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockRedis.ping.mockResolvedValue('PONG');

      const handler = healthRouter.stack[0].route.stack[0].handle;
      await handler(mockRequest as Request, mockResponse as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response.status).toBe('healthy');
    });

    it('should return degraded when database disconnected', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB down'));
      mockRedis.ping.mockResolvedValue('PONG');

      const handler = healthRouter.stack[0].route.stack[0].handle;
      await handler(mockRequest as Request, mockResponse as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response.status).toBe('degraded');
    });

    it('should return degraded when redis disconnected', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockRedis.ping.mockRejectedValue(new Error('Redis down'));

      const handler = healthRouter.stack[0].route.stack[0].handle;
      await handler(mockRequest as Request, mockResponse as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response.status).toBe('degraded');
    });

    it('should return unhealthy when both services disconnected', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB down'));
      mockRedis.ping.mockRejectedValue(new Error('Redis down'));

      const handler = healthRouter.stack[0].route.stack[0].handle;
      await handler(mockRequest as Request, mockResponse as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response.status).toBe('unhealthy');
      expect(statusMock).toHaveBeenCalledWith(503);
    });
  });
});
