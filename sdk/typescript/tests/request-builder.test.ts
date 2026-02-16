import { buildUrl, buildHeaders } from '../src/request-builder';

describe('buildUrl', () => {
  it('joins baseUrl and path', () => {
    const url = buildUrl('https://api.invoica.ai/v1', '/invoices');
    expect(url).toBe('https://api.invoica.ai/v1/invoices');
  });

  it('appends query params', () => {
    const url = buildUrl('https://api.invoica.ai/v1', '/invoices', { limit: 10, offset: 0 });
    expect(url).toContain('limit=10');
    expect(url).toContain('offset=0');
  });

  it('skips undefined query params', () => {
    const url = buildUrl('https://api.invoica.ai/v1', '/invoices', { limit: 10, status: undefined });
    expect(url).toContain('limit=10');
    expect(url).not.toContain('status');
  });
});

describe('buildHeaders', () => {
  it('includes Authorization and Content-Type', () => {
    const headers = buildHeaders('test-key');
    expect(headers['Authorization']).toBe('Bearer test-key');
    expect(headers['Content-Type']).toBe('application/json');
  });
});