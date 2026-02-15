import { Request, Response, Router, NextFunction } from 'express';
import { dashboardMetrics, dashboardHealth } from './dashboard-mock';
import { listApiKeys, createApiKey } from './api-keys-mock';
import { listWebhooks, registerWebhook } from './webhooks-mock';

const router = Router();

// Type for async handler
type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

// Wrapper for async route handlers
const asyncHandler = (fn: AsyncRequestHandler) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Health check
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
}));

// Dashboard endpoints (added in BE-160)
router.get('/v1/dashboard/metrics', asyncHandler(dashboardMetrics));
router.get('/v1/dashboard/health', asyncHandler(dashboardHealth));

// API Keys endpoints
router.get('/v1/api-keys', asyncHandler(listApiKeys));
router.post('/v1/api-keys', asyncHandler(createApiKey));

// Webhooks endpoints
router.get('/v1/webhooks', asyncHandler(listWebhooks));
router.post('/v1/webhooks', asyncHandler(registerWebhook));

// 404 handler
router.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

export default router;