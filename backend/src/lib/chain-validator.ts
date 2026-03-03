import { getSupportedChains, getChain, ChainConfig } from './chain-registry';

/**
 * Validates that a chain ID is supported. Throws 400 if not.
 * Use this in route handlers instead of the old hardcoded SUPPORTED_CHAINS check.
 */
export function validateChain(chainId: unknown): string {
  if (typeof chainId !== 'string' || !chainId) {
    throw Object.assign(new Error('chain is required'), { status: 400 });
  }
  const supported = getSupportedChains();
  if (!supported.includes(chainId)) {
    throw Object.assign(
      new Error(`Unsupported chain: ${chainId}. Supported: ${supported.join(', ')}`),
      { status: 400 }
    );
  }
  return chainId;
}

export { getSupportedChains, getChain };
export type { ChainConfig };