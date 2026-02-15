import { Request, Response } from 'express';
import { getSettlement } from '../../src/api/settlements';

describe('getSettlement', () => {
  let mockRes: Partial<Response>;
  let jsonFn: jest.Mock;
  let statusFn: jest.Mock;

  beforeEach(() => {
    jsonFn = jest.fn();
    statusFn = jest.fn().mockReturnValue({ json: jsonFn });
    mockRes = { status: statusFn, json: jsonFn } as Partial<Response>;
  });

  it('returns 200 with settlement for valid invoiceId', async () => {
    const mockReq = { params: { invoiceId: 'INV-123' } } as unknown as Request;
    await getSettlement(mockReq, mockRes as Response);
    expect(statusFn).toHaveBeenCalledWith(200);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: 'INV-123', status: 'pending', txHash: null })
    );
  });

  it('returns 400 for missing invoiceId', async () => {
    const mockReq = { params: {} } as unknown as Request;
    await getSettlement(mockReq, mockRes as Response);
    expect(statusFn).toHaveBeenCalledWith(400);
    expect(jsonFn).toHaveBeenCalledWith({ error: expect.any(String) });
  });

  it('returns 400 for empty invoiceId', async () => {
    const mockReq = { params: { invoiceId: '' } } as unknown as Request;
    await getSettlement(mockReq, mockRes as Response);
    expect(statusFn).toHaveBeenCalledWith(400);
  });
});