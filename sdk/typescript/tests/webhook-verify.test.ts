import { createHmac } from 'crypto';
import { constructEvent, WebhookVerificationError, WebhookEvent } from '../src/webhook-verify';

describe('constructEvent', () => {
  const secret = 'test-secret';
  const basePayload = JSON.stringify({
    id: 'evt_123',
    type: 'invoice.created',
    data: { amount: 100 },
    timestamp: '2024-01-01T00:00:00Z',
  });
  const signature = createHmac('sha256', secret).update(basePayload).digest('hex');

  it('parses valid webhook payload', () => {
    const event = constructEvent(basePayload, signature, secret) as WebhookEvent;
    expect(event.id).toBe('evt_123');
    expect(event.type).toBe('invoice.created');
  });

  it('throws WebhookVerificationError on invalid signature', () => {
    expect(() => constructEvent(basePayload, 'bad-sig', secret))
      .toThrow(WebhookVerificationError);
  });

  it('throws on tampered payload', () => {
    const tampered = basePayload.replace('100', '999');
    expect(() => constructEvent(tampered, signature, secret))
      .toThrow(WebhookVerificationError);
  });

  it('throws on wrong secret', () => {
    expect(() => constructEvent(basePayload, signature, 'wrong-secret'))
      .toThrow(WebhookVerificationError);
  });
});