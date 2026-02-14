import { Request, Response } from 'express';
import { healthCheck, HealthCheckResponseSchema, HealthCheckResponse } from '../../src/api/health';
import { prisma } from '../../src/lib/prisma';
import { redis } from '../../src/lib/redis';

// Mock dependencies
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../src/lib/redis', () => ({
  redis: {
    ping: jest.fn(),
  },
}));

jest.mock('../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Extend timeout for async tests
const TEST_TIMEOUT = 10000;

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
    
    // Reset environment variable
    process.env.APP_VERSION = '1.0.0';
    
    jest.clearAllMocks();
  });

  describe('healthCheck function', () => {
    it(
      'should return healthy status when all services are connected',
      async () => {
        // Arrange
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
        (redis.ping as jest.Mock).mockResolvedValue('PONG');
        
        // Act
        await healthCheck(mockRequest as Request, mockResponse as Response);
        
        // Assert
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalled();
        
        const response = jsonMock.mock.calls[0][0] as HealthCheckResponse;
        expect(response.status).toBe('healthy');
        expect(response.services.database.status).toBe('connected');
        expect(response.services.redis.status).toBe('connected');
        expect(response.uptime).toBeGreaterThanOrEqual(0);
        expect(response.version).toBe('1.0.0');
        expect(response.timestamp).toBeDefined();
        expect(() => HealthCheckResponseSchema.parse(response)).not.toThrow();
      },
      TEST_TIMEOUT
    );

    it(
      'should return degraded status when Redis is disconnected',
      async () => {
        // Arrange
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
        (redis.ping as jest.Mock).mockResolvedValue(null);
        
        // Act
        await healthCheck(mockRequest as Request, mockResponse as Response);
        
        // Assert
        expect(statusMock).toHaveBeenCalledWith(200);
        
        const response = jsonMock.mock.calls[0][0] as HealthCheckResponse;
        expect(response.status).toBe('degraded');
        expect(response.services.database.status).toBe('connected');
        expect(response.services.redis.status).toBe('disconnected');
      },
      TEST_TIMEOUT
    );

    it(
      'should return unhealthy status when database has an error',
      async () => {
        // Arrange
        (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Database connection failed'));
        (redis.ping as jest.Mock).mockResolvedValue('PONG');
        
        // Act
        await healthCheck(mockRequest as Request, mockResponse as Response);
        
        // Assert
        expect(statusMock).toHaveBeenCalledWith(503);
        
        const response = jsonMock.mock.calls[0][0] as HealthCheckResponse;
        expect(response.status).toBe('unhealthy');
        expect(response.services.database.status).toBe('error');
        expect(response.services.database.error).toBe('Database connection failed');
        expect(response.services.redis.status).toBe('connected');
      },
      TEST_TIMEOUT
    );

    it(
      'should return unhealthy status when Redis has an error',
      async () => {
        // Arrange
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
        (redis.ping as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));
        
        // Act
        await healthCheck(mockRequest as Request, mockResponse as Response);
        
        // Assert
        expect(statusMock).toHaveBeenCalledWith(503);
        
        const response = jsonMock.mock.calls[0][0] as HealthCheckResponse;
        expect(response.status).toBe('unhealthy');
        expect(response.services.database.status).toBe('connected');
        expect(response.services.redis.status).toBe('error');
        expect(response.services.redis.error).toBe('Redis connection failed');
      },
      TEST_TIMEOUT
    );

    it(
      'should return unhealthy status when both services have errors',
      async () => {
        // Arrange
        (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Database error'));
        (redis.ping as jest.Mock).mockRejectedValue(new Error('Redis error'));
        
        // Act
        await healthCheck(mockRequest as Request, mockResponse as Response);
        
        // Assert
        expect(statusMock).toHaveBeenCalledWith(503);
        
        const response = jsonMock.mock.calls[0][0] as HealthCheckResponse;
        expect(response.status).toBe('unhealthy');
        expect(response.services.database.status).toBe('error');
        expect(response.services.redis.status).toBe('error');
      },
      TEST_TIMEOUT
    );

    it(
      'should include latency information for connected services',
      async () => {
        // Arrange
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
        (redis.ping as jest.Mock).mockResolvedValue('PONG');
        
        // Act
        await healthCheck(mockRequest as Request, mockResponse as Response);
        
        // Assert
        const response = jsonMock.mock.calls[0][0] as HealthCheckResponse;
        
        expect(response.services.database.latencyMs).toBeDefined();
        expect(response.services.database.latencyMs).toBeGreaterThanOrEqual(0);
        expect(response.services.redis.latencyMs).toBeDefined();
        expect(response.services.redis.latencyMs).toBeGreaterThanOrEqual(0);
      },
      TEST_TIMEOUT
    );

    it(
      'should use APP_VERSION from environment variable',
      async () => {
        // Arrange
        process.env.APP_VERSION = '2.5.0';
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
        (redis.ping as jest.Mock).mockResolvedValue('PONG');
        
        // Act
        await healthCheck(mockRequest as Request, mockResponse as Response);
        
        // Assert
        const response = jsonMock.mock.calls[0][0] as HealthCheckResponse;
        expect(response.version).toBe('2.5.0');
        
        // Reset
        process.env.APP_VERSION = '1.0.0';
      },
      TEST_TIMEOUT
    );

    it(
      'should default to version 1.0.0 when APP_VERSION is not set',
      async () => {
        // Arrange
        delete process.env.APP_VERSION;
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
        (redis.ping as jest.Mock).mockResolvedValue('PONG');
        
        // Act
        await healthCheck(mockRequest as Request, mockResponse as Response);
        
        // Assert
        const response = jsonMock.mock.calls[0][0] as HealthCheckResponse;
        expect(response.version).toBe('1.0.0');
      },
      TEST_TIMEOUT
    );

    it(
      'should return valid ISO timestamp',
      async () => {
        // Arrange
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
        (redis.ping as jest.Mock).mockResolvedValue('PONG');
        
        // Act
        await healthCheck(mockRequest as Request, mockResponse as Response);
        
        // Assert
        const response = jsonMock.mock.calls[0][0] as HealthCheckResponse;
        const timestamp = new Date(response.timestamp);
        expect(timestamp.getTime()).not.toBeNaN();
      },
      TEST_TIMEOUT
    );

    it(
      'should return valid response schema',
      async () => {
        // Arrange
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
        (redis.ping as jest.Mock).mockResolvedValue('PONG');
        
        // Act
        await healthCheck(mockRequest as Request, mockResponse as Response);
        
        // Assert
        const response = jsonMock.mock.calls[0][0];
        expect(() => HealthCheckResponseSchema.parse(response)).not.toThrow();
      },
      TEST_TIMEOUT
    );

    it(
      'should handle unexpected Redis response gracefully',
      async () => {
        // Arrange
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
        (redis.ping as jest.Mock).mockResolvedValue('UNEXPECTED');
        
        // Act
        await healthCheck(mockRequest as Request, mockResponse as Response);
        
        // Assert
        const response = jsonMock.mock.calls[0][0] as HealthCheckResponse;
        expect(response.services.redis.status).toBe('disconnected');
        expect(response.services.redis.error).toBe('Unexpected Redis response');
      },
      TEST_TIMEOUT
    );
  });

  describe('HealthCheckResponseSchema', () => {
    it('should validate a complete healthy response', () => {
      const validResponse = {
        status: 'healthy',
        uptime: 100,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: {
          database: {
            status: 'connected',
            latencyMs: 5,
          },
          redis: {
            status: 'connected',
            latencyMs: 3,
          },
        },
      };

      expect(() => HealthCheckResponseSchema.parse(validResponse)).not.toThrow();
    });

    it('should validate a degraded response with disconnected service', () => {
      const validResponse = {
        status: 'degraded',
        uptime: 100,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: {
          database: {
            status: 'connected',
            latencyMs: 5,
          },
          redis: {
            status: 'disconnected',
          },
        },
      };

      expect(() => HealthCheckResponseSchema.parse(validResponse)).not.toThrow();
    });

    it('should validate an unhealthy response with errors', () => {
      const validResponse = {
        status: 'unhealthy',
        uptime: 100,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: {
          database: {
            status: 'error',
            error: 'Connection failed',
          },
          redis: {
            status: 'error',
            error: 'Connection failed',
          },
        },
      };

      expect(() => HealthCheckResponseSchema.parse(validResponse)).not.toThrow();
    });

    it('should reject invalid status values', () => {
      const invalidResponse = {
        status: 'invalid_status',
        uptime: 100,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: {
          database: { status: 'connected' },
          redis: { status: 'connected' },
        },
      };

      expect(() => HealthCheckResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should reject negative uptime', () => {
      const invalidResponse = {
        status: 'healthy',
        uptime: -1,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: {
          database: { status: 'connected' },
          redis: { status: 'connected' },
        },
      };

      expect(() => HealthCheckResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should reject invalid timestamp format', () => {
      const invalidResponse = {
        status: 'healthy',
        uptime: 100,
        version: '1.0.0',
        timestamp: 'not-a-date',
        services: {
          database: { status: 'connected' },
          redis: { status: 'connected' },
        },
      };

      expect(() => HealthCheckResponseSchema.parse(invalidResponse)).toThrow();
    });
  });
});
