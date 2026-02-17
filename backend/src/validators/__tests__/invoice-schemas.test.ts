import { createInvoiceSchema, updateInvoiceSchema, invoiceQuerySchema } from '../invoice-schemas';

describe('invoice-schemas', () => {
  it('createInvoiceSchema accepts valid input', () => {
    const result = createInvoiceSchema.parse({ amount: 100, currency: 'USD' });
    expect(result.amount).toBe(100);
    expect(result.currency).toBe('USD');
  });

  it('createInvoiceSchema rejects negative amount', () => {
    expect(() => createInvoiceSchema.parse({ amount: -5, currency: 'USD' })).toThrow();
  });

  it('updateInvoiceSchema rejects empty object', () => {
    expect(() => updateInvoiceSchema.parse({})).toThrow();
  });

  it('invoiceQuerySchema coerces string limit', () => {
    const result = invoiceQuerySchema.parse({ limit: '25' });
    expect(result.limit).toBe(25);
  });

  it('invoiceQuerySchema applies defaults', () => {
    const result = invoiceQuerySchema.parse({});
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(0);
  });
});