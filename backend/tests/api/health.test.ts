import { Request, Response, NextFunction } from 'express';
import { HealthCheckService, createHealthRouter, HealthResponseSchema } from '../../src/api/health';
import { PrismaClient } from '@prisma/client';

// Mock dependencies
jest.mock('../../src/utils/logger.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  })),
}));

describe('Health Check API', () => {
  let mockPrisma: Partial<PrismaClient>;
  let healthService: HealthCheckService;
  let mockRedisClient: any;

  const mockConfig = {
    redisUrl: 'redis://localhost:6379',
    version: '1.0.0',
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock Prisma client
    mockPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    // Create health service instance
    healthService = new HealthCheckService(mockPrisma as PrismaClient, mockConfig);

    // Get mock Redis client from createClient
    const { createClient } = require('redis');
    mockRedisClient = createClient();
  });

  afterEach(async () => {
    await healthService.close();
  });

  describe('HealthCheckService', () => {
    describe('checkDatabase', () => {
      it('should return connected status when database is healthy', async () => {
        const result = await healthService.checkDatabase();

        expect(result.status).toBe('connected');
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
        expect(result.error).toBeUndefined();
      });

      it('should return error status when database query fails', async () => {
        mockPrisma.$queryRaw = jest.fn().mockRejectedValue(new Error('Database connection failed'));

        const result = await healthService.checkDatabase();

        expect(result.status).toBe('error');
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
        expect(result.error).toBe('Database connection failed');
      });

      it('should measure latency accurately', async () => {
        const start = performance.now();
        await healthService.checkDatabase();
        const end = performance.now();

        // The latency should be captured
        const result = await healthService.checkDatabase();
        expect(result.latencyMs).toBeLessThanOrEqual(end - start + 10);
      });
    });

    describe('checkRedis', () => {
      beforeEach(async () => {
        await healthService.initializeRedis(mockConfig.redisUrl);
      });

      it('should return connected status when Redis is healthy', async () => {
        const result = await healthService.checkRedis();

        expect(result.status).toBe('connected');
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
        expect(result.error).toBeUndefined();
      });

      it('should return error status when Redis ping fails', async () => {
        const { createClient } = require('redis');
        const mockFailedClient = {
          connect: jest.fn().mockResolvedValue(undefined),
          ping: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
          quit: jest.fn().mockResolvedValue(undefined),
          on: jest.fn(),
        };
        createClient.mockReturnValue(mockFailedClient);

        const failingService = new HealthCheckService(mockPrisma as PrismaClient, mockConfig);
        await failingService.initializeRedis(mockConfig.redisUrl);

        const result = await failingService.checkRedis();

        expect(result.status).toBe('error');
        expect(result.error).toBe('Redis connection failed');
        
        await failingService.close();
      });

      it('should return disconnected status when Redis client is not initialized', async () => {
        const uninitializedService = new HealthCheckService(mockPrisma as PrismaClient, mockConfig);
        
        const result = await uninitializedService.checkRedis();

        expect(result.status).toBe('disconnected');
        expect(result.latencyMs).toBeNull();
        expect(result.error).toBe('Redis client not initialized');
      });
    });

    describe('check', () => {
      beforeEach(async () => {
        await healthService.initializeRedis(mockConfig.redisUrl);
      });

      it('should return healthy status when all services are connected', async () => {
        const result = await healthService.check();

        expect(result.status).toBe('healthy');
        expect(result.uptime).toBeGreaterThanOrEqual(0);
        expect(result.version).toBe('1.0.0');
        expect(result.timestamp).toBeDefined();
        expect(result.services.database.status).toBe('connected');
        expect(result.services.redis.status).toBe('connected');
      });

      it('should return degraded status when Redis is disconnected', async () => {
        const degradedService = new HealthCheckService(mockPrisma as PrismaClient, mockConfig);
        
        const result = await degradedService.check();

        expect(result.status).toBe('degraded');
        expect(result.services.redis.status).toBe('disconnected');
      });

      it('should return unhealthy status when database has error', async () => {
        mockPrisma.$queryRaw = jest.fn().mockRejectedValue(new Error('DB Error'));
        
        const result = await healthService.check();

        expect(result.status).toBe('unhealthy');
        expect(result.services.database.status).toBe('error');
      });

      it('should include timestamp in ISO 8601 format', async () => {
        const result = await healthService.check();

        expect(() => new Date(result.timestamp)).not.toThrow();
        expect(result.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });

      it('should validate response against Zod schema', async () => {
        const result = await healthService.check();
        
        // Should not throw - validates successfully
        expect(() => HealthResponseSchema.parse(result)).not.toThrow();
      });
    });
  });

  describe('createHealthRouter', () => {
    let router: ReturnType<typeof createHealthRouter>;
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(async () => {
      await healthService.initializeRedis(mockConfig.redisUrl);
      router = createHealthRouter(healthService);

      mockReq = {};
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockNext = jest.fn();
    });

    it('should create router with GET / route', () => {
      const routes = router.stack.map((layer: any) => ({
        path: layer.route?.path,
        method: layer.route?.methods,
      }));

      expect(routes).toContainEqual({
        path: '/',
        method: { get: true },
      });
    });

    it('should return 200 status when health is healthy', async () => {
      // Get the route handler
      const route = router.stack.find((layer: any) => layer.route?.path === '/');
      const handler = route.route.stack[0].handle;

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should return 503 status when health is unhealthy', async () => {
      mockPrisma.$queryRaw = jest.fn().mockRejectedValue(new Error('Failed'));
      
      // Create new service with failing database
      const failingService = new HealthCheckService(mockPrisma as PrismaClient, mockConfig);
      await failingService.initializeRedis(mockConfig.redisUrl);
      const failingRouter = createHealthRouter(failingService);

      const route = failingRouter.stack.find((layer: any) => layer.route?.path === '/');
      const handler = route.route.stack[0].handle;

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      
      await failingService.close();
    });

    it('should return correct response structure', async () => {
      const route = router.stack.find((layer: any) => layer.route?.path === '/');
      const handler = route.route.stack[0].handle;

      await handler(mockReq as Request, mockRes as Response, mockNext);

      const calledJson = (mockRes.json as jest.Mock).mock.calls[0][0];
      
      expect(calledJson).toHaveProperty('status');
      expect(calledJson).toHaveProperty('uptime');
      expect(calledJson).toHaveProperty('version');
      expect(calledJson).toHaveProperty('timestamp');
      expect(calledJson).toHaveProperty('services');
      expect(calledJson.services).toHaveProperty('database');
      expect(calledJson.services).toHaveProperty('redis');
    });

    it('should handle unexpected errors and return 500', async () => {
      mockPrisma.$queryRaw = jest.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const errorService = new HealthCheckService(mockPrisma as PrismaClient, mockConfig);
      const errorRouter = createHealthRouter(errorService);

      const route = errorRouter.stack.find((layer: any) => layer.route?.path === '/');
      const handler = route.route.stack[0].handle;

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      
      const calledJson = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(calledJson.status).toBe('unhealthy');
    });
  });

  describe('HealthResponseSchema', () => {
    it('should validate correct health response', () => {
      const validResponse = {
        status: 'healthy' as const,
        uptime: 100,
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00.000Z',
        services: {
          database: {
            status: 'connected' as const,
            latencyMs: 10,
          },
          redis: {
            status: 'connected' as const,
            latencyMs: 5,
          },
        },
      };

      const result = HealthResponseSchema.parse(validResponse);
      expect(result).toEqual(validResponse);
    });

    it('should reject invalid status values', () => {
      const invalidResponse = {
        status: 'invalid-status',
        uptime: 100,
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

      expect(() => HealthResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should reject negative uptime', () => {
      const invalidResponse = {
        status: 'healthy' as const,
        uptime: -1,
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00.000Z',
        services: {
          database: {
            status: 'connected' as const,
            latencyMs: 10,
          },
          redis: {
            status: 'connected' as const,
            latencyMs: 5,
          },
        },
      };

      expect(() => HealthResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should allow optional error field in services', () => {
      const responseWithError = {
        status: 'unhealthy' as const,
        uptime: 100,
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00.000Z',
        services: {
          database: {
            status: 'error' as const,
            latencyMs: 10,
            error: 'Connection failed',
          },
          redis: {
            status: 'error' as const,
            latencyMs: 5,
            error: 'Connection failed',
          },
        },
      };

      const result = HealthResponseSchema.parse(responseWithError);
      expect(result.services.database.error).toBe('Connection failed');
    });
  });
});
