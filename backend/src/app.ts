import express, { Application, Request, Response, NextFunction } from 'express';
import { securityMiddleware } from './middleware/security';
import { rateLimiterMiddleware } from './middleware/rate-limit';
import { authMiddleware, extractTokenFromHeader } from './middleware/auth';
import { proxyMiddleware } from './proxy/middleware';
import { checkHealth } from './api/health';
import { AppError } from './errors/AppError';

/**
 * Creates and configures the Express application
 * Middleware order is critical:
 * 1. Body parsing (express.json())
 * 2. Security middleware (helmet, cors)
 * 3. Rate limiting
 * 4. Public endpoints (health, version) - no auth required
 * 5. Auth middleware - for protected routes
 * 6. Proxy middleware - handles x402 payment requests (protected)
 * 7. Global error handler
 */
export function createApp(): Application {
  const app = express();

  // 1. Body parsing - must be first to parse request bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 2. Security middleware (helmet, cors, etc.)
  app.use(securityMiddleware);

  // 3. Rate limiting - apply to all requests
  app.use(rateLimiterMiddleware);

  // 4. Public endpoints - no authentication required
  app.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const health = await checkHealth();
      res.json(health);
    } catch (error) {
      next(error);
    }
  });

  app.get('/version', (_req: Request, res: Response) => {
    res.json({
      version: '0.1.0',
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // 5. Auth middleware - applies to all routes after this point
  // This ensures protected routes require authentication
  app.use(authMiddleware);

  // 6. Proxy middleware - handles x402 payment requests (protected by auth)
  app.use(proxyMiddleware);

  // 7. Global error handler - must be last
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      const statusCode = err.statusCode || 500;
      const response = {
        error: err.name,
        message: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      };
      res.status(statusCode).json(response);
      return;
    }

    // Handle unknown errors
    const response = {
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    };
    res.status(500).json(response);
  });

  return app;
}

// Create and export the default app instance
const app = createApp();
export default app;