import {
  Invoice,
  CreateInvoiceParams,
  InvoiceFilter,
  Settlement,
  ApiError,
  WebhookEvent,
} from '../src/types';

describe('Countable SDK Types', () => {
  it('Invoice has required properties', () => {
    const invoice: Invoice = {
      id: 'inv_123',
      amount: 1000,
      currency: 'USD',
      status: 'paid',
      createdAt: '2024-01-01T00:00:00Z',
      paidAt: '2024-01-02T00:00:00Z',
      metadata: { key: 'value' },
    };
    expect(invoice.id).toBe('inv_123');
    expect(invoice.amount).toBe(1000);
    expect(invoice.paidAt).toBeDefined();
  });

  it('CreateInvoiceParams supports optional fields', () => {
    const minimal: CreateInvoiceParams = { amount: 500, currency: 'EUR' };
    const full: CreateInvoiceParams = {
      amount: 500,
      currency: 'EUR',
      description: 'Test',
      metadata: { foo: 'bar' },
    };
    expect(minimal.description).toBeUndefined();
    expect(full.metadata).toEqual({ foo: 'bar' });
  });

  it('InvoiceFilter has optional pagination', () => {
    const filter: InvoiceFilter = { status: 'pending', limit: 10, offset: 0 };
    expect(filter.status).toBe('pending');
    expect(filter.limit).toBe(10);
  });

  it('Settlement has correct structure', () => {
    const settlement: Settlement = {
      id: 'set_456',
      invoiceId: 'inv_123',
      txHash: '0xabc',
      chain: 'ethereum',
      amount: 1000,
      confirmedAt: null,
    };
    expect(settlement.confirmedAt).toBeNull();
  });

  it('ApiError has required error properties', () => {
    const error: ApiError = {
      code: 'INVALID_AMOUNT',
      message: 'Amount must be positive',
      statusCode: 400,
    };
    expect(error.statusCode).toBe(400);
  });

  it('WebhookEvent data is unknown type', () => {
    const event: WebhookEvent = {
      id: 'evt_789',
      type: 'invoice.created',
      data: { invoiceId: 'inv_123' },
      createdAt: '2024-01-01T00:00:00Z',
    };
    expect(event.data).toBeDefined();
  });
});