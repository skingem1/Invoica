// Invoice queue stub — BullMQ integration placeholder
// When Redis is available, this will be replaced with a real BullMQ Queue
import { redis } from '../lib/redis';

interface JobOptions {
  attempts?: number;
  backoff?: { type: string; delay: number };
}

export const invoiceQueue = {
  add: async (name: string, data: unknown, _opts?: JobOptions): Promise<void> => {
    // Enqueue via Redis list; consumers pick up from 'invoice-queue:{name}'
    await redis.set(`invoice-queue:${name}:${Date.now()}`, JSON.stringify(data));
  },
  getWaitingCount: async (): Promise<number> => 0,
  getActiveCount: async (): Promise<number> => 0,
  getCompletedCount: async (): Promise<number> => 0,
  getFailedCount: async (): Promise<number> => 0,
  isPaused: (): boolean => false,
  close: async (): Promise<void> => {},
};
