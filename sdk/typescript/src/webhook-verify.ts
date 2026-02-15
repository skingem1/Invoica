import { createHmac, timingSafeEqual } from 'crypto';

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}

export interface WebhookEvent {
  id: string;
  type: 'invoice.created' | 'invoice.paid' | 'settlement.completed' | 'settlement.failed' | 'apikey.revoked';
  data: Record<string, unknown>;
  timestamp: string;
  signature: string;
}

export function constructEvent(payload: string, signature: string, secret: string): WebhookEvent {
  const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex');
  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new WebhookVerificationError('Invalid webhook signature');
  }

  return JSON.parse(payload) as WebhookEvent;
}