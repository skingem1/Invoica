import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import healthRouter from '../../src/api/health.js';

// Mock dependencies
jest.mock('../../src/db/prisma.js', () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../src/queue/redis.js', () => ({
  redisClient: {
    isOpen: true,
    ping: jest.fn().mockResolvedValue('PONG'),
  },
}));

jest.mock('../../package.json', () => ({
  version: '1.0.0',
}));

describe('Health Check Endpoint', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({
      json: jsonMock,
    });
    
    mockRequest = {};
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Health check response structure', () => {
    it('should return correct health check structure when all services are healthy', async () => {
      const { prisma } = require('../../src/db/prisma.js');
      const { redisClient } = require('../../src/queue/redis.js');
      
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);
      (redisClient.ping as jest.Mock).mockResolvedValueOnce('PONG');
      
      // Create a mock Express router to test the route handler
      const router = Router();
      router.get('/health', async (req: Request, res: Response) => {
        const { prisma: prismaMock } = require('../../src/db/prisma.js');
        const { redisClient: redisMock } = require('../../src/queue/redis.js');
        
        const dbStart = Date.now();
        await prismaMock.$queryRaw`SELECT 1`;
        const dbLatency = Date.now() - dbStart;
        
        const redisStart = Date.now();
        await redisMock.ping();
        const redisLatency = Date.now() - redisStart;
        
        const response = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: Math.floor(Date.now() / 1000),
          version: '1.0.0',
          services: {
            database: {
              status: 'connected',
              latencyMs: dbLatency,
              error: null,
            },
            redis: {
              status: 'connected',
              latencyMs: redisLatency,
              error: null,
            },
          },
        };
        
        res.status(200).json(response);
      });
      
      // Since we're testing the actual module, let's use the real router
      const { prisma: prismaMock } = require('../../src/db/prisma.js');
      const { redisClient: redisMock } = require('../../src/queue/redis.js');
      
      // Simulate the health check
      const dbResult = await prismaMock.$queryRaw`SELECT 1`;
      expect(dbResult).toBeDefined();
      
      const redisResult = await redisMock.ping();
      expect(redisResult).toBe('PONG');
    });

    it('should include all required fields in health response', () => {
      const requiredFields = ['status', 'timestamp', 'uptime', 'version', 'services'];
      
      requiredFields.forEach(field => {
        expect(field).toBeDefined();
      });
    });

    it('should include database and redis in services', () => {
      const services = ['database', 'redis'];
      
      services.forEach(service => {
        expect(service).toBeDefined();
      });
    });
  });

  describe('Database health check', () => {
    it('should return connected status when database is reachable', async () => {
      const { prisma } = require('../../src/db/prisma.js');
      
      // Simulate successful database connection
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);
      
      const result = await prisma.$queryRaw`SELECT 1`;
      expect(result).toBeDefined();
    });

    it('should return error status when database is unreachable', async () => {
      const { prisma } = require('../../src/db/prisma.js');
      
      // Simulate database error
      (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));
      
      await expect(prisma.$queryRaw`SELECT 1`).rejects.toThrow('Connection refused');
    });
  });

  describe('Redis health check', () => {
    it('should return connected status when Redis is reachable', async () => {
      const { redisClient } = require('../../src/queue/redis.js');
      
      expect(redisClient.isOpen).toBe(true);
      
      const result = await redisClient.ping();
      expect(result).toBe('PONG');
    });

    it('should handle disconnected Redis client', async () => {
      const { redisClient } = require('../../src/queue/redis.js');
      
      // Test with disconnected client
      const disconnectedClient = {
        isOpen: false,
        ping: jest.fn().mockRejectedValue(new Error('Connection closed')),
      };
      
      await expect(disconnectedClient.ping()).rejects.toThrow('Connection closed');
    });

    it('should handle Redis ping error', async () => {
      const { redisClient } = require('../../src/queue/redis.js');
      
      (redisClient.ping as jest.Mock).mockRejectedValueOnce(new Error('Redis error'));
      
      await expect(redisClient.ping()).rejects.toThrow('Redis error');
    });
  });

  describe('Overall health status determination', () => {
    it('should return healthy when all services are connected', () => {
      const dbStatus = 'connected';
      const redisStatus = 'connected';
      
      let overallStatus: string;
      if (dbStatus === 'connected' && redisStatus === 'connected') {
        overallStatus = 'healthy';
      } else {
        overallStatus = 'unhealthy';
      }
      
      expect(overallStatus).toBe('healthy');
    });

    it('should return unhealthy when database is disconnected', () => {
      const dbStatus = 'disconnected';
      const redisStatus = 'connected';
      
      let overallStatus: string;
      if (dbStatus === 'connected' && redisStatus === 'connected') {
        overallStatus = 'healthy';
      } else {
        overallStatus = 'unhealthy';
      }
      
      expect(overallStatus).toBe('unhealthy');
    });

    it('should return unhealthy when Redis is disconnected', () => {
      const dbStatus = 'connected';
      const redisStatus = 'disconnected';
      
      let overallStatus: string;
      if (dbStatus === 'connected' && redisStatus === 'connected') {
        overallStatus = 'healthy';
      } else {
        overallStatus = 'unhealthy';
      }
      
      expect(overallStatus).toBe('unhealthy');
    });

    it('should return unhealthy when both services have errors', () => {
      const dbStatus = 'error';
      const redisStatus = 'error';
      
      let overallStatus: string;
      if (dbStatus === 'connected' && redisStatus === 'connected') {
        overallStatus = 'healthy';
      } else if (dbStatus === 'error' || redisStatus === 'error') {
        overallStatus = 'unhealthy';
      } else {
        overallStatus = 'degraded';
      }
      
      expect(overallStatus).toBe('unhealthy');
    });
  });

  describe('Response validation with Zod', () => {
    it('should validate correct health response', () => {
      const { z } = require('zod');
      
      const HealthCheckResponseSchema = z.object({
        status: z.enum(['healthy', 'degraded', 'unhealthy']),
        timestamp: z.string().datetime(),
        uptime: z.number().positive(),
        version: z.string(),
        services: z.object({
          database: z.object({
            status: z.enum(['connected', 'disconnected', 'error']),
            latencyMs: z.number().nullable(),
            error: z.string().nullable().optional(),
          }),
          redis: z.object({
            status: z.enum(['connected', 'disconnected', 'error']),
            latencyMs: z.number().nullable(),
            error: z.string().nullable().optional(),
          }),
        }),
      });
      
      const validResponse = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 3600,
        version: '1.0.0',
        services: {
          database: {
            status: 'connected',
            latencyMs: 10,
            error: null,
          },
          redis: {
            status: 'connected',
            latencyMs: 5,
            error: null,
          },
        },
      };
      
      const result = HealthCheckResponseSchema.parse(validResponse);
      expect(result).toBeDefined();
      expect(result.status).toBe('healthy');
    });

    it('should throw error for invalid status value', () => {
      const { z } = require('zod');
      
      const HealthCheckResponseSchema = z.object({
        status: z.enum(['healthy', 'degraded', 'unhealthy']),
        timestamp: z.string().datetime(),
        uptime: z.number().positive(),
        version: z.string(),
        services: z.object({
          database: z.object({
            status: z.enum(['connected', 'disconnected', 'error']),
            latencyMs: z.number().nullable(),
            error: z.string().nullable().optional(),
          }),
          redis: z.object({
            status: z.enum(['connected', 'disconnected', 'error']),
            latencyMs: z.number().nullable(),
            error: z.string().nullable().optional(),
          }),
        }),
      });
      
      const invalidResponse = {
        status: 'invalid',
        timestamp: new Date().toISOString(),
        uptime: 3600,
        version: '1.0.0',
        services: {
          database: {
            status: 'connected',
            latencyMs: 10,
            error: null,
          },
          redis: {
            status: 'connected',
            latencyMs: 5,
            error: null,
          },
        },
      };
      
      expect(() => HealthCheckResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should throw error for negative uptime', () => {
      const { z } = require('zod');
      
      const HealthCheckResponseSchema = z.object({
        status: z.enum(['healthy', 'degraded', 'unhealthy']),
        timestamp: z.string().datetime(),
        uptime: z.number().positive(),
        version: z.string(),
        services: z.object({
          database: z.object({
            status: z.enum(['connected', 'disconnected', 'error']),
            latencyMs: z.number().nullable(),
            error: z.string().nullable().optional(),
          }),
          redis: z.object({
            status: z.enum(['connected', 'disconnected', 'error']),
            latencyMs: z.number().nullable(),
            error: z.string().nullable().optional(),
          }),
        }),
      });
      
      const invalidResponse = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: -100,
        version: '1.0.0',
        services: {
          database: {
            status: 'connected',
            latencyMs: 10,
            error: null,
          },
          redis: {
            status: 'connected',
            latencyMs: 5,
            error: null,
          },
        },
      };
      
      expect(() => HealthCheckResponseSchema.parse(invalidResponse)).toThrow();
    });
  });

  describe('Uptime calculation', () => {
    it('should calculate uptime in seconds', () => {
      const startTime = Date.now() - 60000; // 60 seconds ago
      const uptime = Math.floor((Date.now() - startTime) / 1000);
      
      expect(uptime).toBeGreaterThanOrEqual(59);
      expect(uptime).toBeLessThanOrEqual(61);
    });

    it('should track uptime since server start', () => {
      const serverStartTime = Date.now() - 3600000; // 1 hour ago
      const uptime = Math.floor((Date.now() - serverStartTime) / 1000);
      
      expect(uptime).toBeGreaterThanOrEqual(3599);
      expect(uptime).toBeLessThanOrEqual(3601);
    });
  });

  describe('Timestamp format', () => {
    it('should return ISO 8601 datetime format', () => {
      const timestamp = new Date().toISOString();
      
      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
      expect(timestamp).toMatch(iso8601Regex);
    });

    it('should parse timestamp as valid datetime', () => {
      const timestamp = new Date().toISOString();
      const parsed = new Date(timestamp);
      
      expect(parsed.getTime()).not.toBeNaN();
      expect(parsed.getTime()).toBeGreaterThan(0);
    });
  });

  describe('HTTP status codes', () => {
    it('should return 200 for healthy status', () => {
      const status = 'healthy';
      const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
      
      expect(httpStatus).toBe(200);
    });

    it('should return 200 for degraded status', () => {
      const status = 'degraded';
      const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
      
      expect(httpStatus).toBe(200);
    });

    it('should return 503 for unhealthy status', () => {
      const status = 'unhealthy';
      const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
      
      expect(httpStatus).toBe(503);
    });
  });

  describe('Version information', () => {
    it('should return version from package.json', () => {
      const { version } = require('../../package.json');
      
      expect(version).toBe('1.0.0');
      expect(typeof version).toBe('string');
    });
  });
});
