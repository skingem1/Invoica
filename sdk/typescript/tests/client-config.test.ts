import { resolveConfig, InvoicaClientConfig, DEFAULT_BASE_URL, DEFAULT_TIMEOUT, DEFAULT_MAX_RETRIES } from '../src/client-config';

describe('resolveConfig', () => {
  it('resolves with defaults when only apiKey provided', () => {
    const config = resolveConfig({ apiKey: 'test-key' });
    expect(config.apiKey).toBe('test-key');
    expect(config.baseUrl).toBe(DEFAULT_BASE_URL);
    expect(config.timeout).toBe(DEFAULT_TIMEOUT);
    expect(config.maxRetries).toBe(DEFAULT_MAX_RETRIES);
  });

  it('uses custom values when provided', () => {
    const config = resolveConfig({ apiKey: 'key', baseUrl: 'http://localhost', timeout: 5000, maxRetries: 1 });
    expect(config.baseUrl).toBe('http://localhost');
    expect(config.timeout).toBe(5000);
    expect(config.maxRetries).toBe(1);
  });

  it('trims apiKey whitespace', () => {
    const config = resolveConfig({ apiKey: '  my-key  ' });
    expect(config.apiKey).toBe('my-key');
  });

  it('throws on empty apiKey', () => {
    expect(() => resolveConfig({ apiKey: '' })).toThrow('apiKey is required');
  });

  it('throws on whitespace-only apiKey', () => {
    expect(() => resolveConfig({ apiKey: '   ' })).toThrow('apiKey is required');
  });
});