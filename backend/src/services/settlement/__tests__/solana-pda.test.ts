import { findAssociatedTokenAddress, PublicKey } from '../solana-pda';

// ---------------------------------------------------------------------------
// findAssociatedTokenAddress
// ---------------------------------------------------------------------------

describe('findAssociatedTokenAddress', () => {
  it('throws with a message about RPC method', () => {
    expect(() => findAssociatedTokenAddress('wallet', 'mint')).toThrow(
      'Use getTokenAccountsByOwner RPC method'
    );
  });
});

// ---------------------------------------------------------------------------
// PublicKey.fromBase58
// ---------------------------------------------------------------------------

describe('PublicKey.fromBase58', () => {
  const VALID_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // 44 chars

  it('creates PublicKey from valid 44-char base58 address', () => {
    const pk = PublicKey.fromBase58(VALID_ADDRESS);
    expect(pk).toBeInstanceOf(PublicKey);
  });

  it('throws for empty string', () => {
    expect(() => PublicKey.fromBase58('')).toThrow('Invalid public key length');
  });

  it('throws for address shorter than 32 chars', () => {
    expect(() => PublicKey.fromBase58('short')).toThrow('Invalid public key length');
  });

  it('throws for address longer than 44 chars', () => {
    const tooLong = 'A'.repeat(45);
    expect(() => PublicKey.fromBase58(tooLong)).toThrow('Invalid public key length');
  });

  it('accepts 32-char address (minimum length)', () => {
    const minLength = 'A'.repeat(32);
    const pk = PublicKey.fromBase58(minLength);
    expect(pk.toBase58()).toBe(minLength);
  });
});

// ---------------------------------------------------------------------------
// PublicKey.toBase58
// ---------------------------------------------------------------------------

describe('PublicKey.toBase58', () => {
  it('returns the original address', () => {
    const address = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const pk = PublicKey.fromBase58(address);
    expect(pk.toBase58()).toBe(address);
  });
});

// ---------------------------------------------------------------------------
// PublicKey.toBytes
// ---------------------------------------------------------------------------

describe('PublicKey.toBytes', () => {
  it('returns Uint8Array of length 32', () => {
    const pk = PublicKey.fromBase58('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    const bytes = pk.toBytes();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(32);
  });
});

// ---------------------------------------------------------------------------
// PublicKey.findProgramAddress
// ---------------------------------------------------------------------------

describe('PublicKey.findProgramAddress', () => {
  it('throws indicating PDA derivation requires implementation', async () => {
    await expect(
      PublicKey.findProgramAddress([], 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    ).rejects.toThrow('PDA derivation requires implementation');
  });
});
