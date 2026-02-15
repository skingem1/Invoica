import { Request, Response } from 'express';
import { createInvoice, createInvoiceSchema } from '../../src/api/invoices-create';

describe('createInvoice', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockReq = { body: {} };
    mockRes = { status: statusMock, json: jsonMock };
  });

  it('returns 400 for invalid input', async () => {
    mockReq.body = { amount: -10, currency: 'USD' };
    await createInvoice(mockReq as Request, mockRes as Response);
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: 'Validation failed' }));
  });

  it('returns 201 with invoice data on success', async () => {
    mockReq.body = { amount: 100, currency: 'USD', description: 'Test' };
    await createInvoice(mockReq as Request, mockRes as Response);
    expect(statusMock).toHaveBeenCalledWith(201);
    const response = jsonMock.mock.calls[0][0];
    expect(response.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.number).toMatch(/^INV-\d+$/);
    expect(response.status).toBe('pending');
    expect(response.paidAt).toBeNull();
  });

  it('applies defaults for optional fields', async () => {
    mockReq.body = { amount: 50, currency: 'EUR' };
    await createInvoice(mockReq as Request, mockRes as Response);
    const response = jsonMock.mock.calls[0][0];
    expect(response.description).toBeNull();
    expect(response.metadata).toBeNull();
  });

  it('validates metadata as record<string>', async () => {
    mockReq.body = { amount: 100, currency: 'USD', metadata: { key: 'value' } };
    await createInvoice(mockReq as Request, mockRes as Response);
    expect(statusMock).toHaveBeenCalledWith(201);
  });

  describe('createInvoiceSchema', () => {
    it('validates correct input', () => {
      const result = createInvoiceSchema.safeParse({ amount: 100, currency: 'USD' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid currency length', () => {
      const result = createInvoiceSchema.safeParse({ amount: 100, currency: 'USDD' });
      expect(result.success).toBe(false);
    });
  });
});