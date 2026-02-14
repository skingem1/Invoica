import { Request, Response, NextFunction } from 'express';

/**
 * Sensitive headers that should be redacted from logs
 */
const SENSITIVE_HEADERS = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  timestamp: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  apiKeyId?: string;
  statusCode?: number;
  responseTimeMs?: number;
  headers?: Record<string, string>;
}

/**
 * Sanitize headers by removing sensitive information
 * @param headers - Raw request headers
 * @returns Sanitized headers object with sensitive data redacted
 */
export function sanitizeHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_HEADERS.includes(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (value !== undefined) {
      sanitized[key] = Array.isArray(value) ? value.join(', ') : String(value);
    }
  }
  
  return sanitized;
}

/**
 * Extended Request interface to include apiKeyId
 */
export interface AuditLoggerRequest extends Request {
  apiKeyId?: string;
}

/**
 * Extended Response interface to include timing
 */
export interface AuditLoggerResponse extends Response {
  startTime?: number;
}

/**
 * Audit logger middleware factory
 * Logs all API requests with comprehensive details
 * @returns Express middleware function
 */
export function auditLogger() {
  return (req: AuditLoggerRequest, res: AuditLoggerResponse, next: NextFunction): void => {
    // Capture start time
    res.startTime = Date.now();
    
    // Capture original end method
    const originalEnd = res.end.bind(res);
    
    // Override end method to log after response is sent
    res.end = function (chunk?: any, encoding?: any, cb?: any): Response {
      const responseTimeMs = res.startTime ? Date.now() - res.startTime : undefined;
      
      // Extract IP address from various sources
      const ip = (
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        (req.headers['x-real-ip'] as string) ||
        req.socket?.remoteAddress ||
        'unknown'
      );
      
      // Get user agent
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      // Sanitize headers for logging
      const sanitizedHeaders = sanitizeHeaders(req.headers as Record<string, string | string[] | undefined>);
      
      // Build audit log entry
      const auditEntry: AuditLogEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        ip,
        userAgent,
        statusCode: res.statusCode,
        responseTimeMs,
        headers: sanitizedHeaders,
      };
      
      // Add API key ID if present
      if (req.apiKeyId) {
        auditEntry.apiKeyId = req.apiKeyId;
      }
      
      // Log to stdout as structured JSON
      try {
        const logLine = JSON.stringify(auditEntry);
        console.log(logLine);
      } catch (stringifyError) {
        // Fallback if JSON.stringify fails
        console.log(JSON.stringify({
          timestamp: auditEntry.timestamp,
          method: auditEntry.method,
          path: auditEntry.path,
          error: 'Failed to stringify audit log entry',
        }));
      }
      
      // Call original end method
      return originalEnd(chunk, encoding, cb);
    };
    
    next();
  };
}

export default auditLogger;