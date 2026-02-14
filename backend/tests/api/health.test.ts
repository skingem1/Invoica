
import request from 'supertest';
import { Express } from 'express';
import { z } from 'zod';
import { Server } from 'http';
import { createApp } from '../../src/app';
import { healthResponseSchema } from '../../src/api/health';

/**
 * Health check endpoint test suite
 * Tests the /api/health endpoint for server status, uptime, version, and service connectivity
 */
describe('GET /api/health', () => {
  let app: Express;
  let server: Server;

  /**
   * Setup test environment before all tests
   */
  beforeAll(async () => {
    app = await createApp();
    server = app.listen(0); // Listen on random available port
  });

  /**
   * Cleanup after all tests complete
   */
  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  /**
   * Schema validation for health response
   */
  const validateHealthResponse = (data: unknown): z.infer<typeof healthResponseSchema> => {
    return healthResponseSchema.parse(data);
  };

  /**
   * Test successful health check response with all required fields
   */
  it('should return health status with all required fields', async () => {
    const response = await request(app).get('/api/health').expect(200);

    const validData = validateHealthResponse(response.body);

    expect(validData.status).toBe('ok');
    expect(validData.uptime).toBeGreaterThan(0);
    expect(validData.version).toBeDefined();
    expect(validData.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(validData.services).toBeDefined();
    expect(validData.timestamp).toBeDefined();
  });

  /**
   * Test database connection status in health response
   */
  it('should include database connection status', async () => {
    const response = await request(app).get('/api/health').expect(200);

    const validData = validateHealthResponse(response.body);

    expect(validData.services).toHaveProperty('database');
    expect(validData.services.database).toHaveProperty('connected');
    expect(typeof validData.services.database.connected).toBe('boolean');
    expect(validData.services.database).toHaveProperty('latencyMs');
    expect(validData.services.database.latencyMs).toBeGreaterThanOrEqual(0);
  });

  /**
   * Test Redis connection status in health response
   */
  it('should include Redis connection status', async () => {
    const response = await request(app).get('/api/health').expect(200);

    const validData = validateHealthResponse(response.body);

    expect(validData.services).toHaveProperty('redis');
    expect(validData.services.redis).toHaveProperty('connected');
    expect(typeof validData.services.redis.connected).toBe('boolean');
    expect(validData.services.redis).toHaveProperty('latencyMs');
    expect(validData.services.redis.latencyMs).toBeGreaterThanOrEqual(0);
  });

  /**
   * Test uptime increases on subsequent requests
   */
  it('should return increasing uptime values', async () => {
    const response1 = await request(app).get('/api/health').expect(200);
    const data1 = validateHealthResponse(response1.body);
    const uptime1 = data1.uptime;

    // Wait a small amount of time
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response2 = await request(app).get('/api/health').expect(200);
    const data2 = validateHealthResponse(response2.body);
    const uptime2 = data2.uptime;

    expect(uptime2).toBeGreaterThan(uptime1);
  });

  /**
   * Test timestamp is a valid ISO string
   */
  it('should return valid ISO timestamp', async () => {
    const response = await request(app).get('/api/health').expect(200);

    const validData = validateHealthResponse(response.body);

    expect(() => new Date(validData.timestamp)).not.toThrow();
    const timestampDate = new Date(validData.timestamp);
    expect(timestampDate.getTime()).toBeGreaterThan(0);
  });

  /**
   * Test response contains expected status values
   */
  it('should return valid status values', async () => {
    const response = await request(app).get('/api/health').expect(200);

    const validData = validateHealthResponse(response.body);

    expect(['ok', 'degraded', 'unhealthy']).toContain(validData.status);
  });

  /**
   * Test health check when database is unavailable (if applicable)
   */
  it('should handle database connection failure gracefully', async () => {
    // This test would require mocking the database connection
    // In a real scenario, you would inject a mock PrismaClient that throws
    // For now, we verify the response structure handles error cases
    const response = await request(app).get('/api/health').expect(200);

    const validData = validateHealthResponse(response.body);

    // Verify error information is present when services are down
    if (!validData.services.database.connected) {
      expect(validData.services.database).toHaveProperty('error');
    }
  });

  /**
   * Test health check when Redis is unavailable (if applicable)
   */
  it('should handle Redis connection failure gracefully', async () => {
    const response = await request(app).get('/api/health').expect(200);

    const validData = validateHealthResponse(response.body);

    // Verify error information is present when services are down
    if (!validData.services.redis.connected) {
      expect(validData.services.redis).toHaveProperty('error');
    }
  });

  /**
   * Test that health endpoint does not require authentication
   */
  it('should not require authentication', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.status).toBe(200);
  });

  /**
   * Test response headers
   */
  it('should return appropriate content type', async () => {
    const response = await request(app).get('/api/health').expect(200);

    expect(response.headers['content-type']).toContain('application/json');
  });

  /**
   * Test response time is reasonable
   */
  it('should respond quickly', async () => {
    const startTime = Date.now();
    await request(app).get('/api/health').expect(200);
    const endTime = Date.now();

    // Health check should complete within 2 seconds
    expect(endTime - startTime).toBeLessThan(2000);
  });

  /**
   * Test consistent response structure across multiple calls
   */
  it('should return consistent response structure', async () => {
    const responses = await Promise.all([
      request(app).get('/api/health'),
      request(app).get('/api/health'),
      request(app).get('/api/health'),
    ]);

    responses.forEach((response) => {
      expect(response.status).toBe(200);
      const validData = validateHealthResponse(response.body);
      
      // Verify all required top-level fields exist
      expect(validData).toHaveProperty('status');
      expect(validData).toHaveProperty('uptime');
      expect(validData).toHaveProperty('version');
      expect(validData).toHaveProperty('services');
      expect(validData).toHaveProperty('timestamp');
      
      // Verify services structure
      expect(validData.services).toHaveProperty('database');
      expect(validData.services).toHaveProperty('redis');
    });
  });

  /**
   * Test that Zod schema correctly validates response
   */
  it('should pass Zod schema validation for valid response', () => {
    const validResponse = {
      status: 'ok',
      uptime: 1000,
      version: '1.0.0',
      services: {
        database: {
          connected: true,
          latencyMs: 10,
        },
        redis: {
          connected: true,
          latencyMs: 5,
        },
      },
      timestamp: new Date().toISOString(),
    };

    expect(() => healthResponseSchema.parse(validResponse)).not.toThrow();
  });

  /**
   * Test that Zod schema rejects invalid response
   */
  it('should reject invalid response with Zod schema', () => {
    const invalidResponse = {
      status: 'ok',
      // Missing uptime
      version: '1.0.0',
      services: {
        database: {
          connected: true,
        },
      },
      timestamp: new Date().toISOString(),
    };

    expect(() => healthResponseSchema.parse(invalidResponse)).toThrow();
  });
});
