import { corsMiddleware } from '../cors';

describe('cors-middleware', () => {
  const mockRes = () => {
    const res: any = {};
    res.setHeader = jest.fn().mockReturnValue(res);
    res.status = jest.fn().mockReturnValue(res);
    res.end = jest.fn();
    return res;
  };

  it('sets CORS headers on GET request and calls next', () => {
    const req: any = { method: 'GET', headers: { origin: 'http://example.com' } };
    const res = mockRes();
    const next = jest.fn();

    corsMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://example.com');
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-API-Key');
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    expect(next).toHaveBeenCalled();
  });

  it('uses request origin when present', () => {
    const req: any = { method: 'POST', headers: { origin: 'https://app.com' } };
    const res = mockRes();
    const next = jest.fn();

    corsMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://app.com');
  });

  it('defaults origin to * when no origin header', () => {
    const req: any = { method: 'GET', headers: {} };
    const res = mockRes();
    const next = jest.fn();

    corsMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
  });

  it('OPTIONS request returns 204', () => {
    const req: any = { method: 'OPTIONS', headers: { origin: 'http://test.com' } };
    const res = mockRes();
    const next = jest.fn();

    corsMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });

  it('OPTIONS request does NOT call next', () => {
    const req: any = { method: 'OPTIONS', headers: { origin: 'http://test.com' } };
    const res = mockRes();
    const next = jest.fn();

    corsMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });
});