import { randomUUID, createHmac } from 'crypto';

export function createAuthHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'X-Request-Id': randomUUID(),
    'X-Timestamp': new Date().toISOString(),
  };
}

export function validateApiKey(key: string): boolean {
  return /^inv_[0-9a-f]{32}$/.test(key);
}

export function signRequest(apiKey: string, method: string, path: string, body?: string): string {
  return createHmac('sha256', apiKey)
    .update(`${method}:${path}:${body || ''}`)
    .digest('hex');
}

export class ApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiKeyError';
  }
}