import { Request, Response, NextFunction } from 'express';
import { auditLogger, sanitizeHeaders, AuditLogEntry } from '../../src/middleware/audit-logger';

// Mock console.log to capture output
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

describe('sanitizeHeaders', () => {
  beforeEach(() => {
    mockConsoleLog.mockClear();
  });

  it('should redact Authorization header', () => {
    const headers = { 'authorization': 'Bearer token123' };
    const result = sanitizeHeaders(headers);
    expect(result['authorization']).toBe('[REDACTED]');
  });

  it('should redact X-Api-Key header', () => {
    const headers = { 'X-Api-Key': 'secret-api-key-123' };
    const result = sanitizeHeaders(headers);
    expect(result['X-Api-Key']).toBe('[REDACTED]');
  });

  it('should redact cookie header', () => {
    const headers = { 'cookie': 'session=abc123; token=xyz789' };
    const result = sanitizeHeaders(headers);
    expect(result['cookie']).toBe('[REDACTED]');
  });

  it('should redact Set-Cookie header', () => {
    const headers = { 'set-cookie': 'session=abc123; Path=/; HttpOnly' };
    const result = sanitizeHeaders(headers);
    expect(result['set-cookie']).toBe('[REDACTED]');
  });

  it('should handle case-insensitive sensitive headers', () => {
    const headers = { 'AUTHORIZATION': 'Bearer token', 'x-api-key': 'key123' };
    const result = sanitizeHeaders(headers);
    expect(result['AUTHORIZATION']).toBe('[REDACTED]');
    expect(result['x-api-key']).toBe('[REDACTED]');
  });

  it('should preserve non-sensitive headers', () => {
    const headers = { 
      'content-type': 'application/json', 
      'accept': 'application/json',
      'x-request-id': 'req-123'
    };
    const result = sanitizeHeaders(headers);
    expect(result['content-type']).toBe('application/json');
    expect(result['accept']).toBe('application/json');
    expect(result['x-request-id']).toBe('req-123');
  });

  it('should handle array values by joining them', () => {
    const headers = { 'x-custom': ['value1', 'value2'] };
    const result = sanitizeHeaders(headers);
    expect(result['x-custom']).toBe('value1, value2');
  });

  it('should handle undefined values by omitting them', () => {
    const headers = { 'content-type': undefined, 'x-test': 'test' };
    const result = sanitizeHeaders(headers);
    expect(result['content-type']).toBeUndefined();
    expect(result['x-test']).toBe('test');
  });

  it('should convert non-string values to strings', () => {
    const headers = { 'content-length': 123, 'x-count': 0 };
    const result = sanitizeHeaders(headers);
    expect(result['content-length']).toBe('123');
    expect(result['content-count']).toBe('0');
  });
});

