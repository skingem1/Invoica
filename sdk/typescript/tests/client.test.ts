import { CountableClient, CountableError } from '../src/client';

describe('CountableClient', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('stores apiKey and default baseUrl', () => {
    const client = new CountableClient('test-key');
    expect((client as any).apiKey).toBe('test-key');
    expect((client as any).baseUrl).toBe('https://api.countable.dev');
  });

  it('stores custom baseUrl', () => {
    const client = new CountableClient('key', 'https://custom.api');
    expect((client as any).baseUrl).toBe('https://custom.api');
  });

  it('makes request with correct headers and returns data', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) });
    const client = new CountableClient('key');
    const result = await (client as any).request('GET', '/items');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.countable.dev/items',
      expect.objectContaining({
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer key' }
      })
    );
    expect(result).toEqual({ id: 1 });
  });

  it('throws CountableError on non-2xx response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' });
    const client = new CountableClient('key');
    await expect((client as any).request('GET', '/items')).rejects.toThrow(CountableError);
  });

  it('sends body for POST requests', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const client = new CountableClient('key');
    await (client as any).request('POST', '/items', { name: 'test' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.countable.dev/items',
      expect.objectContaining({ body: JSON.stringify({ name: 'test' }) })
    );
  });
});