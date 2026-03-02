import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiKeyRotationService, ApiKey, RotateKeyResponse, ApiKeyRotationError } from '../services/api-key-rotation';

const router = Router();

// Initialize the rotation service
const apiKeyService = new ApiKeyRotationService();

/**
 * Validation schemas
 */
const userIdSchema = z.string().uuid({ message: 'Invalid user ID format' });
const keyIdSchema = z.string().uuid({ message: 'Invalid key ID format' });

/**
 * Middleware to extract and validate userId from request
 * In production, this would come from authentication middleware
 */
const extractUserId = (req: Request, res: Response, next: NextFunction): void => {
  // In production, this would be extracted from JWT token or session
  // For now, we expect it in headers
  const userId = req.headers['x-user-id'] as string;
  
  if (!userId) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'User ID not provided',
    });
    return;
  }

  // Validate UUID format
  const validation = userIdSchema.safeParse(userId);
  if (!validation.success) {
    res.status(400).json({
      error: 'Invalid Request',
      message: 'Invalid user ID format',
      details: validation.error.errors,
    });
    return;
  }

  (req as Request & { userId: string }).userId = userId;
  next();
};

/**
 * GET /v1/api-keys
 * List all API keys for the authenticated user
 * Returns sanitized keys (prefix + last 4 chars only, never raw key)
 */
router.get('/', extractUserId, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as Request & { userId: string }).userId;

    const keys: ApiKey[] = await apiKeyService.listKeys(userId);

    res.status(200).json({
      keys,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v1/api-keys/:id/rotate
 * Rotate an existing API key
 * Generates a new key, sets old key expiry to 24 hours from now
 */
router.post('/:id/rotate', extractUserId, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const keyId = req.params.id;

    // Validate key ID format
    const keyIdValidation = keyIdSchema.safeParse(keyId);
    if (!keyIdValidation.success) {
      res.status(400).json({
        error: 'Invalid Request',
        message: 'Invalid key ID format',
        details: keyIdValidation.error.errors,
      });
      return;
    }

    const result: RotateKeyResponse = await apiKeyService.rotateKey(keyId, userId);

    res.status(200).json({
      apiKey: result.newKey,
      keyId: result.newKeyId,
      expiresOldKeyAt: result.expiresOldKeyAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /v1/api-keys/:id
 * Revoke an API key immediately
 * Sets is_active = false
 */
router.delete('/:id', extractUserId, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const keyId = req.params.id;

    // Validate key ID format
    const keyIdValidation = keyIdSchema.safeParse(keyId);
    if (!keyIdValidation.success) {
      res.status(400).json({
        error: 'Invalid Request',
        message: 'Invalid key ID format',
        details: keyIdValidation.error.errors,
      });
      return;
    }

    await apiKeyService.revokeKey(keyId, userId);

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

  if (err instanceof ApiKeyRotationError) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: err.code,
      message: err.message,
    });
    return;
  }

  // Handle Zod validation errors
  if (err instanceof z.ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: err.errors,
    });
    return;
  }

  // Generic server error
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  });
});

export default router;
