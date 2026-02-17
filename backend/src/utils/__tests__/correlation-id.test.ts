import { describe, it, expect } from '@jest/globals';
import { CORRELATION_HEADER, generateCorrelationId, extractCorrelationId, createContext } from '../correlation-id';

describe('correlation-id utils', () => {
  it('generateCorrelationId returns string starting with cid_', () => {
    const id = generateCorrelationId();
    expect(id).toMatch(/^cid_/);
  });

  it('extractCorrelationId returns header value when present as string', () => {
    const headers = { [CORRELATION_HEADER]: 'test-cid-123' };
    expect(extractCorrelationId(headers)).toBe('test-cid-123');
  });

  it('extractCorrelationId returns first element when header is array', () => {
    const headers = { [CORRELATION_HEADER]: ['cid-1', 'cid-2'] };
    expect(extractCorrelationId(headers)).toBe('cid-1');
  });

  it('extractCorrelationId generates new ID when header missing', () => {
    const id = extractCorrelationId({});
    expect(id).toMatch(/^cid_/);
  });

  it('createContext returns object with correlationId and spanId starting with cid_', () => {
    const ctx = createContext('test-cid', 'parent-id');
    expect(ctx.correlationId).toBe('test-cid');
    expect(ctx.parentId).toBe('parent-id');
    expect(ctx.spanId).toMatch(/^cid_/);
  });
});