describe('auditLogger middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let originalEnd: Function;

  beforeEach(() => {
    mockConsoleLog.mockClear();
    
    mockReq = {
      method: 'GET',
      path: '/api/test',
      headers: {
        'user-agent': 'Mozilla/5.0 Test Browser',
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      },
      socket: {
        remoteAddress: '127.0.0.1'
      } as any
    };

    mockRes = {
      statusCode: 200,
      end: jest.fn()
    };

    mockNext = jest.fn();
    
    // Store original end to restore later
    originalEnd = mockRes.end!.bind(mockRes);
  });

  it('should log request with all required fields', () => {
    auditLogger(mockReq as Request, mockRes as Response, mockNext);

    // Trigger the response end
    (mockRes.end as jest.Mock).mockImplementationOnce(originalEnd);
    (mockRes.end as jest.Function)();

    expect(mockConsoleLog).toHaveBeenCalledTimes(1);
    
    const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]) as AuditLogEntry;
    
    expect(loggedData.timestamp).toBeDefined();
    expect(loggedData.method).toBe('GET');
    expect(loggedData.path).toBe('/api/test');
    expect(loggedData.statusCode).toBe(200);
    expect(loggedData.responseTimeMs).toBeGreaterThanOrEqual(0);
    expect(loggedData.userAgent).toBe('Mozilla/5.0 Test Browser');
  });

  it('should extract IP from x-forwarded-for header', () => {
    auditLogger(mockReq as Request, mockRes as Response, mockNext);
    
    (mockRes.end as jest.Mock).mockImplementationOnce(originalEnd);
    (mockRes.end as jest.Function)();

    const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]) as AuditLogEntry;
    expect(loggedData.ip).toBe('192.168.1.1');
  });

  it('should fall back to socket.remoteAddress when x-forwarded-for is not present', () => {
    mockReq.headers = { 'user-agent': 'Test' };
    
    auditLogger(mockReq as Request, mockRes as Response, mockNext);
    
    (mockRes.end as jest.Mock).mockImplementationOnce(originalEnd);
    (mockRes.end as jest.Function)();

    const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]) as AuditLogEntry;
    expect(loggedData.ip).toBe('127.0.0.1');
  });

  it('should use unknown IP when no IP is available', () => {
    mockReq.headers = {};
    mockReq.socket = undefined;
    
    auditLogger(mockReq as Request, mockRes as Response, mockNext);
    
    (mockRes.end as jest.Mock).mockImplementationOnce(originalEnd);
    (mockRes.end as jest.Function)();

    const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]) as AuditLogEntry;
    expect(loggedData.ip).toBe('unknown');
  });

  it('should capture API key ID from x-api-key-id header', () => {
    mockReq.headers = { 
      'x-api-key-id': 'key-12345',
      'user-agent': 'Test' 
    };
    
    auditLogger(mockReq as Request, mockRes as Response, mockNext);
    
    (mockRes.end as jest.Mock).mockImplementationOnce(originalEnd);
    (mockRes.end as jest.Function)();

    const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]) as AuditLogEntry;
    expect(loggedData.apiKeyId).toBe('key-12345');
  });

  it('should capture API key ID from request object', () => {
    mockReq.headers = { 'user-agent': 'Test' };
    (mockReq as any).apiKeyId = 'key-67890';
    
    auditLogger(mockReq as Request, mockRes as Response, mockNext);
    
    (mockRes.end as jest.Mock).mockImplementationOnce(originalEnd);
    (mockRes.end as jest.Function)();

    const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]) as AuditLogEntry;
    expect(loggedData.apiKeyId).toBe('key-67890');
  });

  it('should set apiKeyId to null when no API key is provided', () => {
    mockReq.headers = { 'user-agent': 'Test' };
    
    auditLogger(mockReq as Request, mockRes as Response, mockNext);
    
    (mockRes.end as jest.Mock).mockImplementationOnce(originalEnd);
    (mockRes.end as jest.Function)();

    const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]) as AuditLogEntry;
    expect(loggedData.apiKeyId).toBeNull();
  });

  it('should log correct HTTP method', () => {
    mockReq.method = 'POST';
    mockReq.path = '/api/create';
    mockReq.headers = { 'user-agent': 'Test' };
    
    auditLogger(mockReq as Request, mockRes as Response, mockNext);
    
    (mockRes.end as jest.Mock).mockImplementationOnce(originalEnd);
    (mockRes.end as jest.Function)();

    const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]) as AuditLogEntry;
    expect(loggedData.method).toBe('POST');
    expect(loggedData.path).toBe('/api/create');
  });

  it('should log correct status code', () => {
    mockReq.headers = { 'user-agent': 'Test' };
    mockRes.statusCode = 404;
    
    auditLogger(mockReq as Request, mockRes as Response, mockNext);
    
    (mockRes.end as jest.Mock).mockImplementationOnce(originalEnd);
    (mockRes.end as jest.Function)();

    const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]) as AuditLogEntry;
    expect(loggedData.statusCode).toBe(404);
  });

  it('should call next() function', () => {
    auditLogger(mockReq as Request, mockRes as Response, mockNext);
    
    (mockRes.end as jest.Mock).mockImplementationOnce(originalEnd);
    (mockRes.end as jest.Function)();

    expect(mockNext).toHaveBeenCalled();
  });

  it('should include user agent in log', () => {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    mockReq.headers = { 'user-agent': userAgent };
    
    auditLogger(mockReq as Request, mockRes as Response, mockNext);
    
    (mockRes.end as jest.Mock).mockImplementationOnce(originalEnd);
    (mockRes.end as jest.Function)();

    const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]) as AuditLogEntry;
    expect(loggedData.userAgent).toBe(userAgent);
  });

  it('should measure response time', () => {
    mockReq.headers = { 'user-agent': 'Test' };
    
    auditLogger(mockReq as Request, mockRes as Response, mockNext);
    
    // Add a small delay before ending the response
    const start = Date.now();
    setTimeout(() => {
      (mockRes.end as jest.Mock).mockImplementationOnce(originalEnd);
      (mockRes.end as jest.Function)();
      
      const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]) as AuditLogEntry;
      expect(loggedData.responseTimeMs).toBeGreaterThanOrEqual(10);
    }, 10);
  });

  it('should log different HTTP methods correctly', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
    
    methods.forEach((method) => {
      mockReq.method = method;
      mockReq.headers = { 'user-agent': 'Test' };
      mockConsoleLog.mockClear();
      
      auditLogger(mockReq as Request, mockRes as Response, mockNext);
      
      (mockRes.end as jest.Mock).mockImplementationOnce(originalEnd);
      (mockRes.end as jest.Function)();

      const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]) as AuditLogEntry;
      expect(loggedData.method).toBe(method);
    });
  });

  it('should log different status codes correctly', () => {
    const statusCodes = [200, 201, 301, 400, 401, 403, 404, 500, 503];
    
    statusCodes.forEach((statusCode) => {
      mockReq.headers = { 'user-agent': 'Test' };
      mockRes.statusCode = statusCode;
      mockConsoleLog.mockClear();
      
      auditLogger(mockReq as Request, mockRes as Response, mockNext);
      
      (mockRes.end as jest.Mock).mockImplementationOnce(originalEnd);
      (mockRes.end as jest.Function)();

      const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]) as AuditLogEntry;
      expect(loggedData.statusCode).toBe(statusCode);
    });
  });

  it('should output valid JSON', () => {
    mockReq.headers = { 'user-agent': 'Test' };
    
    auditLogger(mockReq as Request, mockRes as Response, mockNext);
    
    (mockRes.end as jest.Mock).mockImplementationOnce(originalEnd);
    (mockRes.end as jest.Function)();

    expect(() => {
      JSON.parse(mockConsoleLog.mock.calls[0][0]);
    }).not.toThrow();
  });
});

