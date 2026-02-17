import { createAuthHeaders, validateApiKey, signRequest, ApiKeyError } from '../src/auth';

describe('auth', () => {
  describe('createAuthHeaders', () => {
    it('returns Authorization with Bearer prefix, valid UUID, ISO timestamp, and 3 keys', () => {
      const headers = createAuthHeaders('test-key');
      expect(headers['Authorization']).toBe('Bearer test-key');
      expect(headers['X-Request-Id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
      expect(headers['X-Timestamp']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(Object.keys(headers)).toHaveLength(3);
    });
  });

  describe('validateApiKey', () => {
    it('returns true for valid inv_ prefixed 32 hex char key', () => {
      expect(validateApiKey('inv_0123456789abcdef0123456789abcdef')).toBe(true);
    });

    it('returns false for missing/wrong prefix, too short, uppercase, empty', () => {
      expect(validateApiKey('0123456789abcdef0123456789abcdef')).toBe(false);
      expect(validateApiKey('key_0123456789abcdef0123456789abcdef')).toBe(false);
      expect(validateApiKey('inv_0123')).toBe(false);
      expect(validateApiKey('inv_0123456789ABCDEF0123456789abcdef')).toBe(false);
      expect(validateApiKey('')).toBe(false);
    });
  });

  describe('signRequest', () => {
    it('returns 64-char hex string (SHA-256)', () => {
      expect(signRequest('key', 'GET', '/path')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('is deterministic for same inputs', () => {
      expect(signRequest('key', 'GET', '/path')).toBe(signRequest('key', 'GET', '/path'));
    });

    it('differs with body vs without body', () => {
      expect(signRequest('key', 'POST', '/path')).not.toBe(signRequest('key', 'POST', '/path', '{"a":1}'));
    });
  });

  describe('ApiKeyError', () => {
    it('has correct name, instanceof Error, and message', () => {
      const err = new ApiKeyError('invalid key');
      expect(err.name).toBe('ApiKeyError');
      expect(err instanceof Error).toBe(true);
      expect(err.message).toBe('invalid key');
    });
  });
});