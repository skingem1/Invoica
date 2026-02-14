import { Request, Response, NextFunction } from 'express';
import { createHealthCheckRouter, HealthCheckDependencies, HealthCheckResponse } from '../../src/api/health';

// Mock PrismaClient
const mockPrisma = {
  $queryRaw: jest.fn(),
};

// Mock Redis
const mockRedis = {
  ping: jest.fn(),
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Create mock dependencies
function createMockDeps(overrides?: Partial<HealthCheckDependencies>): HealthCheckDependencies {
  return {
    prisma: mockPrisma as any,
    redis: mockRedis as any,
    logger: mockLogger as any,
    version: '1.0.0-test',
    ...overrides,
  };
}

describe('Health Check API', () => {
  let router: ReturnType<typeof createHealthCheckRouter>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonFn: jest.Mock;
  let statusFn: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockPrisma.$queryRaw = jest.fn().mockResolvedValue([]);
    mockRedis.ping = jest.fn().mockResolvedValue('PONG');
    
    // Create response mock
    jsonFn = jest.fn();
    statusFn = jest.fn().mockReturnValue({ json: jsonFn });
    
    mockResponse = {
      status: statusFn,
      json: jsonFn,
    };
    
    mockRequest = {
      method: 'GET',
      path: '/api/health',
    };
    
    // Create router with mock dependencies
    const deps = createMockDeps();
    router = createHealthCheckRouter(deps);
  });

  describe('GET /api/health', () => {
    it('should return 200 when all services are healthy', async () => {
      // Arrange
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([]);
      mockRedis.ping = jest.fn().mockResolvedValue('PONG');
      
      // Get the route handler
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          method: layer.route.methods,
          handler: layer.route.stack[0].handle,
        }));
      
      const healthHandler = routes.find((r: any) => r.path === '/').handler;
      
      // Act
      await healthHandler(mockRequest as Request, mockResponse as Response);
      
      // Assert
      expect(statusFn).toHaveBeenCalledWith(200);
      expect(jsonFn).toHaveBeenCalled();
      
      const response = jsonFn.mock.calls[0][0] as HealthCheckResponse;
      expect(response.status).toBe('healthy');
      expect(response.version).toBe('1.0.0-test');
      expect(response.services.database.status).toBe('connected');
      expect(response.services.redis.status).toBe('connected');
      expect(response.uptime).toBeGreaterThanOrEqual(0);
      expect(response.timestamp).toBeDefined();
    });

    it('should return 503 when database is unhealthy', async () => {
      // Arrange
      mockPrisma.$queryRaw = jest.fn().mockRejectedValue(new Error('Database connection failed'));
      mockRedis.ping = jest.fn().mockResolvedValue('PONG');
      
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          method: layer.route.methods,
          handler: layer.route.stack[0].handle,
        }));
      
      const healthHandler = routes.find((r: any) => r.path === '/').handler;
      
      // Act
      await healthHandler(mockRequest as Request, mockResponse as Response);
      
      // Assert
      expect(statusFn).toHaveBeenCalledWith(503);
      
      const response = jsonFn.mock.calls[0][0] as HealthCheckResponse;
      expect(response.status).toBe('unhealthy');
      expect(response.services.database.status).toBe('error');
      expect(response.services.database.error).toBe('Database connection failed');
      expect(response.services.redis.status).toBe('connected');
    });

    it('should return 503 when redis is unhealthy', async () => {
      // Arrange
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([]);
      mockRedis.ping = jest.fn().mockRejectedValue(new Error('Redis connection failed'));
      
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          method: layer.route.methods,
          handler: layer.route.stack[0].handle,
        }));
      
      const healthHandler = routes.find((r: any) => r.path === '/').handler;
      
      // Act
      await healthHandler(mockRequest as Request, mockResponse as Response);
      
      // Assert
      expect(statusFn).toHaveBeenCalledWith(503);
      
      const response = jsonFn.mock.calls[0][0] as HealthCheckResponse;
      expect(response.status).toBe('unhealthy');
      expect(response.services.database.status).toBe('connected');
      expect(response.services.redis.status).toBe('error');
      expect(response.services.redis.error).toBe('Redis connection failed');
    });

    it('should return 503 when both services are unhealthy', async () => {
      // Arrange
      mockPrisma.$queryRaw = jest.fn().mockRejectedValue(new Error('DB error'));
      mockRedis.ping = jest.fn().mockRejectedValue(new Error('Redis error'));
      
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          method: layer.route.methods,
          handler: layer.route.stack[0].handle,
        }));
      
      const healthHandler = routes.find((r: any) => r.path === '/').handler;
      
      // Act
      await healthHandler(mockRequest as Request, mockResponse as Response);
      
      // Assert
      expect(statusFn).toHaveBeenCalledWith(503);
      
      const response = jsonFn.mock.calls[0][0] as HealthCheckResponse;
      expect(response.status).toBe('unhealthy');
      expect(response.services.database.status).toBe('error');
      expect(response.services.redis.status).toBe('error');
    });

    it('should include latency metrics in response', async () => {
      // Arrange - simulate slow database and fast redis
      let dbStartTime = 0;
      mockPrisma.$queryRaw = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve([]), 50);
        });
      });
      mockRedis.ping = jest.fn().mockResolvedValue('PONG');
      
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          method: layer.route.methods,
          handler: layer.route.stack[0].handle,
        }));
      
      const healthHandler = routes.find((r: any) => r.path === '/').handler;
      
      // Act
      await healthHandler(mockRequest as Request, mockResponse as Response);
      
      // Assert
      const response = jsonFn.mock.calls[0][0] as HealthCheckResponse;
      expect(response.services.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.services.redis.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.services.database.latencyMs).toBeGreaterThan(response.services.redis.latencyMs!);
    });

    it('should log errors when services fail', async () => {
      // Arrange
      const errorLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      };
      
      mockPrisma.$queryRaw = jest.fn().mockRejectedValue(new Error('DB failure'));
      mockRedis.ping = jest.fn().mockResolvedValue('PONG');
      
      const deps = createMockDeps({ logger: errorLogger });
      const errorRouter = createHealthCheckRouter(deps);
      
      const routes = errorRouter.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          method: layer.route.methods,
          handler: layer.route.stack[0].handle,
        }));
      
      const healthHandler = routes.find((r: any) => r.path === '/').handler;
      
      // Act
      await healthHandler(mockRequest as Request, mockResponse as Response);
      
      // Assert
      expect(errorLogger.error).toHaveBeenCalledWith(
        'Database health check failed',
        expect.objectContaining({
          error: 'DB failure',
          latencyMs: expect.any(Number),
        })
      );
    });

    it('should use default version when not provided', async () => {
      // Arrange - create router without version in deps
      const depsWithoutVersion: HealthCheckDependencies = {
        prisma: mockPrisma as any,
        redis: mockRedis as any,
        logger: mockLogger as any,
      };
      
      const routerWithoutVersion = createHealthCheckRouter(depsWithoutVersion);
      
      const routes = routerWithoutVersion.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          method: layer.route.methods,
          handler: layer.route.stack[0].handle,
        }));
      
      const healthHandler = routes.find((r: any) => r.path === '/').handler;
      
      // Act
      await healthHandler(mockRequest as Request, mockResponse as Response);
      
      // Assert
      const response = jsonFn.mock.calls[0][0] as HealthCheckResponse;
      expect(response.version).toBe('1.0.0');
    });

    it('should return valid timestamp format', async () => {
      // Arrange
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          method: layer.route.methods,
          handler: layer.route.stack[0].handle,
        }));
      
      const healthHandler = routes.find((r: any) => r.path === '/').handler;
      
      // Act
      await healthHandler(mockRequest as Request, mockResponse as Response);
      
      // Assert
      const response = jsonFn.mock.calls[0][0] as HealthCheckResponse;
      const timestamp = new Date(response.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('should handle unexpected redis ping response', async () => {
      // Arrange
      mockRedis.ping = jest.fn().mockResolvedValue('UNKNOWN');
      
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          method: layer.route.methods,
          handler: layer.route.stack[0].handle,
        }));
      
      const healthHandler = routes.find((r: any) => r.path === '/').handler;
      
      // Act
      await healthHandler(mockRequest as Request, mockResponse as Response);
      
      // Assert
      const response = jsonFn.mock.calls[0][0] as HealthCheckResponse;
      expect(response.services.redis.status).toBe('disconnected');
      expect(response.services.redis.error).toBe('Unexpected ping response');
    });
  });

  describe('HealthCheckResponse schema validation', () => {
    it('should produce valid response structure', async () => {
      // Arrange
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          method: layer.route.methods,
          handler: layer.route.stack[0].handle,
        }));
      
      const healthHandler = routes.find((r: any) => r.path === '/').handler;
      
      // Act
      await healthHandler(mockRequest as Request, mockResponse as Response);
      
      // Assert
      const response = jsonFn.mock.calls[0][0];
      
      // Validate structure
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('version');
      expect(response).toHaveProperty('uptime');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('services');
      expect(response.services).toHaveProperty('database');
      expect(response.services).toHaveProperty('redis');
      
      // Validate enum values
      expect(['healthy', 'unhealthy']).toContain(response.status);
      expect(['connected', 'disconnected', 'error']).toContain(response.services.database.status);
      expect(['connected', 'disconnected', 'error']).toContain(response.services.redis.status);
    });
  });
});
