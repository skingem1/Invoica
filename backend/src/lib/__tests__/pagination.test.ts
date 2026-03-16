import { paginateSchema, createPaginationResponse } from '../pagination';

describe('paginateSchema', () => {
  it('defaults page to 1 and limit to 20', () => {
    const result = paginateSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('coerces string numbers to integers', () => {
    const result = paginateSchema.parse({ page: '3', limit: '50' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it('rejects page < 1', () => {
    expect(() => paginateSchema.parse({ page: 0 })).toThrow();
  });

  it('rejects limit < 1', () => {
    expect(() => paginateSchema.parse({ limit: 0 })).toThrow();
  });

  it('rejects limit > 100', () => {
    expect(() => paginateSchema.parse({ limit: 101 })).toThrow();
  });

  it('accepts limit of exactly 100', () => {
    const result = paginateSchema.parse({ limit: 100 });
    expect(result.limit).toBe(100);
  });
});

describe('createPaginationResponse', () => {
  it('calculates totalPages correctly', () => {
    const result = createPaginationResponse({ page: 1, limit: 10, total: 25 });
    expect(result.totalPages).toBe(3);
  });

  it('calculates totalPages ceiling correctly (exact division)', () => {
    const result = createPaginationResponse({ page: 1, limit: 10, total: 20 });
    expect(result.totalPages).toBe(2);
  });

  it('hasNext is true when page < totalPages', () => {
    const result = createPaginationResponse({ page: 1, limit: 10, total: 25 });
    expect(result.hasNext).toBe(true);
  });

  it('hasNext is false on the last page', () => {
    const result = createPaginationResponse({ page: 3, limit: 10, total: 25 });
    expect(result.hasNext).toBe(false);
  });

  it('hasPrev is false on the first page', () => {
    const result = createPaginationResponse({ page: 1, limit: 10, total: 25 });
    expect(result.hasPrev).toBe(false);
  });

  it('hasPrev is true on page 2+', () => {
    const result = createPaginationResponse({ page: 2, limit: 10, total: 25 });
    expect(result.hasPrev).toBe(true);
  });

  it('returns all 6 expected fields', () => {
    const result = createPaginationResponse({ page: 2, limit: 10, total: 50 });
    expect(result).toMatchObject({ page: 2, limit: 10, total: 50, totalPages: 5, hasNext: true, hasPrev: true });
  });
});
