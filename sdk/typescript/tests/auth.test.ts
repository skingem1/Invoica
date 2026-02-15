import { createAuthHeaders, validateApiKey, signRequest, ApiKeyError } from '../src/auth';

describe('auth', () => {
  describe('createAuthHeaders', () => {
    it('returns headers with Bearer token, Request-Id, and Timestamp', () => {
      const headers = createAuthHeaders('inv_1234567890abcdef1234567890abcdef');
      expect(headers.Authorization).toBe('Bearer inv_1234567890abcdef1234567890abcdef');
      expect(headers['X-Request-Id']).toBeDefined();
      expect(headers['X-Timestamp']).toBeDefined();
    });
  });

  describe('validateApiKey', () => {
    it('returns true for valid key format', () => {
      expect(validateApiKey('inv_1234567890abcdef1234567890abcdef')).toBe(true);
    });

    it('returns false for invalid key format', () => {
      expect(validateApiKey('invalid')).toBe(false);
      expect(validateApiKey('inv_')).toBe(false);
      expect(validateApiKey('INV_1234567890abcdef1234567890abcdef')).toBe(false);
    });
  });

  describe('signRequest', () => {
    it('generates HMAC-SHA256 signature', () => {
      const signature = signRequest('secret', 'POST', '/api/invoices', '{}');
      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });

    it('handles missing body as empty string', () => {
      const sig1 = signRequest('secret', 'GET', '/api/test');
      const sig2 = signRequest('secret', 'GET', '/api/test', '');
      expect(sig1).toBe(sig2);
    });
  });

  describe('ApiKeyError', () => {
    it('creates error with correct name and message', () => {
      const error = new ApiKeyError('Invalid key');
      expect(error.name).toBe('ApiKeyError');
      expect(error.message).toBe('Invalid key');
    });
  });
});