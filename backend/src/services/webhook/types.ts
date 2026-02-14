import { z } from 'zod';

export interface WebhookRegistration {
  id: string;
  url: string;
  events: string[];
  secret: string;
  createdAt: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: unknown;
  createdAt: string;
}

export interface DispatchResult {
  success: boolean;
  statusCode: number;
  retryable: boolean;
}

export const registrations = new Map<string, WebhookRegistration>();

const registerSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().min(16).max(256),
});

export function register(url: string, events: string[], secret: string): WebhookRegistration {
  const parsed = registerSchema.parse({ url, events, secret });
  const id = crypto.randomUUID();
  const registration: WebhookRegistration = {
    id,
    url: parsed.url,
    events: parsed.events,
    secret: parsed.secret,
    createdAt: new Date().toISOString(),
  };
  registrations.set(id, registration);
  return registration;
}