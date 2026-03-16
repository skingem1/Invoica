// Tests run without REDIS_URL — exercises the "not configured" code path
// (redisClient is null) without needing to mock the redis package.

beforeAll(() => {
  delete process.env.REDIS_URL;
});

// Import after env is cleared so module initializes with null client
// Note: jest module cache means we need to use jest.resetModules() or
// rely on the fact that REDIS_URL was not set when the module first loaded.

describe('redis (not configured)', () => {
  let redis: typeof import('../redis').redis;

  beforeAll(async () => {
    jest.resetModules();
    delete process.env.REDIS_URL;
    const mod = await import('../redis');
    redis = mod.redis;
  });

  it('ping() throws when Redis is not configured', async () => {
    await expect(redis.ping()).rejects.toThrow('Redis not configured');
  });

  it('get() returns null when Redis is not configured', async () => {
    const result = await redis.get('any-key');
    expect(result).toBeNull();
  });

  it('set() resolves without error when Redis is not configured', async () => {
    await expect(redis.set('key', 'value')).resolves.toBeUndefined();
  });

  it('set() with TTL resolves without error when not configured', async () => {
    await expect(redis.set('key', 'value', 60)).resolves.toBeUndefined();
  });

  it('del() resolves without error when Redis is not configured', async () => {
    await expect(redis.del('key')).resolves.toBeUndefined();
  });

  it('publish() resolves without error when Redis is not configured', async () => {
    await expect(redis.publish('channel', 'message')).resolves.toBeUndefined();
  });
});
