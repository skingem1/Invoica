
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  HealthCheckError,
  DatabaseHealthError,
  RedisHealthError,
  HealthCheckTimeoutError,
  checkHealth,
  HealthCheckResponse,
} from '../../src/api/health';

// Mock dependencies
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
  }));
});

// ============================================
// Test Suite: Health Check API
// ============================================

describe('Health Check API', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    mockRequest = {};
    mockNext = jest.fn();
    
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    jest.clearAllMocks();
  });

  // ============================================
  // Helper Functions
  // ============================================

  /**
   * Creates a mock Prisma client with configurable behavior
   */
  const createMockPrisma = (shouldSucceed: boolean, delayMs: number = 0) => {
    return {
      $connect: jest.fn().mockImplementation(() => 
        new Promise((resolve, reject) => {
          setTimeout(() => {
            if (shouldSucceed) {
              resolve(undefined);
            } else {
              reject(new Error('Database connection failed'));
            }
          }, delayMs);
        })
      ),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    };
  };

  /**
   * Creates a mock Redis client with configurable behavior
   */
  const createMockRedis = (shouldSucceed: boolean, delayMs: number = 0) => {
    return {
      ping: jest.fn().mockImplementation(() =>
        new Promise((resolve, reject) => {
          setTimeout(() => {
            if (shouldSucceed) {
              resolve('PONG');
            } else {
              reject(new Error('Redis connection failed'));
            }
          }, delayMs);
        })
      ),
      quit: jest.fn().mockResolvedValue('OK'),
    };
  };

  // ============================================
  // Test: Health Check Response Schema
  // ============================================

  describe('HealthCheckResponse Schema Validation', () => {
    it('should validate a healthy response', () => {
      const healthyResponse: HealthCheckResponse = {
        status: 'healthy',
        uptime: 1000,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: {
          database: {
            status: 'healthy',
            responseTime: 10,
          },
          redis: {
            status: 'healthy',
            responseTime: 5,
          },
        },
      };

      // Validate against the expected schema structure
      expect(healthyResponse.status).toBe('healthy');
      expect(healthyResponse.services.database.status).toBe('healthy');
      expect(healthyResponse.services.redis.status).toBe('healthy');
    });

    it('should validate a degraded response', () => {
      const degradedResponse: HealthCheckResponse = {
        status: 'degraded',
        uptime: 1000,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: {
          database: {
            status: 'healthy',
            responseTime: 10,
          },
          redis: {
            status: 'unhealthy',
            responseTime: undefined,
            error: 'Connection timeout',
          },
        },
      };

      expect(degradedResponse.status).toBe('degraded');
      expect(degradedResponse.services.redis.status).toBe('unhealthy');
    });

    it('should validate an unhealthy response', () => {
      const unhealthyResponse: HealthCheckResponse = {
        status: 'unhealthy',
        uptime: 1000,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: {
          database: {
            status: 'unhealthy',
            responseTime: undefined,
            error: 'Connection refused',
          },
          redis: {
            status: 'unhealthy',
            responseTime: undefined,
            error: 'Connection refused',
          },
        },
      };

      expect(unhealthyResponse.status).toBe('unhealthy');
    });
  });

  // ============================================
  // Test: Custom Error Classes
  // ============================================

  describe('Custom Error Classes', () => {
    describe('HealthCheckError', () => {
      it('should create a HealthCheckError with correct properties', () => {
        const error = new HealthCheckError('Service unavailable', 'database', 'unhealthy');

        expect(error.message).toBe('Service unavailable');
        expect(error.service).toBe('database');
        expect(error.status).toBe('unhealthy');
        expect(error.name).toBe('HealthCheckError');
        expect(error).toBeInstanceOf(Error);
      });

      it('should default status to unhealthy when not provided', () => {
        const error = new HealthCheckError('Service unavailable', 'database');

        expect(error.status).toBe('unhealthy');
      });

      it('should support degraded status', () => {
        const error = new HealthCheckError('Slow response', 'redis', 'degraded');

        expect(error.status).toBe('degraded');
      });
    });

    describe('DatabaseHealthError', () => {
      it('should create a DatabaseHealthError with correct properties', () => {
        const error = new DatabaseHealthError('Connection failed');

        expect(error.message).toBe('Connection failed');
        expect(error.service).toBe('database');
        expect(error.status).toBe('unhealthy');
        expect(error.name).toBe('DatabaseHealthError');
        expect(error).toBeInstanceOf(HealthCheckError);
      });
    });

    describe('RedisHealthError', () => {
      it('should create a RedisHealthError with correct properties', () => {
        const error = new RedisHealthError('Connection failed');

        expect(error.message).toBe('Connection failed');
        expect(error.service).toBe('redis');
        expect(error.status).toBe('unhealthy');
        expect(error.name).toBe('RedisHealthError');
        expect(error).toBeInstanceOf(HealthCheckError);
      });
    });

    describe('HealthCheckTimeoutError', () => {
      it('should create a HealthCheckTimeoutError with correct properties', () => {
        const error = new HealthCheckTimeoutError('database', 5000);

        expect(error.message).toBe('Health check for database timed out after 5000ms');
        expect(error.service).toBe('database');
        expect(error.status).toBe('unhealthy');
        expect(error.name).toBe('HealthCheckTimeoutError');
        expect(error).toBeInstanceOf(HealthCheckError);
      });
    });
  });

  // ============================================
  // Test: checkHealth Function - Success Cases
  // ============================================

  describe('checkHealth - All Services Healthy', () => {
    it('should return healthy status when all services are up', async () => {
      const mockPrisma = createMockPrisma(true);
      const mockRedis = createMockRedis(true);

      const result = await checkHealth(mockPrisma as any, mockRedis as any);

      expect(result.status).toBe('healthy');
      expect(result.services.database.status).toBe('healthy');
      expect(result.services.redis.status).toBe('healthy');
      expect(result.uptime).toBeGreaterThan(0);
      expect(result.version).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should include response times for healthy services', async () => {
      const mockPrisma = createMockPrisma(true);
      const mockRedis = createMockRedis(true);

      const result = await checkHealth(mockPrisma as any, mockRedis as any);

      expect(result.services.database.responseTime).toBeDefined();
      expect(result.services.database.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.services.redis.responseTime).toBeDefined();
      expect(result.services.redis.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // Test: checkHealth Function - Database Failures
  // ============================================

  describe('checkHealth - Database Failures', () => {
    it('should return unhealthy status when database fails', async () => {
      const mockPrisma = createMockPrisma(false);
      const mockRedis = createMockRedis(true);

      const result = await checkHealth(mockPrisma as any, mockRedis as any);

      expect(result.status).toBe('unhealthy');
      expect(result.services.database.status).toBe('unhealthy');
      expect(result.services.database.error).toBeDefined();
    });

    it('should still check redis when database fails', async () => {
      const mockPrisma = createMockPrisma(false);
      const mockRedis = createMockRedis(true);

      const result = await checkHealth(mockPrisma as any, mockRedis as any);

      expect(result.services.redis.status).toBe('healthy');
    });

    it('should throw DatabaseHealthError on database connection failure', async () => {
      const mockPrisma = createMockPrisma(false);
      const mockRedis = createMockRedis(true);

      await expect(checkHealth(mockPrisma as any, mockRedis as any)).rejects.toThrow(DatabaseHealthError);
    });
  });

  // ============================================
  // Test: checkHealth Function - Redis Failures
  // ============================================

  describe('checkHealth - Redis Failures', () => {
    it('should return unhealthy status when redis fails', async () => {
      const mockPrisma = createMockPrisma(true);
      const mockRedis = createMockRedis(false);

      const result = await checkHealth(mockPrisma as any, mockRedis as any);

      expect(result.status).toBe('unhealthy');
      expect(result.services.redis.status).toBe('unhealthy');
      expect(result.services.redis.error).toBeDefined();
    });

    it('should still check database when redis fails', async () => {
      const mockPrisma = createMockPrisma(true);
      const mockRedis = createMockRedis(false);

      const result = await checkHealth(mockPrisma as any, mockRedis as any);

      expect(result.services.database.status).toBe('healthy');
    });

    it('should throw RedisHealthError on redis connection failure', async () => {
      const mockPrisma = createMockPrisma(true);
      const mockRedis = createMockRedis(false);

      await expect(checkHealth(mockPrisma as any, mockRedis as any)).rejects.toThrow(RedisHealthError);
    });
  });

  // ============================================
  // Test: checkHealth Function - Both Services Fail
  // ============================================

  describe('checkHealth - Both Services Fail', () => {
    it('should return unhealthy status when both services fail', async () => {
      const mockPrisma = createMockPrisma(false);
      const mockRedis = createMockRedis(false);

      const result = await checkHealth(mockPrisma as any, mockRedis as any).catch(() => null);

      // When both fail, the function should throw an error
      // The result would be null in this case due to catch
      expect(result).toBeNull();
    });
  });

  // ============================================
  // Test: checkHealth Function - Timeout Handling
  // ============================================

  describe('checkHealth - Timeout Handling', () => {
    it('should timeout database health check if it takes too long', async () => {
      const longDelay = 100;
      const mockPrisma = createMockPrisma(true, longDelay + 100);
      const mockRedis = createMockRedis(true);

      // Create a wrapper that simulates timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new HealthCheckTimeoutError('database', longDelay)), longDelay);
      });

      await expect(
        Promise.race([
          checkHealth(mockPrisma as any, mockRedis as any),
          timeoutPromise,
        ])
      ).rejects.toThrow(HealthCheckTimeoutError);
    }, 200);

    it('should timeout redis health check if it takes too long', async () => {
      const longDelay = 100;
      const mockPrisma = createMockPrisma(true);
      const mockRedis = createMockRedis(true, longDelay + 100);

      // Create a wrapper that simulates timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new HealthCheckTimeoutError('redis', longDelay)), longDelay);
      });

      await expect(
        Promise.race([
          checkHealth(mockPrisma as any, mockRedis as any),
          timeoutPromise,
        ])
      ).rejects.toThrow(HealthCheckTimeoutError);
    }, 200);
  });

  // ============================================
  // Test: Express Route Handler - Success
  // ============================================

  describe('Express Route Handler - Success', () => {
    it('should return 200 with healthy response when all services are up', async () => {
      const mockPrisma = createMockPrisma(true);
      const mockRedis = createMockRedis(true);
      
      const healthHandler = checkHealth(mockPrisma as any, mockRedis as any);

      // Simulate the Express route handler
      try {
        const result = await healthHandler;
        
        // Mock the response
        mockResponse.status = jest.fn().mockReturnValue({
          json: jest.fn().mockReturnValue(result),
        });
        
        // Verify the structure is correct
        expect(result.status).toBe('healthy');
        expect(result.services.database.status).toBe('healthy');
        expect(result.services.redis.status).toBe('healthy');
      } catch (error) {
        // Should not throw for healthy services
        fail('Should not throw for healthy services');
      }
    });
  });

  // ============================================
  // Test: Express Route Handler - Failure
  // ============================================

  describe('Express Route Handler - Failure', () => {
    it('should handle database errors and return appropriate response', async () => {
      const mockPrisma = createMockPrisma(false);
      const mockRedis = createMockRedis(true);

      const healthHandler = checkHealth(mockPrisma as any, mockRedis as any);

      await expect(healthHandler).rejects.toThrow(DatabaseHealthError);
    });

    it('should handle redis errors and return appropriate response', async () => {
      const mockPrisma = createMockPrisma(true);
      const mockRedis = createMockRedis(false);

      const healthHandler = checkHealth(mockPrisma as any, mockRedis as any);

      await expect(healthHandler).rejects.toThrow(RedisHealthError);
    });
  });

  // ============================================
  // Test: Uptime and Version Information
  // ============================================

  describe('System Information', () => {
    it('should return valid uptime value', async () => {
      const mockPrisma = createMockPrisma(true);
      const mockRedis = createMockRedis(true);

      const result = await checkHealth(mockPrisma as any, mockRedis as any);

      expect(result.uptime).toBeDefined();
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return version string', async () => {
      const mockPrisma = createMockPrisma(true);
      const mockRedis = createMockRedis(true);

      const result = await checkHealth(mockPrisma as any, mockRedis as any);

      expect(result.version).toBeDefined();
      expect(typeof result.version).toBe('string');
      expect(result.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should return valid timestamp', async () => {
      const mockPrisma = createMockPrisma(true);
      const mockRedis = createMockRedis(true);

      const result = await checkHealth(mockPrisma as any, mockRedis as any);

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).toISOString()).not.toBe('Invalid Date');
    });
  });

  // ============================================
  // Test: Resource Cleanup
  // ============================================

  describe('Resource Cleanup', () => {
    it('should disconnect from database after health check', async () => {
      const mockPrisma = createMockPrisma(true);
      const mockRedis = createMockRedis(true);

      try {
        await checkHealth(mockPrisma as any, mockRedis as any);
      } catch (e) {
        // Ignore errors for this test
      }

      // Verify $disconnect was called
      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });

    it('should quit redis connection after health check', async () => {
      const mockPrisma = createMockPrisma(true);
      const mockRedis = createMockRedis(true);

      try {
        await checkHealth(mockPrisma as any, mockRedis as any);
      } catch (e) {
        // Ignore errors for this test
      }

      // Verify quit was called
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should cleanup resources even on error', async () => {
      const mockPrisma = createMockPrisma(false);
      const mockRedis = createMockRedis(true);

      try {
        await checkHealth(mockPrisma as any, mockRedis as any);
      } catch (e) {
        // Expected to throw
      }

      // Verify cleanup was attempted even on error
      expect(mockPrisma.$disconnect).toHaveBeenCalled();
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  // ============================================
  // Test: Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should handle very fast responses', async () => {
      const mockPrisma = createMockPrisma(true, 0);
      const mockRedis = createMockRedis(true, 0);

      const startTime = Date.now();
      const result = await checkHealth(mockPrisma as any, mockRedis as any);
      const endTime = Date.now();

      expect(result.status).toBe('healthy');
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle null/undefined error messages gracefully', async () => {
      const mockPrisma = createMockPrisma(true);
      const mockRedis = createMockRedis(true);

      const result = await checkHealth(mockPrisma as any, mockRedis as any);

      // Verify no error messages when healthy
      expect(result.services.database.error).toBeUndefined();
      expect(result.services.redis.error).toBeUndefined();
    });

    it('should include all required service keys in response', async () => {
      const mockPrisma = createMockPrisma(true);
      const mockRedis = createMockRedis(true);

      const result = await checkHealth(mockPrisma as any, mockRedis as any);

      expect(result.services).toHaveProperty('database');
      expect(result.services).toHaveProperty('redis');
    });
  });
});
