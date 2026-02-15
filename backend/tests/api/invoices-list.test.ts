import { Request, Response } from 'express';
import { listInvoices } from '../../src/api/invoices-list';

describe('listInvoices', () => {
  const mockJson = jest.fn();
  const mockStatus = jest.fn().mockReturnValue({ json: mockJson });

  beforeEach(() => jest.clearAllMocks());

  it('returns mock data with default params', async () => {
    const req = { query: {} } as unknown as Request;
    const res = { json: mockJson } as unknown as Response;
    await listInvoices(req, res);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
      invoices: expect.any(Array),
      total: 1,
      limit: 20,
      offset: 0,
    }));
  });

  it('returns 400 for invalid limit', async () => {
    const req = { query: { limit: '0' } } as unknown as Request;
    const res = { status: mockStatus, json: mockJson } as unknown as Response;
    await listInvoices(req, res);
    expect(mockStatus).toHaveBeenCalledWith(400);
  });

  it('respects custom limit and offset', async () => {
    const req = { query: { limit: '50', offset: '10' } } as unknown as Request;
    const res = { json: mockJson } as unknown as Response;
    await listInvoices(req, res);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ limit: 50, offset: 10 }));
  });
});