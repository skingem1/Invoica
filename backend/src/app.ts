import express, { Application, Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';

// Import middleware
import { securityMiddleware } from './middleware/security';
import { rateLimiter } from './middleware/rate-limit';
import { authMiddleware, extractTokenFromHeader } from './middleware/auth';

// Import health check
import { checkHealth } from './api/health';

// Import proxy middleware
import { proxyMiddleware } from './proxy/middleware';

// Load version from package.json
function getVersion(): string {
  try {
    const packageJsonPath = path.resolve(__dirname, '../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// Custom error class with proper typing
class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Type guard to check if error is AppError
function isAppError(error: unknown): error is AppError {
  return (
    error instanceof AppError ||
    (typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof (error as Record<string, unknown>).statusCode === 'number')
  );
}

const app: Application = express();
const API_VERSION = getVersion();

// Body parsing middleware
app.use(express.json());

// Security middleware (helmet, cors, etc.)
app.use(securityMiddleware);

// Rate limiting
app.use(rateLimiter);

// Health check endpoint (public)
app.get('/health', async (_req: Request, res: Response) => {
  const health = await checkHealth();
  const status = health.status === 'healthy' ? 200 : 503;
  res.status(status).json(health);
});

// Version endpoint (public)
app.get('/version', (_req: Request, res: Response) => {
  res.json({
    version: API_VERSION,
    environment: process.env.NODE_ENV || 'development',
  });
});

// Proxy middleware for x402 payment requests
app.use(proxyMiddleware);

// Auth middleware for protected routes
// Note: Apply after public routes but before error handlers
app.use(authMiddleware);

// 404 handler for unmatched routes
app.use((_req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND',
    },
  });
});

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);

  if (isAppError(err)) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.statusCode.toString(),
      },
    });
  } else {
    // Handle unknown errors
    res.status(500).json({
      success: false,
      error: {
        message: process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : err.message,
        code: 'INTERNAL_ERROR',
      },
    });
  }
});

export { app, AppError, extractTokenFromHeader };