import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../error-handler-v2';

describe('error-handler-v2', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  it('returns 500 for generic Error', () => {
    const err = new Error('Generic error');
    errorHandler(err as any, mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
    });
  });

  it('returns custom statusCode when err is an ApiError', () => {
    const { ApiError } = require('../error-handler-v2');
    const err = new ApiError(400, 'Bad request', 'BAD_REQUEST');
    errorHandler(err as any, mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: { message: 'Bad request', code: 'BAD_REQUEST' },
    });
  });

  it('response has error.message and error.code fields for ApiError', () => {
    const { ApiError } = require('../error-handler-v2');
    const err = new ApiError(404, 'Not found', 'NOT_FOUND');
    errorHandler(err as any, mockReq as Request, mockRes as Response, mockNext);
    const jsonCall = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(jsonCall.error).toHaveProperty('message', 'Not found');
    expect(jsonCall.error).toHaveProperty('code', 'NOT_FOUND');
  });

  it('does not call next() - error handler is terminal', () => {
    const err = new Error('Terminal');
    errorHandler(err as any, mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
  });
});
