import { Request, Response, NextFunction } from 'express';
import healthRouter from '../../src/api/health.js';
import { prisma } from '../../src/config/database.js';
import { redisClient } from '../../src/config/redis.js';

// Mock dependencies
jest.mock('../../src/config/database.js', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

jest.mock('../../src/config/redis.js', () => ({
  redisClient: {
    isOpen: true,
    ping: jest.fn(),
  },
}));

jest.mock('../../package.json', () => ({
  version: '1.0.0',
}));

describe('Health Check API', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonFn: jest.Mock;
  let statusFn: jest.Mock;

  beforeEach(() => {
    jsonFn = jest.fn();
    statusFn = jest.fn().mockReturnValue({ json: jsonFn });
    
    mockRequest = {};
    mockResponse = {
      status: statusFn,
      json: jsonFn,
    };

    jest.clearAllMocks();
    jest.spyOn(process, 'uptime').mockReturnValue(3600.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return healthy status when all services are connected', async () => {
      // Arrange
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
      (redisClient.ping as jest.Mock).mockResolvedValue('PONG');

      // Act - Simulate the route handler
      const handler = healthRouter.stack[0].route.stack[0].handle;
      await handler(
        mockRequest as Request,
        mockResponse as Response,
        jest.fn() as NextFunction
      );

      // Assert
      expect(statusFn).toHaveBeenCalledWith(200);
      expect(jsonFn).toHaveBeenCalledTimes(1);
      
      const response = jsonFn.mock.calls[0][0];
      expect(response.status).toBe('healthy');
      expect(response.version).toBe('1.0.0');
      expect(response.uptime).toBe(3600.5);
      expect(response.services.database.status).toBe('connected');
      expect(response.services.redis.status).toBe('connected');
      expect(response.timestamp).toBeDefined();
    });

    it('should return degraded status when one service is down', async () => {
      // Arrange
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('DB connection failed'));
      (redisClient.ping as jest.Mock).mockResolvedValue('PONG');

      // Act
      const handler = healthRouter.stack[0].route.stack[0].handle;
      await handler(
        mockRequest as Request,
        mockResponse as Response,
        jest.fn() as NextFunction
      );

      // Assert
      expect(statusFn).toHaveBeenCalledWith(200);
      
      const response = jsonFn.mock.calls[0][0];
      expect(response.status).toBe('degraded');
      expect(response.services.database.status).toBe('error');
      expect(response.services.redis.status).toBe('connected');
    });

    it('should return unhealthy status when all services are down', async () => {
      // Arrange
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('DB connection failed'));
      (redisClient.ping as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));

      // Act
      const handler = healthRouter.stack[0].route.stack[0].handle;
      await handler(
        mockRequest as Request,
        mockResponse as Response,
        jest.fn() as NextFunction
      );

      // Assert
      expect(statusFn).toHaveBeenCalledWith(503);
      
      const response = jsonFn.mock.calls[0][0];
      expect(response.status).toBe('unhealthy');
      expect(response.services.database.status).toBe('error');
      expect(response.services.redis.status).toBe('error');
    });

    it('should return unhealthy status when redis is disconnected', async () => {
      // Arrange
      (redisClient as any).isOpen = false;
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      // Act
      const handler = healthRouter.stack[0].route.stack[0].handle;
      await handler(
        mockRequest as Request,
        mockResponse as Response,
        jest.fn() as NextFunction
      );

      // Assert
      expect(statusFn).toHaveBeenCalledWith(200);
      
      const response = jsonFn.mock.calls[0][0];
      expect(response.status).toBe('degraded');
      expect(response.services.redis.status).toBe('disconnected');
    });

    it('should include latency metrics for connected services', async () => {
      // Arrange
      const startTime = Date.now();
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => 
        new Promise((resolve) => 
          setTimeout(() => resolve([]), 10)
        )
      );
      (redisClient.ping as jest.Mock).mockImplementation(() => 
        new Promise((resolve) => 
          setTimeout(() => resolve('PONG'), 5)
        )
      );

      // Act
      const handler = healthRouter.stack[0].route.stack[0].handle;
      await handler(
        mockRequest as Request,
        mockResponse as Response,
        jest.fn() as NextFunction
      );

      // Assert
      const response = jsonFn.mock.calls[0][0];
      expect(response.services.database.latencyMs).toBeGreaterThan(0);
      expect(response.services.redis.latencyMs).toBeGreaterThan(0);
    });

    it('should include error messages for failed services', async () => {
      // Arrange
      const dbError = 'Database connection refused';
      const redisError = 'Redis connection refused';
      
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error(dbError));
      (redisClient.ping as jest.Mock).mockRejectedValue(new Error(redisError));

      // Act
      const handler = healthRouter.stack[0].route.stack[0].handle;
      await handler(
        mockRequest as Request,
        mockResponse as Response,
        jest.fn() as NextFunction
      );

      // Assert
      const response = jsonFn.mock.calls[0][0];
      expect(response.services.database.error).toContain(dbError);
      expect(response.services.redis.error).toContain(redisError);
    });

    it('should return valid timestamp in ISO format', async () => {
      // Arrange
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
      (redisClient.ping as jest.Mock).mockResolvedValue('PONG');

      // Act
      const handler = healthRouter.stack[0].route.stack[0].handle;
      await handler(
        mockRequest as Request,
        mockResponse as Response,
        jest.fn() as NextFunction
      );

      // Assert
      const response = jsonFn.mock.calls[0][0];
      expect(() => new Date(response.timestamp)).not.toThrow();
      expect(response.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/);
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange - Make the router itself throw unexpectedly
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      (redisClient.ping as jest.Mock).mockResolvedValue('PONG');

      // Act
      const handler = healthRouter.stack[0].route.stack[0].handle;
      await handler(
        mockRequest as Request,
        mockResponse as Response,
        jest.fn() as NextFunction
      );

      // Assert
      expect(statusFn).toHaveBeenCalledWith(503);
      const response = jsonFn.mock.calls[0][0];
      expect(response.status).toBe('unhealthy');
      consoleSpy.mockRestore();
    });
  });

  describe('Response Schema Validation', () => {
    it('should return all required fields in response', async () => {
      // Arrange
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
      (redisClient.ping as jest.Mock).mockResolvedValue('PONG');

      // Act
      const handler = healthRouter.stack[0].route.stack[0].handle;
      await handler(
        mockRequest as Request,
        mockResponse as Response,
        jest.fn() as NextFunction
      );

      // Assert
      const response = jsonFn.mock.calls[0][0];
      
      // Check all required top-level fields
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('uptime');
      expect(response).toHaveProperty('version');
      expect(response).toHaveProperty('services');
      
      // Check services structure
      expect(response.services).toHaveProperty('database');
      expect(response.services).toHaveProperty('redis');
      
      // Check database service fields
      expect(response.services.database).toHaveProperty('status');
      expect(response.services.database).toHaveProperty('latencyMs');
      
      // Check redis service fields
      expect(response.services.redis).toHaveProperty('status');
      expect(response.services.redis).toHaveProperty('latencyMs');
    });

    it('should return valid enum values for status fields', async () => {
      // Arrange
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
      (redisClient.ping as jest.Mock).mockResolvedValue('PONG');

      // Act
      const handler = healthRouter.stack[0].route.stack[0].handle;
      await handler(
        mockRequest as Request,
        mockResponse as Response,
        jest.fn() as NextFunction
      );

      // Assert
      const response = jsonFn.mock.calls[0][0];
      
      // Top-level status should be one of the enum values
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.status);
      
      // Service statuses should be one of their enum values
      expect(['connected', 'disconnected', 'error']).toContain(response.services.database.status);
      expect(['connected', 'disconnected', 'error']).toContain(response.services.redis.status);
    });

    it('should return numeric values for uptime and latency', async () => {
      // Arrange
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
      (redisClient.ping as jest.Mock).mockResolvedValue('PONG');

      // Act
      const handler = healthRouter.stack[0].route.stack[0].handle;
      await handler(
        mockRequest as Request,
        mockResponse as Response,
        jest.fn() as NextFunction
      );

      // Assert
      const response = jsonFn.mock.calls[0][0];
      
      expect(typeof response.uptime).toBe('number');
      expect(response.uptime).toBeGreaterThan(0);
      
      expect(typeof response.services.database.latencyMs).toBe('number');
      expect(typeof response.services.redis.latencyMs).toBe('number');
    });
  });
});
