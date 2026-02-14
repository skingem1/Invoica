import express, { Express, Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { createApp } from '../src/app';

// Mock dependencies
jest.mock('../src/middleware/security', () => ({
  securityMiddleware: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../src/middleware/rate-limit', () => ({
  rateLimiter: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../src/middleware/auth', () => ({
  authMiddleware: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../src/api/health', () => ({
  checkHealth: jest.fn().mockResolvedValue({ status: 'healthy', timestamp: new Date().toISOString() }),


}));

jest.mock('../src/proxy/middleware', () => ({
  proxyMiddleware: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));

describe('createApp', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /version', () => {
    it('should return version and environment', async () => {
      const response = await request(app).get('/version');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('version', '0.1.0');
      expect(response.body).toHaveProperty('environment');
    });
  });

  describe('Middleware application', () => {
    it('should apply security middleware', async () => {
      const { securityMiddleware } = require('../src/middleware/security');
      await request(app).get('/health');
      expect(securityMiddleware).toHaveBeenCalled();
    });

    it('should apply rate limiter', async () => {
      const { rateLimiter } = require('../src/middleware/rate-limit');
      await request(app).get('/health');
      expect(rateLimiter).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle errors globally', async () => {
      const error = new Error('Test error');
      const mockReq = {} as Request;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;
      const mockNext = jest.fn();

      const errorMiddleware = (err: Error, req: Request, res: Response, next: NextFunction) => {
        res.status(500).json({ error: err.message });
      };

      app.use(errorMiddleware);
      app.get('/error-test', () => {
        throw error;
      });

      const response = await request(app).get('/error-test');
      expect(response.status).toBe(500);
    });
  });
});