import { getSupportedChains, ChainConfig, getChain } from './chain-registry';

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