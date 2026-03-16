import { CORRELATION_HEADER, generateCorrelationId, extractCorrelationId, createContext } from '../correlation-id';

describe('correlation-id utilities', () => {
  it('exports CORRELATION_HEADER as x-correlation-id', () => {
    expect(CORRELATION_HEADER).toBe('x-correlation-id');
  });

  it('generates correlation ID matching cid_<base36>_<hex> format', () => {
    const id = generateCorrelationId();
    expect(id).toMatch(/^cid_[a-z0-9]+_[a-z0-9]+$/);
  });

  it('generates unique IDs across 100 iterations', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateCorrelationId());
    expect(ids.size).toBe(100);
  });

  it('extracts correlation ID from headers when present', () => {
    const headers = { [CORRELATION_HEADER]: 'cid_test123_abc123' };
    expect(extractCorrelationId(headers)).toBe('cid_test123_abc123');
  });

  it('generates new ID when header is missing or empty', () => {
    expect(extractCorrelationId({})).toMatch(/^cid_/);
    expect(extractCorrelationId({ [CORRELATION_HEADER]: undefined })).toMatch(/^cid_/);
  });

  it('creates context with correlationId and spanId', () => {
    const ctx = createContext('cid_test_123456');
    expect(ctx.correlationId).toBe('cid_test_123456');
    expect(ctx.parentId).toBeUndefined();
    expect(ctx.spanId).toMatch(/^cid_/);
  });

  it('creates context with parentId when provided', () => {
    const ctx = createContext('cid_test_123456', 'parent_span_abc');
    expect(ctx.parentId).toBe('parent_span_abc');
  });

  it('generates unique spanIds across contexts', () => {
    const spanIds = new Set<string>();
    for (let i = 0; i < 100; i++) spanIds.add(createContext('cid_test').spanId);
    expect(spanIds.size).toBe(100);
  });
});
