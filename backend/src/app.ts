import express, { Express, Request, Response, NextFunction } from 'express';
import { securityMiddleware } from './middleware/security';
import { rateLimiter } from './middleware/rate-limit';
import { authMiddleware } from './middleware/auth';
import { checkHealth } from './api/health';
import { proxyMiddleware } from './proxy/middleware';

/**
 * Creates and configures the Express application
 * with all middleware and routes
 */
export function createApp(): Express {
  const app = express();

  // Body parsing - must be before any routes
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Security middleware (helmet, cors, etc.)
  app.use(securityMiddleware);

  // Rate limiting
  app.use(rateLimiter);

  // Proxy middleware for x402 payment handling
  app.use(proxyMiddleware);

  // Health check endpoint (public, no auth required)
  app.get('/health', async (_req: Request, res: Response) => {
    try {
      const healthStatus = await checkHealth();
      const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(healthStatus);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: message,
      });
    }
  });

  // Version endpoint (public, no auth required)
  app.get('/version', (_req: Request, res: Response) => {
    res.json({
      version: '0.1.0',
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // All other routes require authentication
  app.use(authMiddleware);

  // Global error handling middleware
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });

  return app;
}

// Export the default configured app instance
export const app = createApp();