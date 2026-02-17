import { generateApiKey, hashApiKey, isTestKey, API_KEY_PREFIX, TEST_KEY_PREFIX } from '../api-key-generator';

describe('api-key-generator', () => {
  it('generates live key with inv_live_ prefix and 64-char hex hash', () => {
    const { key, hash } = generateApiKey();
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(key.length).toBe(API_KEY_PREFIX.length + 64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generates test key with inv_test_ prefix when isTest=true', () => {
    const { key } = generateApiKey(true);
    expect(key.startsWith(TEST_KEY_PREFIX)).toBe(true);
    expect(key.length).toBe(TEST_KEY_PREFIX.length + 64);
  });

  it('hashApiKey returns consistent hash for same input', () => {
    const hash1 = hashApiKey('test');
    const hash2 = hashApiKey('test');
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hashApiKey throws TypeError for empty string', () => {
    expect(() => hashApiKey('')).toThrow(TypeError);
  });

  it('isTestKey returns true for test keys and false for live keys', () => {
    expect(isTestKey('inv_test_abc123')).toBe(true);
    expect(isTestKey('inv_live_xyz789')).toBe(false);
  });
});