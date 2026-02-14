import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * List of headers that contain sensitive information and should be redacted.
 * Includes common authentication and authorization headers.
 */
const SENSITIVE_HEADERS: ReadonlyArray<string> = [
  'authorization',
  'x-api-key',
  'x-auth-token',
  'bearer',
  'cookie',
  'set-cookie',
  'x-access-token',
  'x-refresh-token',
  'proxy-authenticate',
  'www-authenticate',
];

/**
 * Configuration options for the audit logger middleware.
 */
export interface AuditLoggerOptions {
  /**
   * Whether to log request headers (opt-in due to potential sensitive data exposure).
   * When false, headers are not logged at all.
   * @default false
   */
  logHeaders?: boolean;
  
  /**
   * List of additional header names to treat as sensitive (will be redacted if headers are logged).
   * These are added to the default SENSITIVE_HEADERS list.
   * @default []
   */
  sensitiveHeaders?: string[];
  
  /**
   * Custom log function to use instead of console.log.
   * Useful for testing or integrating with logging systems.
   * @default console.log
   */
  logFn?: (entry: AuditLogEntry) => void;
}

/**
 * Represents a single audit log entry for an API request.
 */
export interface AuditLogEntry {
  /**
   * ISO 8601 timestamp of when the request was received.
   */
  timestamp: string;
  
  /**
   * HTTP method (GET, POST, PUT, DELETE, etc.).
   */
  method: string;
  
  /**
   * Request path (URL path portion).
   */
  path: string;
  
  /**
   * Client IP address (from X-Forwarded-For header or direct remote address).
   */
  ip: string;
  
  /**
   * User agent string from the request headers.
   */
  userAgent: string;
  
  /**
   * API key ID if the request was authenticated via API key.
   * Undefined if not authenticated.
   */
  apiKeyId?: string;
  
  /**
   * HTTP response status code.
   */
  statusCode: number;
  
  /**
   * Response time in milliseconds.
   */
  responseTimeMs: number;
  
  /**
   * Redacted request headers (only included if logHeaders option is true).
   */
  headers?: Record<string, string>;
}

/**
 * Extracts the client IP address from the request.
 * Checks X-Forwarded-For header first (for proxied requests), then falls back to req.ip.
 * 
 * @param req - The Express request object
 * @returns The client IP address string
 */
function getClientIp(req: Request): string {
  // Check X-Forwarded-For header first (common for load balancers/proxies)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, the first is the original client
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0];
    return ips.trim();
  }
  
  // Fall back to req.ip (set by Express, may not always be available)
  return req.ip || 'unknown';
}

/**
 * Extracts the user agent from the request headers.
 * 
 * @param req - The Express request object
 * @returns The user agent string or 'unknown'
 */
function getUserAgent(req: Request): string {
  const userAgent = req.headers['user-agent'];
  return Array.isArray(userAgent) ? userAgent[0] : (userAgent || 'unknown');
}

/**
 * Extracts the API key ID from the request if present.
 * Checks common header names for API key authentication.
 * 
 * @param req - The Express request object
 * @returns The API key ID if found, undefined otherwise
 */
function getApiKeyId(req: Request): string | undefined {
  // Check for API key in headers (common patterns)
  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader) {
    // Return masked or partial ID for security
    const keyValue = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
    if (keyValue && keyValue.length > 8) {
      return `***${keyValue.slice(-4)}`;
    }
    return '****';
  }
  
  // Check Authorization header for Bearer token (API key format)
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const authValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (authValue.startsWith('Bearer ')) {
      const token = authValue.slice(7);
      if (token.length > 8) {
        return `***${token.slice(-4)}`;
      }
      return '****';
    }
  }
  
  return undefined;
}

/**
 * Redacts sensitive information from headers object.
 * Creates a new object with sensitive headers replaced by [REDACTED].
 * 
 * @param headers - The headers object to sanitize
 * @param additionalSensitive - Optional additional headers to treat as sensitive
 * @returns A new object with sensitive headers redacted
 */
function sanitizeHeaders(
  headers: Record<string, string | string[] | undefined>,
  additionalSensitive: string[] = []
): Record<string, string> {
  const allSensitive = new Set([
    ...SENSITIVE_HEADERS,
    ...additionalSensitive.map(h => h.toLowerCase()),
  ]);
  
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    if (allSensitive.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (value !== undefined) {
      sanitized[key] = Array.isArray(value) ? value.join(', ') : String(value);
    }
  }
  
  return sanitized;
}

/**
 * Type guard to check if a value is a valid primitive that can be stringified.
 */
function isValidHeaderValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    Array.isArray(value)
  );
}

/**
 * Creates audit logging middleware for Express.
 * Logs every API request with timestamp, method, path, IP, user agent,
 * API key ID (if authenticated), response status, and response time.
 * 
 * @param options - Configuration options for the audit logger
 * @returns Express middleware function for audit logging
 * 
 * @example
 *