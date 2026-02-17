import { describe, it, expect } from '@jest/globals';
import { registerWebhookSchema, webhookQuerySchema, webhookEventSchema } from '../webhook-schemas';

describe('webhook-schemas', () => {
  it('registerWebhookSchema accepts valid input', () => {
    const result = registerWebhookSchema.parse({ url: 'https://example.com/hook', events: ['invoice.created'] });
    expect(result.url).toBe('https://example.com/hook');
    expect(result.events).toEqual(['invoice.created']);
  });

  it('registerWebhookSchema rejects empty events array', () => {
    expect(() => registerWebhookSchema.parse({ url: 'https://a.com', events: [] })).toThrow();
  });

  it('webhookQuerySchema applies defaults', () => {
    const result = webhookQuerySchema.parse({});
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(0);
  });

  it('webhookEventSchema accepts valid event object', () => {
    const result = webhookEventSchema.parse({ id: 'evt_123', type: 'invoice.created', data: { amount: 100 }, timestamp: '2024-01-01T00:00:00Z' });
    expect(result.type).toBe('invoice.created');
  });

  it('registerWebhookSchema rejects invalid URL', () => {
    expect(() => registerWebhookSchema.parse({ url: 'not-a-url', events: ['invoice.created'] })).toThrow();
  });
});