import requestIdMiddleware, { RequestWithId } from '../request-id';
import { Request, Response, NextFunction } from 'express';

const mockReqRes = (headers: Record<string, string> = {}): { req: Request; res: Response; next: NextFunction } => {
  const req = { headers } as unknown as Request;
  const res = { setHeader: jest.fn() } as unknown as Response;
  const next = jest.fn() as NextFunction;
  return { req, res, next };
};

describe('requestIdMiddleware', () => {
  it('generates a request ID when none provided', () => {
    const { req, res, next } = mockReqRes();
    requestIdMiddleware(req, res, next);
    expect((req as RequestWithId).requestId).toMatch(/^req-\d+-[a-z0-9]+$/);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', expect.stringMatching(/^req-\d+-[a-z0-9]+$/));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses existing x-request-id header if present', () => {
    const { req, res, next } = mockReqRes({ 'x-request-id': 'existing-id-123' });
    requestIdMiddleware(req, res, next);
    expect((req as RequestWithId).requestId).toBe('existing-id-123');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'existing-id-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets unique IDs for consecutive requests', () => {
    const { req: req1, res: res1, next: next1 } = mockReqRes();
    const { req: req2, res: res2, next: next2 } = mockReqRes();
    requestIdMiddleware(req1, res1, next1);
    requestIdMiddleware(req2, res2, next2);
    expect((req1 as RequestWithId).requestId).not.toBe((req2 as RequestWithId).requestId);
  });
});