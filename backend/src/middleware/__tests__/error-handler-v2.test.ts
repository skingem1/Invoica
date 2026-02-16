import { ApiError, errorHandler } from '../error-handler-v2';
import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodIssue } from 'zod';

const mockRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() }) as unknown as Response;

describe('errorHandler', () => {
  const req = {} as Request;
  const next = jest.fn() as NextFunction;

  it('handles ApiError with custom status and code', () => {
    const res = mockRes();
    errorHandler(new ApiError(403, 'Forbidden', 'AUTH_FAILED'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { message: 'Forbidden', code: 'AUTH_FAILED' } });
  });

  it('handles ZodError with 400 and details', () => {
    const res = mockRes();
    const issue: ZodIssue = { code: 'invalid_type', expected: 'string', received: 'number', path: ['name'], message: 'Expected string' };
    errorHandler(new ZodError([issue]), req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('handles unknown errors with 500', () => {
    const res = mockRes();
    errorHandler(new Error('boom'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
  });
});

describe('ApiError', () => {
  it('creates error with statusCode, message, and code', () => {
    const err = new ApiError(404, 'Not found', 'NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Not found');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.name).toBe('ApiError');
    expect(err instanceof Error).toBe(true);
  });
});