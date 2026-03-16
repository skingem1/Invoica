import { Request, Response } from 'express';
import { getInvoiceById } from '../invoices-get';

describe('getInvoiceById', () => {
  let mockRes: Response;

  beforeEach(() => {
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    } as unknown as Response;
    jest.clearAllMocks();
  });

  it('returns 200 with invoice for valid id', async () => {
    const mockReq = { params: { id: 'inv_001' } } as unknown as Request;

    await getInvoiceById(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    const responseBody = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(responseBody).toMatchObject({
      id: 'inv_001',
      number: 'INV-001',
      currency: 'USD',
      status: 'pending',
    });
  });

  it('returns 400 for empty id', async () => {
    const mockReq = { params: { id: '' } } as unknown as Request;

    await getInvoiceById(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid invoice ID' });
  });

  it('returns 400 for undefined id', async () => {
    const mockReq = { params: {} } as unknown as Request;

    await getInvoiceById(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid invoice ID' });
  });
});