describe('AuditLogEntry type', () => {
  it('should have correct shape for valid entry', () => {
    const validEntry: AuditLogEntry = {
      timestamp: '2024-01-15T10:30:00.000Z',
      method: 'GET',
      path: '/api/users',
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      apiKeyId: 'key-123',
      statusCode: 200,
      responseTimeMs: 45,
      headers: {
        'content-type': 'application/json'
      }
    };

    expect(validEntry.timestamp).toBeDefined();
    expect(validEntry.method).toBeDefined();
    expect(validEntry.path).toBeDefined();
    expect(validEntry.ip).toBeDefined();
    expect(validEntry.userAgent).toBeDefined();
    expect(validEntry.apiKeyId).toBeDefined();
    expect(validEntry.statusCode).toBeDefined();
    expect(validEntry.responseTimeMs).toBeDefined();
  });

  it('should allow null for apiKeyId', () => {
    const entry: AuditLogEntry = {
      timestamp: '2024-01-15T10:30:00.000Z',
      method: 'GET',
      path: '/api/public',
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      apiKeyId: null,
      statusCode: 200,
      responseTimeMs: 10
    };

    expect(entry.apiKeyId).toBeNull();
  });

  it('should allow optional headers', () => {
    const entry: AuditLogEntry = {
      timestamp: '2024-01-15T10:30:00.000Z',
      method: 'GET',
      path: '/api/test',
      ip: '127.0.0.1',
      userAgent: 'Test',
      apiKeyId: null,
      statusCode: 200,
      responseTimeMs: 5
    };

    expect(entry.headers).toBeUndefined();
  });
});