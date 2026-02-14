import request from 'supertest';
import express, { Express } from 'express';
import { Server } from 'http';
import os from 'os';

// Mock Prisma Client
const mockPrisma = {
  $queryRaw: jest.fn().mockResolvedValue([]),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

// Mock Redis client
const mockRedisClient = {
  isOpen: true,
  ping: jest.fn().mockResolvedValue('PONG'),
  connect: jest.fn().mockResolvedValue(undefined),
};

jest.mock('redis', () => ({
  createClient: jest.fn().mockReturnValue(mockRedisClient),
}));

// Import the health router after mocks are set up
import healthRouter from '../../src/api/health';

describe('Health Check API', () => {
  let app: Express;
  let server: Server;

  beforeAll(() => {
    app = express();
    app.use('/api/health', healthRouter);
    server = app.listen(0);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return healthy status when all services are up', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);
      mockRedisClient.ping.mockResolvedValueOnce('PONG');

      const response = await request(server).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
      expect(response.body.services.database.status).toBe('up');
      expect(response.body.services.redis.status).toBe('up');
      expect(response.body.services.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.body.services.redis.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.body.system).toBeDefined();
      expect(response.body.system.platform).toBe(os.platform());
    });

    it('should return degraded status when database is down but redis is up', async () => {
      mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('Database connection failed'));
      mockRedisClient.ping.mockResolvedValueOnce('PONG');

      const response = await request(server).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('degraded');
      expect(response.body.services.database.status).toBe('down');
      expect(response.body.services.redis.status).toBe('up');
      expect(response.body.services.database.error).toBeDefined();
    });

    it('should return degraded status when redis is down but database is up', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);
      mockRedisClient.ping.mockRejectedValueOnce(new Error('Redis connection failed'));

      const response = await request(server).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('degraded');
      expect(response.body.services.database.status).toBe('up');
      expect(response.body.services.redis.status).toBe('down');
      expect(response.body.services.redis.error).toBeDefined();
    });

    it('should return unhealthy status when all services are down', async () => {
      mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('Database connection failed'));
      mockRedisClient.ping.mockRejectedValueOnce(new Error('Redis connection failed'));

      const response = await request(server).get('/api/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.services.database.status).toBe('down');
      expect(response.body.services.redis.status).toBe('down');
    });

    it('should return valid response schema', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);
      mockRedisClient.ping.mockResolvedValueOnce('PONG');

      const response = await request(server).get('/api/health');

      // Check required fields
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('system');

      // Check services structure
      expect(response.body.services).toHaveProperty('database');
      expect(response.body.services).toHaveProperty('redis');
      expect(response.body.services.database).toHaveProperty('status');
      expect(response.body.services.database).toHaveProperty('latencyMs');
      expect(response.body.services.database).toHaveProperty('error');
      expect(response.body.services.redis).toHaveProperty('status');
      expect(response.body.services.redis).toHaveProperty('latencyMs');
      expect(response.body.services.redis).toHaveProperty('error');

      // Check system structure
      expect(response.body.system).toHaveProperty('cpuLoad');
      expect(response.body.system).toHaveProperty('freeMemory');
      expect(response.body.system).toHaveProperty('totalMemory');
      expect(response.body.system).toHaveProperty('platform');

      // Validate data types
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
      expect(['up', 'down']).toContain(response.body.services.database.status);
      expect(['up', 'down']).toContain(response.body.services.redis.status);
      expect(Array.isArray(response.body.system.cpuLoad)).toBe(true);
      expect(typeof response.body.system.freeMemory).toBe('number');
      expect(typeof response.body.system.totalMemory).toBe('number');
    });

    it('should return valid ISO timestamp', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);
      mockRedisClient.ping.mockResolvedValueOnce('PONG');

      const response = await request(server).get('/api/health');

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('should return positive uptime', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);
      mockRedisClient.ping.mockResolvedValueOnce('PONG');

      const response = await request(server).get('/api/health');

      expect(response.body.uptime).toBeGreaterThan(0);
    });

    it('should include system resource information', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);
      mockRedisClient.ping.mockResolvedValueOnce('PONG');

      const response = await request(server).get('/api/health');

      expect(response.body.system.freeMemory).toBeGreaterThan(0);
      expect(response.body.system.totalMemory).toBeGreaterThan(0);
      expect(response.body.system.totalMemory).toBeGreaterThanOrEqual(response.body.system.freeMemory);
      expect(response.body.system.cpuLoad).toHaveLength(3);
    });

    it('should handle database connection timeout gracefully', async () => {
      mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('Connection timeout'));
      mockRedisClient.ping.mockResolvedValueOnce('PONG');

      const response = await request(server).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('degraded');
      expect(response.body.services.database.status).toBe('down');
      expect(response.body.services.database.error).toContain('Connection timeout');
    });

    it('should handle redis client not connected scenario', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);
      
      // Simulate Redis client not being connected
      mockRedisClient.isOpen = false;
      mockRedisClient.ping.mockRejectedValueOnce(new Error('Client not open'));

      const response = await request(server).get('/api/health');

      expect(response.body.status).toBe('degraded');
      expect(response.body.services.redis.status).toBe('down');

      // Reset for other tests
      mockRedisClient.isOpen = true;
    });
  });
});
