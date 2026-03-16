import {
  extractInvoiceHeaders,
  tryExtractInvoiceHeaders,
  hasInvoiceHeaders,
  getSupportedHeaders,
} from '../headers';

const ALL_HEADERS = {
  'x-invoice-company-name': 'Acme Corp',
  'x-invoice-vat-number': 'GB123456789',
  'x-invoice-address': '123 Main St',
  'x-invoice-email': 'billing@acme.com',
  'x-invoice-purchase-order': 'PO-2024-001',
};

describe('extractInvoiceHeaders', () => {
  it('extracts all 5 fields when all headers present', () => {
    const result = extractInvoiceHeaders(ALL_HEADERS);
    expect(result.companyName).toBe('Acme Corp');
    expect(result.vatNumber).toBe('GB123456789');
    expect(result.address).toBe('123 Main St');
    expect(result.email).toBe('billing@acme.com');
    expect(result.purchaseOrder).toBe('PO-2024-001');
  });

  it('takes first element when header value is an array', () => {
    const result = extractInvoiceHeaders({
      'x-invoice-email': ['first@acme.com', 'second@acme.com'],
    });
    expect(result.email).toBe('first@acme.com');
  });

  it('ignores non-invoice headers and returns only matched fields', () => {
    const result = extractInvoiceHeaders({
      'content-type': 'application/json',
      'authorization': 'Bearer token',
      'x-invoice-company-name': 'TestCo',
    });
    expect(result.companyName).toBe('TestCo');
    expect((result as any)['content-type']).toBeUndefined();
    expect((result as any)['authorization']).toBeUndefined();
  });

  it('returns empty object when no invoice headers present', () => {
    const result = extractInvoiceHeaders({ 'content-type': 'application/json' });
    expect(result).toEqual({});
  });

  it('throws on invalid email format', () => {
    expect(() =>
      extractInvoiceHeaders({ 'x-invoice-email': 'not-an-email' })
    ).toThrow();
  });
});

describe('tryExtractInvoiceHeaders', () => {
  it('returns success: true with data for valid headers', () => {
    const result = tryExtractInvoiceHeaders({ 'x-invoice-company-name': 'Acme' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.companyName).toBe('Acme');
    }
  });

  it('returns success: false with error string for invalid email', () => {
    const result = tryExtractInvoiceHeaders({ 'x-invoice-email': 'bad-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it('returns success: false with fallback message for non-Zod error', () => {
    // Trigger a non-Zod error by passing an object whose property access throws
    const badHeaders = new Proxy({} as any, {
      get: () => { throw new TypeError('synthetic non-Zod error'); },
    });
    const result = tryExtractInvoiceHeaders(badHeaders);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Failed to extract invoice headers');
    }
  });
});

describe('hasInvoiceHeaders', () => {
  it('returns false when no x-invoice-* headers present', () => {
    expect(hasInvoiceHeaders({ 'content-type': 'application/json', 'authorization': 'Bearer t' })).toBe(false);
  });

  it.each([
    ['x-invoice-company-name', 'Acme'],
    ['x-invoice-vat-number', 'GB123'],
    ['x-invoice-address', '1 Main St'],
    ['x-invoice-email', 'a@b.com'],
    ['x-invoice-purchase-order', 'PO-1'],
  ])('returns true when %s is present', (header, value) => {
    expect(hasInvoiceHeaders({ [header]: value })).toBe(true);
  });
});

describe('getSupportedHeaders', () => {
  it('returns all 5 supported x-invoice-* header names', () => {
    const supported = getSupportedHeaders();
    expect(supported).toHaveLength(5);
    expect(supported).toContain('x-invoice-company-name');
    expect(supported).toContain('x-invoice-vat-number');
    expect(supported).toContain('x-invoice-address');
    expect(supported).toContain('x-invoice-email');
    expect(supported).toContain('x-invoice-purchase-order');
  });
});
