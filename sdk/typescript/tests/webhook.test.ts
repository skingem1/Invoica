import { verifyWebhookSignature, parseWebhookEvent } from '../src/webhook';
import { createHmac } from 'crypto';

describe('webhook', () => {
  describe('verifyWebhookSignature', () => {
    it('returns true for valid signature', () => {
      const payload = '{"event":"test"}';
      const secret = 'test-secret';
      const signature = createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
      expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
    });

    it('returns false for invalid signature', () => {
      expect(verifyWebhookSignature('payload', 'invalidsignature', 'secret')).toBe(false);
    });

    it('returns false for mismatched length', () => {
      expect(verifyWebhookSignature('payload', 'abc', 'secret')).toBe(false);
    });
  });

  describe('parseWebhookEvent', () => {
    it('parses valid payload', () => {
      const payload = JSON.stringify({ id: 'evt_1', type: 'payment', data: { amount: 100 }, createdAt: '2024-01-01' });
      const result = parseWebhookEvent(payload);
      expect(result.id).toBe('evt_1');
      expect(result.type).toBe('payment');
      expect(result.data).toEqual({ amount: 100 });
    });

    it('throws on invalid JSON', () => {
      expect(() => parseWebhookEvent('not-json')).toThrow();
    });
  });
});