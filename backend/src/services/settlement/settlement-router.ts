import { getChain, isEvmChain } from '../../lib/chain-registry';
import { EvmSettlementDetector } from './evm-detector';
import { SolanaSettlementDetector } from './solana-detector';
import { SettlementMatch } from './evm-detector';

/**
 * Check for USDC payment to a recipient on any supported chain.
 * Routes to EVM or Solana detector based on chain config.
 *
 * @param chainId - Chain identifier ('base', 'polygon', 'solana')
 * @param recipientAddress - Address to check for incoming payments
 * @param options - Optional: expectedAmount, fromBlock, limit
 */
export async function checkSettlement(
  chainId: string,
  recipientAddress: string,
  options?: {
    expectedAmountUsdc?: number;
    fromBlock?: number;
    limit?: number;
  }
): Promise<SettlementMatch[]> {
  const chain = getChain(chainId);

  if (isEvmChain(chainId)) {
    const detector = new EvmSettlementDetector(chainId);
    return detector.findSettlements(recipientAddress, options);
  }

  const detector = new SolanaSettlementDetector(chainId);
  return detector.findSettlements(recipientAddress, options);
}

/**
 * Verify a specific transaction is a valid USDC payment.
 *
 * @param chainId - Chain identifier
 * @param txId - Transaction hash (EVM) or signature (Solana)
 * @param recipientAddress - Expected recipient
 * @param expectedAmountUsdc - Expected USDC amount
 */
export async function verifyPayment(
  chainId: string,
  txId: string,
  recipientAddress: string,
  expectedAmountUsdc: number
): Promise<boolean> {
  if (isEvmChain(chainId)) {
    const detector = new EvmSettlementDetector(chainId);
    return detector.verifyTransaction(txId, recipientAddress, expectedAmountUsdc);
  }

  const detector = new SolanaSettlementDetector(chainId);
  return detector.verifyTransaction(txId, recipientAddress, expectedAmountUsdc);
}
