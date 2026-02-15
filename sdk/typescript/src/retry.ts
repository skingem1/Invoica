/**
 * Retry utility for Countable TypeScript SDK
 * Provides configurable retry logic with exponential backoff for resilient API calls
 */

export interface RetryOptions {
  /**
   * Maximum number of retry attempts (default: 3)
   */
  maxRetries?: number;
  /**
   * Initial delay in milliseconds before first retry (default: 200)
   */
  initialDelayMs?: number;
  /**
   * Maximum delay in milliseconds between retries (default: 5000)
   */
  maxDelayMs?: number;
  /**
   * HTTP status codes that should trigger a retry (default: [408, 429, 500, 502, 503, 504])
   */
  retryableStatuses?: number[];
}

interface ErrorWithStatus extends Error {
  status?: number;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 200;
const DEFAULT_MAX_DELAY_MS = 5000;
const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];
const JITTER_MAX_MS = 50;

/**
 * Executes an async function with configurable retry logic and exponential backoff
 * 
 * @param fn - The async function to execute
 * @param options - Configuration options for retry behavior
 * @returns Promise resolving to the result of the function
 * @throws Throws the last error after all retries are exhausted
 * 
 * @example
 * ```typescript
 * const result = await retryWithBackoff(() => api.fetchData(), {
 *   maxRetries: 5,
 *   initialDelayMs: 100,
 *   maxDelayMs: 10000
 * });
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const initialDelayMs = options?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const maxDelayMs = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const retryableStatuses = options?.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      const errorWithStatus = error as ErrorWithStatus;
      const hasRetryableStatus =
        errorWithStatus.status !== undefined &&
        retryableStatuses.includes(errorWithStatus.status);

      const shouldRetry = attempt < maxRetries && hasRetryableStatus;

      if (!shouldRetry) {
        throw lastError;
      }

      // Exponential backoff: min(initialDelayMs * 2^attempt, maxDelayMs)
      const exponentialDelay = initialDelayMs * Math.pow(2, attempt);
      const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

      // Add random jitter (0-50ms)
      const jitter = Math.floor(Math.random() * JITTER_MAX_MS);
      const totalDelay = cappedDelay + jitter;

      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    }
  }

  // This should never be reached since we throw inside the loop,
  // but TypeScript needs this for type safety
  throw lastError ?? new Error('Retry failed with no error recorded');
}