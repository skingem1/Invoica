import { createApiKeySchema, apiKeyQuerySchema, rotateApiKeySchema } from '../api-key-schemas';

describe('API Key Schemas', () => {
  it('createApiKeySchema accepts valid name and defaults scopes to empty array', () => {
    const result = createApiKeySchema.parse({ name: 'My Key' });
    expect(result.name).toBe('My Key');
    expect(result.scopes).toEqual([]);
  });

  it('createApiKeySchema rejects empty name', () => {
    expect(() => createApiKeySchema.parse({ name: '' })).toThrow();
  });

  it('apiKeyQuerySchema applies defaults for limit and offset', () => {
    const result = apiKeyQuerySchema.parse({});
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(0);
  });

  it('apiKeyQuerySchema rejects limit over 100', () => {
    expect(() => apiKeyQuerySchema.parse({ limit: 101 })).toThrow();
  });

  it('rotateApiKeySchema rejects expiresInDays over 365', () => {
    expect(() => rotateApiKeySchema.parse({ expiresInDays: 366 })).toThrow();
  });
});