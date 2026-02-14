import { Request, Response, NextFunction } from 'express';
import { auditLogger, AuditLoggerOptions, AuditLogEntry } from '../../src/middleware/audit-logger';

// Extend Express Request interface to include apiKeyId
declare global {
  namespace Express {
    interface Request {
      apiKeyId?: string;
    }
  }
}

describe('auditLogger middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let loggedEntries: AuditLogEntry[];
  let mockLogFn: jest.Mock;

  beforeEach(() => {
    loggedEntries = [];
    mockLogFn = jest.fn((entry: AuditLogEntry) => {
      loggedEntries.push(entry);
    });

    mockReq = {
      method: 'GET',
      path: '/api/test',
      headers: {
        'user-agent': 'test-user-agent',
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      },
      ip: '127.0.0.1',
      apiKeyId: undefined,
    };

    mockRes = {
      statusCode: 200,
      end: jest.fn(),
    };

    mockNext = jest.fn();

    // Store original console.log
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createMiddleware = (options?: AuditLoggerOptions) => {
    return auditLogger(options);
  };

  describe('basic logging functionality', () => {
    it('should log request with all basic fields', (done) => {
      const startTime = Date.now();
      
      const middleware = createMiddleware({ logFn: mockLogFn });
      
      // Capture the wrapped res.end
      let wrappedEnd: ((...args: unknown[]) => void) | undefined;
      const originalEnd = mockRes.end;
      
      mockRes.end = function(...args: unknown[]) {
        // Simulate response time
        const responseTime = Date.now() - startTime;
        
        // Call original end
        originalEnd.apply(this, args as [unknown?, unknown?]);
        
        // Verify log entry after a small delay to ensure async logging completes
        setTimeout(() => {
          expect(mockLogFn).toHaveBeenCalledTimes(1);
          const logEntry = mockLogFn.mock.calls[0][0];
          
          expect(logEntry.timestamp).toBeDefined();
          expect(new Date(logEntry.timestamp).getTime()).not.toBeNaN();
          expect(logEntry.method).toBe('GET');
          expect(logEntry.path).toBe('/api/test');
          expect(logEntry.statusCode).toBe(200);
          expect(logEntry.responseTimeMs).toBeGreaterThanOrEqual(0);
          expect(logEntry.userAgent).toBe('test-user-agent');
          expect(logEntry.ip).toBe('192.168.1.1'); // X-Forwarded-For first IP
          
          done();
        }, 10);
        
        return this as unknown as Response;
      };
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
    });

    it('should call next() function', () => {
      const middleware = createMiddleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('IP address extraction', () => {
    it('should use X-Forwarded-For header when available', (done) => {
      mockReq.headers = {
        'x-forwarded-for': '10.0.0.5, 192.168.1.1',
      };
      
      const middleware = createMiddleware({ logFn: mockLogFn });
      
      mockRes.end = function(...args: unknown[]) {
        setTimeout(() => {
          const logEntry = mockLogFn.mock.calls[0][0];
          expect(logEntry.ip).toBe('10.0.0.5');
          done();
        }, 10);
        return this as unknown as Response;
      };
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
    });

    it('should fall back to req.ip when X-Forwarded-For is not available', (done) => {
      mockReq.headers = {};
      mockReq.ip = '192.168.50.1';
      
      const middleware = createMiddleware({ logFn: mockLogFn });
      
      mockRes.end = function(...args: unknown[]) {
        setTimeout(() => {
          const logEntry = mockLogFn.mock.calls[0][0];
          expect(logEntry.ip).toBe('192.168.50.1');
          done();
        }, 10);
        return this as unknown as Response;
      };
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
    });

    it('should use unknown IP when neither header nor req.ip available', (done) => {
      mockReq.headers = {};
      mockReq.ip = undefined;
      
      const middleware = createMiddleware({ logFn: mockLogFn });
      
      mockRes.end = function(...args: unknown[]) {
        setTimeout(() => {
          const logEntry = mockLogFn.mock.calls[0][0];
          expect(logEntry.ip).toBe('unknown');
          done();
        }, 10);
        return this as unknown as Response;
      };
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
    });
  });

  describe('API key ID extraction', () => {
    it('should log apiKeyId when present on request', (done) => {
      mockReq.apiKeyId = 'key_abc123';
      
      const middleware = createMiddleware({ logFn: mockLogFn });
      
      mockRes.end = function(...args: unknown[]) {
        setTimeout(() => {
          const logEntry = mockLogFn.mock.calls[0][0];
          expect(logEntry.apiKeyId).toBe('key_abc123');
          done();
        }, 10);
        return this as unknown as Response;
      };
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
    });

    it('should not include apiKeyId when not authenticated', (done) => {
      mockReq.apiKeyId = undefined;
      
      const middleware = createMiddleware({ logFn: mockLogFn });
      
      mockRes.end = function(...args: unknown[]) {
        setTimeout(() => {
          const logEntry = mockLogFn.mock.calls[0][0];
          expect(logEntry.apiKeyId).toBeUndefined();
          done();
        }, 10);
        return this as unknown as Response;
      };
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
    });
  });

  describe('header sanitization', () => {
    it('should not log headers by default', (done) => {
      mockReq.headers = {
        'authorization': 'Bearer secret_token',
        'x-api-key': 'secret_api_key',
        'content-type': 'application/json',
        'user-agent': 'test-agent',
      };
      
      const middleware = createMiddleware({ logFn: mockLogFn });
      
      mockRes.end = function(...args: unknown[]) {
        setTimeout(() => {
          const logEntry = mockLogFn.mock.calls[0][0];
          // Headers should not be logged by default
          expect((logEntry as Record<string, unknown>).headers).toBeUndefined();
          done();
        }, 10);
        return this as unknown as Response;
      };
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
    });

    it('should redact sensitive headers when logHeaders is true', (done) => {
      mockReq.headers = {
        'authorization': 'Bearer secret_token_123',
        'x-api-key': 'api_key_456',
        'x-auth-token': 'auth_token_789',
        'bearer': 'bearer_token',
        'cookie': 'session=abc123',
        'content-type': 'application/json',
        'x-custom-header': 'custom_value',
      };
      
      const middleware = createMiddleware({ 
        logFn: mockLogFn,
        logHeaders: true,
      });
      
      mockRes.end = function(...args: unknown[]) {
        setTimeout(() => {
          const logEntry = mockLogFn.mock.calls[0][0] as Record<string, unknown>;
          const headers = logEntry.headers as Record<string, string>;
          
          expect(headers).toBeDefined();
          
          // Sensitive headers should be redacted
          expect(headers['authorization']).toBe('[REDACTED]');
          expect(headers['x-api-key']).toBe('[REDACTED]');
          expect(headers['x-auth-token']).toBe('[REDACTED]');
          expect(headers['bearer']).toBe('[REDACTED]');
          expect(headers['cookie']).toBe('[REDACTED]');
          
          // Non-sensitive headers should be logged normally
          expect(headers['content-type']).toBe('application/json');
          expect(headers['x-custom-header']).toBe('custom_value');
          
          done();
        }, 10);
        return this as unknown as Response;
      };
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
    });

    it('should include additional custom sensitive headers', (done) => {
      mockReq.headers = {
        'x-my-secret': 'super_secret',
        'password': 'my_password',
        'x-custom-header': 'visible_value',
      };
      
      const middleware = createMiddleware({ 
        logFn: mockLogFn,
        logHeaders: true,
        sensitiveHeaders: ['x-my-secret', 'password'],
      });
      
      mockRes.end = function(...args: unknown[]) {
        setTimeout(() => {
          const logEntry = mockLogFn.mock.calls[0][0] as Record<string, unknown>;
          const headers = logEntry.headers as Record<string, string>;
          
          expect(headers['x-my-secret']).toBe('[REDACTED]');
          expect(headers['password']).toBe('[REDACTED]');
          expect(headers['x-custom-header']).toBe('visible_value');
          
          done();
        }, 10);
        return this as unknown as Response;
      };
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
    });
  });

  describe('response status code', () => {
    it('should log the response status code', (done) => {
      mockRes.statusCode = 404;
      
      const middleware = createMiddleware({ logFn: mockLogFn });
      
      mockRes.end = function(...args: unknown[]) {
        setTimeout(() => {
          const logEntry = mockLogFn.mock.calls[0][0];
          expect(logEntry.statusCode).toBe(404);
          done();
        }, 10);
        return this as unknown as Response;
      };
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
    });

    it('should log 500 status code for errors', (done) => {
      mockRes.statusCode = 500;
      
      const middleware = createMiddleware({ logFn: mockLogFn });
      
      mockRes.end = function(...args: unknown[]) {
        setTimeout(() => {
          const logEntry = mockLogFn.mock.calls[0][0];
          expect(logEntry.statusCode).toBe(500);
          done();
        }, 10);
        return this as unknown as Response;
      };
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
    });
  });

  describe('HTTP methods', () => {
    const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
    
    httpMethods.forEach((method) => {
      it(`should log ${method} method correctly`, (done) => {
        mockReq.method = method;
        
        const middleware = createMiddleware({ logFn: mockLogFn });
        
        mockRes.end = function(...args: unknown[]) {
          setTimeout(() => {
            const logEntry = mockLogFn.mock.calls[0][0];
            expect(logEntry.method).toBe(method);
            done();
          }, 10);
          return this as unknown as Response;
        };
        
        middleware(mockReq as Request, mockRes as Response, mockNext);
      });
    });
  });

  describe('error handling', () => {
    it('should handle res.end throwing an error gracefully', (done) => {
      const originalEnd = mockRes.end;
      let errorThrown = false;
      
      mockRes.end = function(...args: unknown[]) {
        try {
          // Simulate an error in the original end method
          errorThrown = true;
          throw new Error('res.end error');
        } finally {
          // Still call original to complete the response
          originalEnd.apply(this, args as [unknown?, unknown?]);
        }
      };
      
      const middleware = createMiddleware({ logFn: mockLogFn });
      
      // This should not throw unhandled error
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      setTimeout(() => {
        // Even if res.end throws, the middleware should handle it
        expect(mockNext).toHaveBeenCalled();
        done();
      }, 20);
    });

    it('should handle missing headers gracefully', (done) => {
      mockReq.headers = undefined;
      
      const middleware = createMiddleware({ 
        logFn: mockLogFn,
        logHeaders: true,
      });
      
      mockRes.end = function(...args: unknown[]) {
        setTimeout(() => {
          const logEntry = mockLogFn.mock.calls[0][0] as Record<string, unknown>;
          // Should handle undefined headers gracefully
          expect(logEntry.headers).toEqual({});
          done();
        }, 10);
        return this as unknown as Response;
      };
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
    });

    it('should handle missing user agent gracefully', (done) => {
      mockReq.headers = {};
      
      const middleware = createMiddleware({ logFn: mockLogFn });
      
      mockRes.end = function(...args: unknown[]) {
        setTimeout(() => {
          const logEntry = mockLogFn.mock.calls[0][0];
          expect(logEntry.userAgent).toBe('');
          done();
        }, 10);
        return this as unknown as Response;
      };
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
    });
  });

  describe('AuditLogEntry interface', () => {
    it('should produce valid AuditLogEntry structure', (done) => {
      mockReq.method = 'POST';
      mockReq.path = '/api/users';
      mockReq.apiKeyId = 'key_xyz789';
      mockRes.statusCode = 201;
      
      const middleware = createMiddleware({ logFn: mockLogFn });
      
      mockRes.end = function(...args: unknown[]) {
        setTimeout(() => {
          const logEntry = mockLogFn.mock.calls[0][0];
          
          // Validate all required fields
          expect(typeof logEntry.timestamp).toBe('string');
          expect(typeof logEntry.method).toBe('string');
          expect(typeof logEntry.path).toBe('string');
          expect(typeof logEntry.ip).toBe('string');
          expect(typeof logEntry.userAgent).toBe('string');
          expect(typeof logEntry.statusCode).toBe('number');
          expect(typeof logEntry.responseTimeMs).toBe('number');
          
          // Validate optional field
          expect(logEntry.apiKeyId).toBe('key_xyz789');
          
          done();
        }, 10);
        return this as unknown as Response;
      };
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
    });
  });

  describe('default options', () => {
    it('should use console.log by default', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      const middleware = createMiddleware();
      
      // Trigger the response
      mockRes.end = function(...args: unknown[]) {
        // Verify console.log was called
        expect(consoleSpy).toHaveBeenCalled();
        return this as unknown as Response;
      };
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
    });
  });
});