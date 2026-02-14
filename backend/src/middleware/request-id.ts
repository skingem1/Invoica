import { type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * Generates a new UUID v4 using crypto.randomUUID()
 * @returns A new UUID string
 */
function generateRequestId(): string {
  return randomUUID();
}

/**
 * Extracts the X-Request-Id header from a request
 * @param req - Express Request object
 * @returns The request ID or 'unknown' if not present
 */
export function getRequestId(req: Request): string {
  const requestId = req.headers['x-request-id'];

  if (typeof requestId === 'string' && requestId.length > 0) {
    return requestId;
  }

  return 'unknown';
}

/**
 * Express middleware that ensures every request has a unique request ID.
 * If X-Request-Id header is present in the request, it uses that value.
 * Otherwise, it generates a new UUID v4.
 *
 * The request ID is:
 * - Attached to req.headers['x-request-id']
 * - Set on the response header X-Request-Id
 *
 * @returns Express middleware function
 */
export function requestId(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const existingRequestId = getRequestId(req);

    // If header is missing or empty, generate a new UUID
    const finalRequestId = existingRequestId === 'unknown'
      ? generateRequestId()
      : existingRequestId;

    // Attach to request headers
    req.headers['x-request-id'] = finalRequestId;

    // Set response header
    res.setHeader('X-Request-Id', finalRequestId);

    next();
  };
}