import { successResponse, errorResponse, paginatedResponse } from '../response-helpers';

describe('response-helpers', () => {
  it('successResponse wraps data with success:true', () => {
    const result = successResponse({ foo: 'bar' });
    expect(result).toEqual({ success: true, data: { foo: 'bar' } });
  });

  it('successResponse includes meta when provided', () => {
    const result = successResponse({ id: 1 }, { page: 1 });
    expect(result).toEqual({ success: true, data: { id: 1 }, meta: { page: 1 } });
  });

  it('errorResponse returns success:false with message and code', () => {
    const result = errorResponse('Not found', 'NOT_FOUND', 404);
    expect(result).toEqual({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
  });

  it('errorResponse omits details key when undefined', () => {
    const result = errorResponse('Error', 'ERR', 500);
    expect(result.error).not.toHaveProperty('details');
  });

  it('paginatedResponse computes hasMore correctly', () => {
    const result = paginatedResponse([1, 2], 10, 5, 0);
    expect(result.meta.hasMore).toBe(true);
  });
});