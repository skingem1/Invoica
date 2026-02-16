import { apiVersionMiddleware, getApiVersion, ApiVersionRequest } from '../api-version';
import { Request, Response, NextFunction } from 'express';

const mockReqRes = (headers: Record<string, string> = {}) => {
  const req = { get: (h: string) => headers[h], headers } as unknown as Request;
  const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
  const next = jest.fn() as NextFunction;
  return { req, res, next };
};

describe('apiVersionMiddleware', () => {
  const middleware = apiVersionMiddleware(['v1', 'v2']);

  it('defaults to latest version when no header provided', () => {
    const { req, res, next } = mockReqRes();
    middleware(req, res, next);
    expect((req as ApiVersionRequest).apiVersion).toBe('v2');
    expect(res.setHeader).toHaveBeenCalledWith('X-API-Version', 'v2');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('accepts supported version from header', () => {
    const { req, res, next } = mockReqRes({ 'X-API-Version': 'v1' });
    middleware(req, res, next);
    expect((req as ApiVersionRequest).apiVersion).toBe('v1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported version with 400', () => {
    const { req, res, next } = mockReqRes({ 'X-API-Version': 'v99' });
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 'UNSUPPORTED_VERSION' }) }));
    expect(next).not.toHaveBeenCalled();
  });
});

describe('getApiVersion', () => {
  it('returns v1 as default for plain request', () => {
    const req = {} as Request;
    expect(getApiVersion(req)).toBe('v1');
  });
});