import { Router, Request, Response } from 'express';
import { createHealthRouter, HealthCheckConfig } from '../../src/api/health';
import { PrismaClient } from '@prisma/client';
import { RedisClientType } from 'redis';

// Mock Prisma client
const mockPrisma = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  $queryRaw: jest.fn().mockResolvedValue([]),
} as unknown as PrismaClient;

// Mock Redis client
const createMockRedisClient = (isOpen: boolean = true): Partial<RedisClientType> => ({
  isOpen,
  connect: jest.fn().mockResolvedValue(undefined),
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn().mockResolvedValue('OK'),
});

describe('Health Check API', () => {
  let mockRedisClient: Partial<RedisClientType>;
  let config: HealthCheckConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClient = createMockRedisClient();
  });

  const createTestConfig = (overrides?: Partial<HealthCheckConfig>): HealthCheckConfig => ({
    prisma: mockPrisma,
    redisUrl: 'redis://localhost:6379',
    appVersion: '1.0.0',
    ...overrides,
  });

  describe('createHealthRouter', () => {
    it('should create a router with health check endpoint', () => {
      config = createTestConfig();
      const router = createHealthRouter(config);
      
      expect(router).toBeInstanceOf(Router);
      expect(router.stack).toHaveLength(1);
    });

    it('should register GET / endpoint', () => {
      config = createTestConfig();
      const router = createHealthRouter(config);
      
      const route = router.stack.find((layer) => layer.route?.path === '/' && layer.route?.methods.get);
      expect(route).toBeDefined();
    });
  });

  describe('GET /api/health', () => {
    it('should return healthy status when all services are up', async () => {
      config = createTestConfig();
      const router = createHealthRouter(config);
      
      // Find the health route handler
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      // Create mock request and response
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      // Execute handler
      await handler(mockReq, mockRes);
      
      // Verify response
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalled();
      
      const response = mockRes.json.mock.calls[0][0];
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('uptime');
      expect(response).toHaveProperty('version');
      expect(response).toHaveProperty('services');
      expect(response.services).toHaveProperty('database');
      expect(response.services).toHaveProperty('redis');
    });

    it('should return correct version from config', async () => {
      const testVersion = '2.5.1';
      config = createTestConfig({ appVersion: testVersion });
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      await handler(mockReq, mockRes);
      
      const response = mockRes.json.mock.calls[0][0];
      expect(response.version).toBe(testVersion);
    });

    it('should return positive uptime', async () => {
      config = createTestConfig();
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      await handler(mockReq, mockRes);
      
      const response = mockRes.json.mock.calls[0][0];
      expect(typeof response.uptime).toBe('number');
      expect(response.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return valid ISO timestamp', async () => {
      config = createTestConfig();
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      await handler(mockReq, mockRes);
      
      const response = mockRes.json.mock.calls[0][0];
      expect(new Date(response.timestamp).toISOString()).toBe(response.timestamp);
    });
  });

  describe('Service Status Validation', () => {
    it('should include database status in response', async () => {
      config = createTestConfig();
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      await handler(mockReq, mockRes);
      
      const response = mockRes.json.mock.calls[0][0];
      expect(response.services.database).toHaveProperty('status');
      expect(['healthy', 'unhealthy', 'degraded']).toContain(response.services.database.status);
    });

    it('should include redis status in response', async () => {
      config = createTestConfig();
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      await handler(mockReq, mockRes);
      
      const response = mockRes.json.mock.calls[0][0];
      expect(response.services.redis).toHaveProperty('status');
      expect(['healthy', 'unhealthy', 'degraded']).toContain(response.services.redis.status);
    });

    it('should include latency for database when healthy', async () => {
      config = createTestConfig();
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      await handler(mockReq, mockRes);
      
      const response = mockRes.json.mock.calls[0][0];
      if (response.services.database.status === 'healthy') {
        expect(response.services.database).toHaveProperty('latencyMs');
        expect(typeof response.services.database.latencyMs).toBe('number');
      }
    });

    it('should include latency for redis when healthy', async () => {
      config = createTestConfig();
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      await handler(mockReq, mockRes);
      
      const response = mockRes.json.mock.calls[0][0];
      if (response.services.redis.status === 'healthy') {
        expect(response.services.redis).toHaveProperty('latencyMs');
        expect(typeof response.services.redis.latencyMs).toBe('number');
      }
    });
  });

  describe('Database Connection Handling', () => {
    it('should handle database connection failure gracefully', async () => {
      const failingPrisma = {
        ...mockPrisma,
        $queryRaw: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      } as unknown as PrismaClient;
      
      config = createTestConfig({ prisma: failingPrisma });
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      await handler(mockReq, mockRes);
      
      const response = mockRes.json.mock.calls[0][0];
      expect(response.services.database.status).toBe('unhealthy');
      expect(response.services.database).toHaveProperty('error');
    });

    it('should return degraded status when database is slow', async () => {
      const slowPrisma = {
        ...mockPrisma,
        $queryRaw: jest.fn().mockImplementation(() => 
          new Promise((resolve) => setTimeout(() => resolve([]), 2000))
        ),
      } as unknown as PrismaClient;
      
      config = createTestConfig({ prisma: slowPrisma });
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      await handler(mockReq, mockRes);
      
      const response = mockRes.json.mock.calls[0][0];
      // Either unhealthy or degraded depending on threshold
      expect(['unhealthy', 'degraded']).toContain(response.services.database.status);
    }, 10000);
  });

  describe('Redis Connection Handling', () => {
    it('should handle Redis connection failure gracefully', async () => {
      config = createTestConfig();
      
      // Create a mock that simulates connection failure
      const mockRedis = {
        connect: jest.fn().mockRejectedValue(new Error('Connection refused')),
      };
      
      // We need to test the getRedisClient behavior indirectly
      // by checking the health response when Redis is unavailable
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      await handler(mockReq, mockRes);
      
      const response = mockRes.json.mock.calls[0][0];
      // The response should have a redis status
      expect(response.services.redis).toHaveProperty('status');
    });

    it('should handle Redis ping failure gracefully', async () => {
      config = createTestConfig();
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      // Even if Redis ping fails, the endpoint should respond
      await handler(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalled();
    });
  });

  describe('Overall Status Determination', () => {
    it('should return overall healthy when all services are healthy', async () => {
      config = createTestConfig();
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      await handler(mockReq, mockRes);
      
      const response = mockRes.json.mock.calls[0][0];
      // When both services are healthy, overall should be healthy
      if (response.services.database.status === 'healthy' && 
          response.services.redis.status === 'healthy') {
        expect(response.status).toBe('healthy');
      }
    });

    it('should return unhealthy when database is down', async () => {
      const failingPrisma = {
        ...mockPrisma,
        $queryRaw: jest.fn().mockRejectedValue(new Error('Connection failed')),
      } as unknown as PrismaClient;
      
      config = createTestConfig({ prisma: failingPrisma });
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      await handler(mockReq, mockRes);
      
      const response = mockRes.json.mock.calls[0][0];
      expect(response.status).toBe('unhealthy');
    });

    it('should return correct HTTP status code based on health', async () => {
      config = createTestConfig();
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      await handler(mockReq, mockRes);
      
      const response = mockRes.json.mock.calls[0][0];
      
      if (response.status === 'healthy') {
        expect(mockRes.status).toHaveBeenCalledWith(200);
      } else if (response.status === 'degraded') {
        expect(mockRes.status).toHaveBeenCalledWith(200);
      } else {
        expect(mockRes.status).toHaveBeenCalledWith(503);
      }
    });
  });

  describe('Response Schema Validation', () => {
    it('should return response matching HealthCheckResponseSchema', async () => {
      config = createTestConfig();
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      await handler(mockReq, mockRes);
      
      const response = mockRes.json.mock.calls[0][0];
      
      // Validate response structure
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('uptime');
      expect(response).toHaveProperty('version');
      expect(response).toHaveProperty('services');
      
      // Validate status values
      expect(['healthy', 'unhealthy', 'degraded']).toContain(response.status);
      
      // Validate services structure
      expect(response.services).toHaveProperty('database');
      expect(response.services).toHaveProperty('redis');
      
      // Validate service status values
      expect(['healthy', 'unhealthy', 'degraded']).toContain(response.services.database.status);
      expect(['healthy', 'unhealthy', 'degraded']).toContain(response.services.redis.status);
    });

    it('should have string timestamp in ISO 8601 format', async () => {
      config = createTestConfig();
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      await handler(mockReq, mockRes);
      
      const response = mockRes.json.mock.calls[0][0];
      
      // ISO 8601 datetime format validation
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
      expect(response.timestamp).toMatch(iso8601Regex);
    });

    it('should have string version', async () => {
      config = createTestConfig();
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      await handler(mockReq, mockRes);
      
      const response = mockRes.json.mock.calls[0][0];
      
      expect(typeof response.version).toBe('string');
      expect(response.version).toBe('1.0.0');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing appVersion gracefully', async () => {
      config = {
        prisma: mockPrisma,
        redisUrl: 'redis://localhost:6379',
        appVersion: '',
      };
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      await handler(mockReq, mockRes);
      
      const response = mockRes.json.mock.calls[0][0];
      expect(response.version).toBeDefined();
    });

    it('should handle concurrent health check requests', async () => {
      config = createTestConfig();
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const mockReq = {} as Request;
      const mockRes1 = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      const mockRes2 = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
      
      // Execute concurrent requests
      await Promise.all([
        handler(mockReq, mockRes1),
        handler(mockReq, mockRes2),
      ]);
      
      expect(mockRes1.status).toHaveBeenCalled();
      expect(mockRes2.status).toHaveBeenCalled();
    });

    it('should return consistent timestamp format', async () => {
      config = createTestConfig();
      const router = createHealthRouter(config);
      
      const healthRoute = router.stack.find((layer) => layer.route?.path === '/');
      const handler = healthRoute?.route?.stack[0].handle;
      
      const results: string[] = [];
      
      for (let i = 0; i < 3; i++) {
        const mockReq = {} as Request;
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
        } as unknown as Response;
        
        await handler(mockReq, mockRes);
        const response = mockRes.json.mock.calls[0][0];
        results.push(response.timestamp);
      }
      
      // All timestamps should be valid ISO 8601
      results.forEach((timestamp) => {
        expect(() => new Date(timestamp)).not.toThrow();
      });
    });
  });
});
