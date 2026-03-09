import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createApiKey, createApiKeySchema, getCustomerApiKeys, updateApiKey, rotateApiKey, invalidateApiKey } from '../services/api-keys';

const router = Router();

/**
 * Validation schemas
 */
const userIdSchema = z.string().uuid({ message: 'Invalid user ID format' });
const keyIdSchema = z.string().uuid({ message: 'Invalid key ID format' });

/**
 * Middleware to extract and validate userId from request headers.
 * Required for list/rotate/revoke endpoints that scope to a user.
 */
const extractUserId = (req: Request, res: Response, next: NextFunction): void => {
  const customerId = (req.headers['x-customer-id'] || req.headers['x-user-id']) as string;
  if (!customerId) {
    res.status(401).json({ error: 'Unauthorized', message: 'Customer ID not provided' });
    return;
  }
  (req as any).userId = customerId;
  next();
};
/**
 * POST /v1/api-keys
 * Create a new API key.
 * customerEmail is optional — defaults to ${customerId}@agents.invoica.ai.
 */
router.post('/v1/api-keys', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await createApiKey(req.body);

    res.status(201).json({
      success: true,
      data: {
        id: result.id,
        customerId: result.customerId,
        customerEmail: result.customerEmail,
        name: result.name,
        tier: result.tier,
        plan: result.plan,
        permissions: result.permissions,
        keyPrefix: result.keyPrefix,
        key: result.key,       // One-time display of the raw key
        isActive: result.isActive,
        expiresAt: result.expiresAt,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: err.errors,
        },
      });
      return;
    }
    next(err);
  }
});

/**
 * GET /v1/api-keys
 * List all API keys for the authenticated user.
 * Returns sanitized keys (prefix + metadata only, never raw key).
 */
router.get('/v1/api-keys', extractUserId, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = (req as any).userId;
    const keys = await getCustomerApiKeys(customerId);
    res.status(200).json({ success: true, data: keys });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v1/api-keys/:id/rotate
 * Rotate an existing API key (scoped by key ID only).
 */
router.post('/v1/api-keys/:id/rotate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const keyId = req.params.id;
    const keyIdValidation = keyIdSchema.safeParse(keyId);
    if (!keyIdValidation.success) {
      res.status(400).json({ error: 'Invalid Request', message: 'Invalid key ID format' });
      return;
    }
    const result = await rotateApiKey(keyId);
    res.status(200).json({
      success: true,
      data: {
        id: result.id,
        key: result.key,
        keyPrefix: result.keyPrefix,
        isActive: result.isActive,
        createdAt: result.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v1/api-keys/:id/revoke
 * Revoke an API key (frontend-compatible endpoint).
 */
router.post('/v1/api-keys/:id/revoke', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const keyId = req.params.id;
    await updateApiKey(keyId, { isActive: false });
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /v1/api-keys/:id
 * Invalidate an API key immediately.
 */
router.delete('/v1/api-keys/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const keyId = req.params.id;
    const keyIdValidation = keyIdSchema.safeParse(keyId);
    if (!keyIdValidation.success) {
      res.status(400).json({ error: 'Invalid Request', message: 'Invalid key ID format' });
      return;
    }
    await invalidateApiKey(keyId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * Error handling middleware
 */
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('API Keys Route Error:', err);

  if (err instanceof z.ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: err.errors,
    });
    return;
  }

  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  });
});

export default router;
