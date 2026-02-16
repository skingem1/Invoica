import { retryWithBackoff, RetryOptions } from '../src/retry';

describe('retryWithBackoff', () => {
  it('returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable status and succeeds', async () => {
    const error = Object.assign(new Error('fail'), { status: 503 });
    const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValue('recovered');
    const result = await retryWithBackoff(fn, { initialDelayMs: 1, maxDelayMs: 5 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws immediately on non-retryable status', async () => {
    const error = Object.assign(new Error('not found'), { status: 404 });
    const fn = jest.fn().mockRejectedValue(error);
    await expect(retryWithBackoff(fn)).rejects.toThrow('not found');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('exhausts retries and throws last error', async () => {
    const error = Object.assign(new Error('down'), { status: 500 });
    const fn = jest.fn().mockRejectedValue(error);
    await expect(retryWithBackoff(fn, { maxRetries: 2, initialDelayMs: 1, maxDelayMs: 2 })).rejects.toThrow('down');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respects custom retryableStatuses', async () => {
    const error = Object.assign(new Error('custom'), { status: 418 });
    const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, { retryableStatuses: [418] as number[], initialDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});