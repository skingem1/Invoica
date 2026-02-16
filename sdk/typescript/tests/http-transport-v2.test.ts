import { HttpTransport } from '../src/http-transport-v2';

describe('HttpTransport', () => {
  it('creates instance with base URL', () => {
    const transport = new HttpTransport({ baseUrl: 'https://api.test.com' });
    expect(transport).toBeDefined();
    expect(transport).toBeInstanceOf(HttpTransport);
  });

  it('creates instance with default options', () => {
    const transport = new HttpTransport({ baseUrl: 'https://api.test.com' });
    expect(transport).toBeDefined();
  });

  it('creates instance with custom timeout', () => {
    const transport = new HttpTransport({ baseUrl: 'https://api.test.com', timeout: 5000 });
    expect(transport).toBeDefined();
  });

  it('creates instance with custom headers', () => {
    const transport = new HttpTransport({
      baseUrl: 'https://api.test.com',
      headers: { 'X-Custom': 'value' },
    });
    expect(transport).toBeDefined();
  });

  it('is a class with request method', () => {
    const transport = new HttpTransport({ baseUrl: 'https://api.test.com' });
    expect(typeof transport.request).toBe('function');
  });
});