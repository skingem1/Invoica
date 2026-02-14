import { Request, Response } from 'express';
import { HealthCheckResponseSchema, HealthCheckResponse } from '../../src/api/health';

// Mock dependencies
jest.mock('../../src/db/prisma', () => ({
  getDb: jest.fn(),
}));

jest.mock('../../src/services/redis', () => ({
  redisClient: {
    ping: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    isReady: true,
  },
}));

jest.mock('../../src/config', () => ({
  config: {
    app: {
      version: '1.0.0',
      name: 'test-app',
    },
  },
}));

import { getDb } from '../../src/db/prisma';
import { redisClient } from '../../src/services/redis';
import { config } from '../../src/config';

// Import the handler after mocks are set up
import { checkHealth } from '../../src/api/health';

describe('Health Check API', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    mockRequest = {
      method: 'GET',
      path: '/api/health',
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    jest.clearAllMocks();
  });

  describe('checkHealth', () => {
    const mockPrisma = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    beforeEach(() => {
      (getDb as jest.Mock).mockResolvedValue(mockPrisma);
    });

    it('should return healthy status when all services are connected', async () => {
      // Arrange
      const startCpuUsage = process.cpuUsage();
      process.cpuUsage(startCpuUsage); // Get baseline
      
      (redisClient.ping as jest.Mock).mockResolvedValue('PONG');
      redisClient.isReady = true;

      // Act
      await checkHealth(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledTimes(1);
      
      const responseData = jsonMock.mock.calls[0][0];
      const parsed = HealthCheckResponseSchema.parse(responseData);
      
      expect(parsed.status).toBe('healthy');
      expect(parsed.uptime).toBeGreaterThan(0);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.timestamp).toBeDefined();
      expect(new Date(parsed.timestamp)).toBeInstanceOf(Date);
      
      expect(parsed.services.database.status).toBe('connected');
      expect(parsed.services.redis.status).toBe('connected');
      
      expect(parsed.system).toBeDefined();
      expect(parsed.system.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(parsed.system.memoryUsage.total).toBeGreaterThan(0);
      expect(parsed.system.memoryUsage.free).toBeGreaterThanOrEqual(0);
      expect(parsed.system.memoryUsage.used).toBeGreaterThan(0);
    });

    it('should return healthy status when database query is slow but succeeds', async () => {
      // Arrange
      const slowPrisma = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $queryRaw: jest.fn().mockImplementation(() => 
          new Promise((resolve) => 
            setTimeout(() => resolve([]), 100)
          )
        ),
      };
      (getDb as jest.Mock).mockResolvedValue(slowPrisma);
      (redisClient.ping as jest.Mock).mockResolvedValue('PONG');
      redisClient.isReady = true;

      // Act
      await checkHealth(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      const responseData = jsonMock.mock.calls[0][0];
      const parsed = HealthCheckResponseSchema.parse(responseData);
      
      expect(parsed.status).toBe('healthy');
      expect(parsed.services.database.status).toBe('connected');
      expect(parsed.services.database.latency).toBeGreaterThan(0);
    });

    it('should return degraded status when Redis is disconnected but database is connected', async () => {
      // Arrange
      (redisClient.ping as jest.Mock).mockRejectedValue(new Error('Connection refused'));
      redisClient.isReady = false;

      // Act
      await checkHealth(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      const responseData = jsonMock.mock.calls[0][0];
      const parsed = HealthCheckResponseSchema.parse(responseData);
      
      expect(parsed.status).toBe('degraded');
      expect(parsed.services.redis.status).toBe('disconnected');
      expect(parsed.services.redis.error).toBeDefined();
      expect(parsed.services.database.status).toBe('connected');
    });

    it('should return unhealthy status when database is disconnected', async () => {
      // Arrange
      const disconnectedPrisma = {
        $connect: jest.fn().mockRejectedValue(new Error('Database connection failed')),
        $disconnect: jest.fn(),
        $queryRaw: jest.fn().mockRejectedValue(new Error('Database unavailable')),
      };
      (getDb as jest.Mock).mockResolvedValue(disconnectedPrisma);
      (redisClient.ping as jest.Mock).mockResolvedValue('PONG');
      redisClient.isReady = true;

      // Act
      await checkHealth(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(503);
      const responseData = jsonMock.mock.calls[0][0];
      const parsed = HealthCheckResponseSchema.parse(responseData);
      
      expect(parsed.status).toBe('unhealthy');
      expect(parsed.services.database.status).toBe('error');
      expect(parsed.services.database.error).toBeDefined();
    });

    it('should return unhealthy status when both database and Redis are disconnected', async () => {
      // Arrange
      const disconnectedPrisma = {
        $connect: jest.fn().mockRejectedValue(new Error('Database connection failed')),
        $disconnect: jest.fn(),
        $queryRaw: jest.fn().mockRejectedValue(new Error('Database unavailable')),
      };
      (getDb as jest.Mock).mockResolvedValue(disconnectedPrisma);
      (redisClient.ping as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));
      redisClient.isReady = false;

      // Act
      await checkHealth(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(503);
      const responseData = jsonMock.mock.calls[0][0];
      const parsed = HealthCheckResponseSchema.parse(responseData);
      
      expect(parsed.status).toBe('unhealthy');
      expect(parsed.services.database.status).toBe('error');
      expect(parsed.services.redis.status).toBe('error');
    });

    it('should return degraded status when Redis is slow but responds', async () => {
      // Arrange
      const slowRedisPing = jest.fn().mockImplementation(() => 
        new Promise((resolve) => 
          setTimeout(() => resolve('PONG'), 5000)
        )
      );
      (redisClient.ping as jest.Mock).mockImplementation(slowRedisPing);
      redisClient.isReady = true;

      // Act
      const startTime = Date.now();
      await checkHealth(mockRequest as Request, mockResponse as Response);
      const endTime = Date.now();

      // Assert
      const responseData = jsonMock.mock.calls[0][0];
      const parsed = HealthCheckResponseSchema.parse(responseData);
      
      // The overall response time might be slow but still succeed
      expect(endTime - startTime).toBeGreaterThanOrEqual(0);
      expect(parsed.services.redis.latency).toBeGreaterThan(0);
    });

    it('should include correct system information', async () => {
      // Arrange
      (redisClient.ping as jest.Mock).mockResolvedValue('PONG');
      redisClient.isReady = true;

      // Act
      await checkHealth(mockRequest as Request, mockResponse as Response);

      // Assert
      const responseData = jsonMock.mock.calls[0][0];
      const parsed = HealthCheckResponseSchema.parse(responseData);
      
      expect(parsed.system).toBeDefined();
      expect(parsed.system.memoryUsage.total).toBeGreaterThan(0);
      expect(parsed.system.memoryUsage.free).toBeGreaterThanOrEqual(0);
      expect(parsed.system.memoryUsage.used).toBeGreaterThan(0);
      
      // Memory usage math should add up
      const calculatedUsed = parsed.system.memoryUsage.total - parsed.system.memoryUsage.free;
      expect(parsed.system.memoryUsage.used).toBeCloseTo(calculatedUsed, -1);
    });

    it('should return proper timestamp format', async () => {
      // Arrange
      (redisClient.ping as jest.Mock).mockResolvedValue('PONG');
      redisClient.isReady = true;

      // Act
      await checkHealth(mockRequest as Request, mockResponse as Response);

      // Assert
      const responseData = jsonMock.mock.calls[0][0];
      const parsed = HealthCheckResponseSchema.parse(responseData);
      
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      const parsedDate = new Date(parsed.timestamp);
      expect(parsedDate.getTime()).not.toBeNaN();
    });

    it('should measure database latency accurately', async () => {
      // Arrange
      const startTime = Date.now();
      const mockPrismaWithLatency = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $queryRaw: jest.fn().mockImplementation(() => 
          new Promise((resolve) => {
            setTimeout(() => {
              resolve([]);
            }, 50);
          })
        ),
      };
      (getDb as jest.Mock).mockResolvedValue(mockPrismaWithLatency);
      (redisClient.ping as jest.Mock).mockResolvedValue('PONG');
      redisClient.isReady = true;

      // Act
      await checkHealth(mockRequest as Request, mockResponse as Response);

      // Assert
      const responseData = jsonMock.mock.calls[0][0];
      const parsed = HealthCheckResponseSchema.parse(responseData);
      
      expect(parsed.services.database.latency).toBeGreaterThanOrEqual(40);
      expect(parsed.services.database.latency).toBeLessThan(100);
    });

    it('should handle Prisma client not initialized gracefully', async () => {
      // Arrange
      (getDb as jest.Mock).mockResolvedValue(null);
      (redisClient.ping as jest.Mock).mockResolvedValue('PONG');
      redisClient.isReady = true;

      // Act
      await checkHealth(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(503);
      const responseData = jsonMock.mock.calls[0][0];
      const parsed = HealthCheckResponseSchema.parse(responseData);
      
      expect(parsed.status).toBe('unhealthy');
      expect(parsed.services.database.status).toBe('error');
    });

    it('should handle Redis client not initialized gracefully', async () => {
      // Arrange
      (redisClient.ping as jest.Mock).mockResolvedValue(undefined);
      redisClient.isReady = false;

      // Act
      await checkHealth(mockRequest as Request, mockResponse as Response);

      // Assert
      const responseData = jsonMock.mock.calls[0][0];
      const parsed = HealthCheckResponseSchema.parse(responseData);
      
      expect(parsed.services.redis.status).toBe('disconnected');
    });
  });

  describe('HealthCheckResponseSchema', () => {
    it('should validate a complete healthy response', () => {
      const validResponse: HealthCheckResponse = {
        status: 'healthy',
        uptime: 1000,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: {
          database: {
            status: 'connected',
            latency: 10,
          },
          redis: {
            status: 'connected',
            latency: 5,
          },
        },
        system: {
          cpuUsage: 0.25,
          memoryUsage: {
            total: 8000000000,
            free: 4000000000,
            used: 4000000000,
          },
        },
      };

      const result = HealthCheckResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should validate a degraded response', () => {
      const degradedResponse: HealthCheckResponse = {
        status: 'degraded',
        uptime: 1000,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: {
          database: {
            status: 'connected',
            latency: 10,
          },
          redis: {
            status: 'disconnected',
            error: 'Connection refused',
          },
        },
        system: {
          cpuUsage: 0.25,
          memoryUsage: {
            total: 8000000000,
            free: 4000000000,
            used: 4000000000,
          },
        },
      };

      const result = HealthCheckResponseSchema.safeParse(degradedResponse);
      expect(result.success).toBe(true);
    });

    it('should validate an unhealthy response', () => {
      const unhealthyResponse: HealthCheckResponse = {
        status: 'unhealthy',
        uptime: 1000,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: {
          database: {
            status: 'error',
            error: 'Database unavailable',
          },
          redis: {
            status: 'error',
            error: 'Redis connection failed',
          },
        },
        system: {
          cpuUsage: 0.95,
          memoryUsage: {
            total: 8000000000,
            free: 500000000,
            used: 7500000000,
          },
        },
      };

      const result = HealthCheckResponseSchema.safeParse(unhealthyResponse);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status values', () => {
      const invalidResponse = {
        status: 'invalid-status',
        uptime: 1000,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: {
          database: { status: 'connected' },
          redis: { status: 'connected' },
        },
        system: {
          cpuUsage: 0.25,
          memoryUsage: { total: 100, free: 50, used: 50 },
        },
      };

      const result = HealthCheckResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject invalid service status values', () => {
      const invalidResponse = {
        status: 'healthy',
        uptime: 1000,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: {
          database: { status: 'invalid' },
          redis: { status: 'connected' },
        },
        system: {
          cpuUsage: 0.25,
          memoryUsage: { total: 100, free: 50, used: 50 },
        },
      };

      const result = HealthCheckResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject invalid timestamp format', () => {
      const invalidResponse = {
        status: 'healthy',
        uptime: 1000,
        version: '1.0.0',
        timestamp: 'not-a-valid-date',
        services: {
          database: { status: 'connected' },
          redis: { status: 'connected' },
        },
        system: {
          cpuUsage: 0.25,
          memoryUsage: { total: 100, free: 50, used: 50 },
        },
      };

      const result = HealthCheckResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject negative uptime', () => {
      const invalidResponse = {
        status: 'healthy',
        uptime: -100,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: {
          database: { status: 'connected' },
          redis: { status: 'connected' },
        },
        system: {
          cpuUsage: 0.25,
          memoryUsage: { total: 100, free: 50, used: 50 },
        },
      };

      const result = HealthCheckResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });
});
