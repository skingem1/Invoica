import { Request, Response, NextFunction } from 'express';
import * as ed from '@noble/ed25519';

/**
 * Solana x402 Payment Verification Middleware
 * Implements HTTP 402 Payment Required with ed25519 signatures for Solana USDC payments.
 * Reusable by Kognai Phase 2.
 */

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SELLER_SOL_WALLET = process.env.X402_SOLANA_SELLER_WALLET || '';
const PRICE_USDC_ATOMIC = BigInt(process.env.X402_SOLANA_PRICE_ATOMIC || '1000');

if (!SELLER_SOL_WALLET) {
  console.error('[x402-solana] WARNING: X402_SOLANA_SELLER_WALLET not set — all Solana payment verifications will fail');
}

const usedNonces = new Set<string>();

// --- Base58 decoder (no external dependency) ---

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_MAP = new Uint8Array(128).fill(255);
for (let i = 0; i < BASE58_ALPHABET.length; i++) {
  BASE58_MAP[BASE58_ALPHABET.charCodeAt(i)] = i;
}

function base58Decode(input: string): Uint8Array {
  if (input.length === 0) return new Uint8Array(0);
  // Count leading '1's (= leading zero bytes)
  let leadingZeros = 0;
  for (const c of input) {
    if (c !== '1') break;
    leadingZeros++;
  }
  // Decode using BigInt arithmetic
  let num = 0n;
  for (const char of input) {
    const val = BASE58_MAP[char.charCodeAt(0)];
    if (val === 255) throw new Error(`Invalid base58 character: ${char}`);
    num = num * 58n + BigInt(val);
  }
  // Convert to bytes
  const hex = num === 0n ? '' : num.toString(16);
  const hexPadded = hex.length % 2 ? '0' + hex : hex;
  const bytes: number[] = [];
  for (let i = 0; i < hexPadded.length; i += 2) {
    bytes.push(parseInt(hexPadded.substring(i, i + 2), 16));
  }
  // Prepend leading zero bytes
  const result = new Uint8Array(leadingZeros + bytes.length);
  result.set(bytes, leadingZeros);
  return result;
}

// --- Types ---

interface SolanaAuthorization {
  from: string;
  to: string;
  tokenMint: string;
  amount: string;
  nonce: string;
  validBefore: number;
}

interface SolanaPaymentPayload {
  authorization: SolanaAuthorization;
  signature: string;
}

export interface SolanaX402Payment {
  from: string;
  amount: bigint;
  nonce: string;
}

// --- Public API ---

/** Returns the 402 response body for Solana USDC payments */
export function get402SolanaResponse() {
  return {
    x402Version: 1,
    scheme: 'exact',
    network: 'solana',
    payment: {
      recipient: SELLER_SOL_WALLET,
      tokenMint: USDC_MINT,
      amount: PRICE_USDC_ATOMIC.toString(),
    },
  };
}

/** Express middleware: verifies Solana x402 payment header */
export async function requireX402SolanaPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers['x-payment'] as string | undefined;
  if (!header) {
    res.status(402).json(get402SolanaResponse());
    return;
  }

  let payload: SolanaPaymentPayload;
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    payload = parsed.payload ?? parsed;
  } catch {
    res.status(402).json({ error: 'Invalid X-Payment header: must be base64-encoded JSON' });
    return;
  }

  const { authorization, signature } = payload;
  if (!authorization || !signature) {
    res.status(402).json({ error: 'Missing authorization or signature in payment payload' });
    return;
  }

  // Validate recipient
  if (authorization.to !== SELLER_SOL_WALLET) {
    res.status(402).json({ error: `Payment must be to ${SELLER_SOL_WALLET}` });
    return;
  }

  // Validate token mint
  if (authorization.tokenMint !== USDC_MINT) {
    res.status(402).json({ error: `Only USDC payments accepted (mint: ${USDC_MINT})` });
    return;
  }

  // Validate amount
  if (BigInt(authorization.amount) < PRICE_USDC_ATOMIC) {
    res.status(402).json({ error: `Insufficient payment. Required: ${PRICE_USDC_ATOMIC.toString()} atomic USDC` });
    return;
  }

  // Validate expiry
  if (authorization.validBefore <= Math.floor(Date.now() / 1000)) {
    res.status(402).json({ error: 'Payment authorization has expired' });
    return;
  }

  // Check nonce replay
  if (usedNonces.has(authorization.nonce)) {
    res.status(402).json({ error: 'Nonce already used (replay detected)' });
    return;
  }

  // Verify ed25519 signature
  try {
    const sortedKeys = Object.keys(authorization).sort();
    const canonical: Record<string, unknown> = {};
    for (const k of sortedKeys) canonical[k] = (authorization as unknown as Record<string, unknown>)[k];
    const message = new TextEncoder().encode(JSON.stringify(canonical));
    const pubkey = base58Decode(authorization.from);
    const sig = Buffer.from(signature, 'base64');

    if (pubkey.length !== 32) {
      res.status(402).json({ error: 'Invalid sender public key (must be 32 bytes)' });
      return;
    }

    const valid = await ed.verifyAsync(new Uint8Array(sig), message, pubkey);
    if (!valid) {
      res.status(402).json({ error: 'Invalid ed25519 signature' });
      return;
    }
  } catch (err) {
    res.status(402).json({ error: `Signature verification failed: ${(err as Error).message}` });
    return;
  }

  // Payment verified — record nonce and continue
  usedNonces.add(authorization.nonce);

  // Attach payment info to request
  (req as any).x402SolanaPayment = {
    from: authorization.from,
    amount: BigInt(authorization.amount),
    nonce: authorization.nonce,
  } satisfies SolanaX402Payment;

  next();
}

// Export base58Decode for testing
export { base58Decode };
