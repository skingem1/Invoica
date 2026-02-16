import { withTimeout, TimeoutError } from '../src/timeout';

describe('withTimeout', () => {
  it('resolves if promise finishes before timeout', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 1000);
    expect(result).toBe('ok');
  });

  it('throws TimeoutError if promise exceeds timeout', async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 5000));
    await expect(withTimeout(slow, 50)).rejects.toThrow(TimeoutError);
  });

  it('TimeoutError includes timeout duration', () => {
    const err = new TimeoutError(3000);
    expect(err.timeoutMs).toBe(3000);
    expect(err.message).toContain('3000');
  });
});