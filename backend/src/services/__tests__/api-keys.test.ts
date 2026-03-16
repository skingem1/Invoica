// Mock Supabase dependencies before importing api-keys to prevent auto-wiring
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

jest.mock('../api-key-repo-supabase', () => ({
  SupabaseApiKeyRepository: jest.fn().mockImplementation(() => ({})),
}));

import {
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  getKeyPrefix,
  validateApiKeyFormat,
} from '../api-keys';

const API_KEY_PREFIX = 'sk_';
const API_KEY_HEX_LENGTH = 64; // 32 bytes * 2 hex chars

describe('generateApiKey', () => {
  it('returns a string with sk_ prefix', () => {
    const key = generateApiKey();
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
  });

  it('returns a key of correct total length (sk_ + 64 hex chars)', () => {
    const key = generateApiKey();
    expect(key.length).toBe(API_KEY_PREFIX.length + API_KEY_HEX_LENGTH);
  });

  it('generates different values on each call (randomness)', () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1).not.toBe(key2);
  });

  it('hex portion contains only valid hex characters [a-f0-9]', () => {
    const key = generateApiKey();
    const hexPart = key.slice(API_KEY_PREFIX.length);
    expect(/^[a-f0-9]+$/.test(hexPart)).toBe(true);
  });
});

describe('validateApiKeyFormat', () => {
  it('returns true for a freshly generated key', () => {
    const key = generateApiKey();
    expect(validateApiKeyFormat(key)).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(validateApiKeyFormat('')).toBe(false);
  });

  it('returns false for a key that is too short', () => {
    expect(validateApiKeyFormat('sk_abc123')).toBe(false);
  });

  it('returns false for a key missing the sk_ prefix', () => {
    const hexOnly = 'a'.repeat(API_KEY_HEX_LENGTH);
    expect(validateApiKeyFormat(hexOnly)).toBe(false);
  });

  it('returns false for a key with uppercase hex (must be lowercase)', () => {
    const badKey = 'sk_' + 'A'.repeat(API_KEY_HEX_LENGTH);
    expect(validateApiKeyFormat(badKey)).toBe(false);
  });
});

describe('getKeyPrefix', () => {
  it('returns exactly 8 characters after the sk_ prefix', () => {
    const key = generateApiKey();
    const prefix = getKeyPrefix(key);
    expect(prefix).toHaveLength(8);
  });

  it('returns the correct slice of the key', () => {
    const key = 'sk_abcdef01234567890123456789012345678901234567890123456789012345';
    const prefix = getKeyPrefix(key);
    expect(prefix).toBe('abcdef01');
  });

  it('prefix is a substring of the original key hex portion', () => {
    const key = generateApiKey();
    const hexPart = key.slice(API_KEY_PREFIX.length);
    expect(hexPart.startsWith(getKeyPrefix(key))).toBe(true);
  });
});

describe('hashApiKey + verifyApiKey', () => {
  it('hash is different from the original key', async () => {
    const key = generateApiKey();
    const hash = await hashApiKey(key);
    expect(hash).not.toBe(key);
  }, 10000);

  it('verifyApiKey returns true for correct key + its hash', async () => {
    const key = generateApiKey();
    const hash = await hashApiKey(key);
    const result = await verifyApiKey(key, hash);
    expect(result).toBe(true);
  }, 10000);

  it('verifyApiKey returns false for wrong key against a hash', async () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    const hash1 = await hashApiKey(key1);
    const result = await verifyApiKey(key2, hash1);
    expect(result).toBe(false);
  }, 10000);
});
