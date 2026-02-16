export type SdkEnvironment = 'node' | 'browser' | 'edge' | 'unknown';

/**
 * Detects the current runtime environment
 * @returns The detected environment type
 */
export function detectEnvironment(): SdkEnvironment {
  if (typeof globalThis.process !== 'undefined' && globalThis.process.versions?.node) {
    return 'node';
  }
  if (typeof globalThis.EdgeRuntime === 'string') {
    return 'edge';
  }
  if (typeof globalThis.window !== 'undefined' && typeof globalThis.document !== 'undefined') {
    return 'browser';
  }
  return 'unknown';
}

/**
 * Returns the default API base URL for the SDK
 * @returns The default base URL
 */
export function getDefaultBaseUrl(): string {
  return 'https://api.invoica.ai/v1';
}

/**
 * Generates a User-Agent string based on the current environment
 * @returns The User-Agent string
 */
export function getUserAgent(): string {
  const env = detectEnvironment();
  return `invoica-sdk/1.0.0 (${env})`;
}

/**
 * Checks if the runtime environment supports the Streams API
 * @returns True if ReadableStream is available
 */
export function supportsStreaming(): boolean {
  return typeof ReadableStream !== 'undefined';
}