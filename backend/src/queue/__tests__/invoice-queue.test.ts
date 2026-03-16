const mockSet = jest.fn();

jest.mock('../../lib/redis', () => ({
  redis: { set: (...args: unknown[]) => mockSet(...args) },
}));

import { invoiceQueue } from '../invoice.queue';

describe('invoiceQueue', () => {
  beforeEach(() => {
    mockSet.mockClear();
  });

  describe('add()', () => {
    it('calls redis.set with a key containing the job name', async () => {
      mockSet.mockResolvedValueOnce(undefined);
      await invoiceQueue.add('create', { invoiceId: 'inv-001' });
      const key = mockSet.mock.calls[0][0] as string;
      expect(key).toContain('invoice-queue:create:');
    });

    it('stores a JSON string of the data', async () => {
      mockSet.mockResolvedValueOnce(undefined);
      const data = { invoiceId: 'inv-002', amount: 100 };
      await invoiceQueue.add('settle', data);
      const stored = mockSet.mock.calls[0][1] as string;
      expect(JSON.parse(stored)).toEqual(data);
    });

    it('resolves without error', async () => {
      mockSet.mockResolvedValueOnce(undefined);
      await expect(invoiceQueue.add('create', {})).resolves.toBeUndefined();
    });
  });

  describe('stub methods', () => {
    it('getWaitingCount() returns 0', async () => {
      expect(await invoiceQueue.getWaitingCount()).toBe(0);
    });

    it('getActiveCount() returns 0', async () => {
      expect(await invoiceQueue.getActiveCount()).toBe(0);
    });

    it('getCompletedCount() returns 0', async () => {
      expect(await invoiceQueue.getCompletedCount()).toBe(0);
    });

    it('getFailedCount() returns 0', async () => {
      expect(await invoiceQueue.getFailedCount()).toBe(0);
    });

    it('isPaused() returns false', () => {
      expect(invoiceQueue.isPaused()).toBe(false);
    });

    it('close() resolves without error', async () => {
      await expect(invoiceQueue.close()).resolves.toBeUndefined();
    });
  });
});
