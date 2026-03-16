import { createInvoiceSchema } from '../invoices-create';

describe('createInvoiceSchema', () => {
  it('accepts valid input', () => {
    const result = createInvoiceSchema.safeParse({
      amount: 100,
      currency: 'USD',
      customerEmail: 'test@test.com',
      customerName: 'John',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-positive amount', () => {
    const zero = createInvoiceSchema.safeParse({ amount: 0, currency: 'USD', customerEmail: 'a@b.com', customerName: 'A' });
    const neg = createInvoiceSchema.safeParse({ amount: -1, currency: 'USD', customerEmail: 'a@b.com', customerName: 'A' });
    const str = createInvoiceSchema.safeParse({ amount: '100', currency: 'USD', customerEmail: 'a@b.com', customerName: 'A' });
    expect(zero.success).toBe(false);
    expect(neg.success).toBe(false);
    expect(str.success).toBe(false);
  });

  it('rejects invalid currency length', () => {
    const tooShort = createInvoiceSchema.safeParse({ amount: 100, currency: 'U', customerEmail: 'a@b.com', customerName: 'A' });
    const tooLong = createInvoiceSchema.safeParse({ amount: 100, currency: 'USDCENT', customerEmail: 'a@b.com', customerName: 'A' });
    expect(tooShort.success).toBe(false);
    expect(tooLong.success).toBe(false);
    // min(2) and max(6) — boundary values should pass
    const min = createInvoiceSchema.safeParse({ amount: 100, currency: 'US', customerEmail: 'a@b.com', customerName: 'A' });
    const max = createInvoiceSchema.safeParse({ amount: 100, currency: 'USDCCC', customerEmail: 'a@b.com', customerName: 'A' });
    expect(min.success).toBe(true);
    expect(max.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = createInvoiceSchema.safeParse({ amount: 100, currency: 'USD', customerEmail: 'notanemail', customerName: 'A' });
    expect(result.success).toBe(false);
  });

  it('rejects empty customerName', () => {
    const result = createInvoiceSchema.safeParse({ amount: 100, currency: 'USD', customerEmail: 'a@b.com', customerName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(createInvoiceSchema.safeParse({}).success).toBe(false);
    expect(createInvoiceSchema.safeParse({ amount: 100 }).success).toBe(false);
  });
});