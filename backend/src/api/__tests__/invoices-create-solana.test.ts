import { createInvoiceSchema } from '../invoices-create';

const validBase = {
  amount: 50,
  currency: 'USDC',
  customerEmail: 'agent@example.org',
  customerName: 'Test Agent',
};

const SOLANA_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

describe('createInvoiceSchema — Solana fields', () => {
  it('accepts Solana chain with valid base58 paymentAddress', () => {
    const result = createInvoiceSchema.safeParse({
      ...validBase,
      chain: 'solana',
      paymentAddress: '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
    });
    expect(result.success).toBe(true);
  });

  it('accepts Solana chain with programId and tokenMint', () => {
    const result = createInvoiceSchema.safeParse({
      ...validBase,
      chain: 'solana',
      paymentAddress: '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
      programId: SOLANA_TOKEN_PROGRAM,
      tokenMint: SOLANA_USDC_MINT,
    });
    expect(result.success).toBe(true);
  });

  it('accepts Solana chain without optional fields', () => {
    const result = createInvoiceSchema.safeParse({
      ...validBase,
      chain: 'solana',
    });
    expect(result.success).toBe(true);
  });

  it('schema accepts programId/tokenMint as strings (handler validates values)', () => {
    const result = createInvoiceSchema.safeParse({
      ...validBase,
      chain: 'solana',
      programId: 'WrongProgram123',
      tokenMint: 'WrongMint456',
    });
    // Schema allows any string — handler validates against known constants
    expect(result.success).toBe(true);
  });

  it('defaults chain to base when not specified', () => {
    const result = createInvoiceSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.chain).toBe('base');
    }
  });

  it('rejects unsupported chain', () => {
    const result = createInvoiceSchema.safeParse({
      ...validBase,
      chain: 'ethereum',
    });
    expect(result.success).toBe(false);
  });
});
