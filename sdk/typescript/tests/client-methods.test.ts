import { InvoicaClient } from '../src/client';

global.fetch = jest.fn();

describe('InvoicaClient API Key & Webhook Methods', () => {
  let client: InvoicaClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new InvoicaClient({ apiKey: 'test-key', baseUrl: 'https://api.test.com' });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  it('createApiKey calls POST /api-keys with name in body', async () => {
    await client.createApiKey({ name: 'test-key' });
    expect(global.fetch).toHaveBeenCalledWith('https://api.test.com/api-keys', expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'test-key' }) }));
  });

  it('revokeApiKey calls DELETE /api-keys/{id}', async () => {
    await client.revokeApiKey('key-123');
    expect(global.fetch).toHaveBeenCalledWith('https://api.test.com/api-keys/key-123', expect.objectContaining({ method: 'DELETE' }));
  });

  it('listApiKeys calls GET /api-keys', async () => {
    await client.listApiKeys();
    expect(global.fetch).toHaveBeenCalledWith('https://api.test.com/api-keys', expect.objectContaining({ method: 'GET' }));
  });

  it('registerWebhook calls POST /webhooks with config body', async () => {
    await client.registerWebhook({ url: 'https://example.com', events: ['invoice.created'] });
    expect(global.fetch).toHaveBeenCalledWith('https://api.test.com/webhooks', expect.objectContaining({ method: 'POST', body: JSON.stringify({ url: 'https://example.com', events: ['invoice.created'] }) }));
  });

  it('listWebhooks calls GET /webhooks', async () => {
    await client.listWebhooks();
    expect(global.fetch).toHaveBeenCalledWith('https://api.test.com/webhooks', expect.objectContaining({ method: 'GET' }));
  });

  it('deleteWebhook calls DELETE /webhooks/{id}', async () => {
    await client.deleteWebhook('wh-123');
    expect(global.fetch).toHaveBeenCalledWith('https://api.test.com/webhooks/wh-123', expect.objectContaining({ method: 'DELETE' }));
  });
});