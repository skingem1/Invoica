import { Request, Response, NextFunction } from 'express';

// Type for the audit log entry
export interface AuditLogEntry {
  timestamp: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  apiKeyId: string | null;
  statusCode: number;
  responseTimeMs: number;
  headers?: Record<string, string>;
}

// Type for sensitive headers that need redaction
const SENSITIVE_HEADERS = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];

// Sanitize function to redact sensitive headers
export function sanitizeHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (Array.isArray(value)) {
      sanitized[key] = value.join(', ');
    } else if (value !== undefined) {
      sanitized[key] = String(value);
    }
  }
  
  return sanitized;
}

// Middleware function to log each request
export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  // Capture the original end method to log response after it's sent
  const originalEnd = res.end;
  
  res.end = function (chunk: Buffer | string | undefined, encoding?: BufferEncoding): void {
    const responseTime = Date.now() - startTime;
    const timestamp = new Date().toISOString();
    
    // Extract client IP, handling proxies and load balancers
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || req.socket?.remoteAddress 
      || 'unknown';
    
    // Get API key ID if present in request
    const apiKeyId = (req.headers['x-api-key-id'] as string) 
      || (req as any).apiKeyId 
      || null;
    
    // Build the audit log entry
    const auditEntry: AuditLogEntry = {
      timestamp,
      method: req.method,
      path: req.path,
      ip,
      userAgent: req.headers['user-agent'] || 'unknown',
      apiKeyId,
      statusCode: res.statusCode,
      responseTimeMs: responseTime
    };
    
    // Output the log entry as structured JSON
    console.log(JSON.stringify(auditEntry));
    
    // Restore the original end method
    res.end = originalEnd;
    res.end(chunk, encoding);
  };
  
  next();
}