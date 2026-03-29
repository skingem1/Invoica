import { Request, Response } from 'express';
import { z } from 'zod';
import { createPendingInvoice } from '../services/invoice';

/**
 * Blacklisted email domains for spam prevention
 */
const SPAM_DOMAINS = [
  'out.ndlz.net',
  'example.com',
  'test.com',
  'fakeinbox.com',
  'mailinator.com',
  'throwaway.email',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'yopmail.com',
] as const;

/** EVM-compatible address format (0x + 40 hex chars) */
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Solana base58 public key format (32–44 chars, no 0/O/I/l) */
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Known Solana program and token constants */
const SOLANA_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/** Supported chains for invoice payment */
const SUPPORTED_CHAINS = ['base', 'polygon', 'arbitrum', 'solana'] as const;
type SupportedChain = typeof SUPPORTED_CHAINS[number];

export const createInvoiceSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(2).max(6),
  customerEmail: z.string().email(),
  customerName: z.string().min(1),
  chain: z.enum(SUPPORTED_CHAINS).optional().default('base'),
  paymentAddress: z.string().optional(),
  programId: z.string().optional(),
  tokenMint: z.string().optional(),
  merchant: z.object({
    email: z.string().email(),
    name: z.string().min(1),
  }).optional(),
  /**
   * Optional tax line for x402 AgentTax compliance.
   * `amount`      — explicit tax amount (used when taxRate is absent)
   * `taxRate`     — decimal rate applied to base amount (0–1); overrides `amount` when present
   * `taxDescription` — human-readable label e.g. "US Sales Tax"
   * `jurisdiction`   — ISO 3166-2 US state code e.g. "CA", "NY" (used by nexus monitor)
   */
  taxLine: z.object({
    amount: z.number().positive(),
    taxRate: z.number().min(0).max(1).optional(),
    taxDescription: z.string().optional(),
    jurisdiction: z.string().length(2).toUpperCase().optional(),
  }).optional(),
});

type CreateInvoiceBody = z.infer<typeof createInvoiceSchema>;

function extractDomainFromEmail(email: string): string | null {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : null;
}

function isSpamDomain(email: string): boolean {
  const domain = extractDomainFromEmail(email);
  if (!domain) return false;
  return (SPAM_DOMAINS as readonly string[]).includes(domain);
}

function logBlockedAttempt(merchantEmail: string, domain: string): void {
  console.log(
    JSON.stringify({
      level: 'warn',
      timestamp: new Date().toISOString(),
      event: 'INVOICE_CREATION_BLOCKED',
      reason: 'SPAM_DOMAIN_DETECTED',
      merchantEmail,
      blockedDomain: domain,
    })
  );
}

export async function createInvoice(req: Request, res: Response): Promise<void> {
  const parseResult = createInvoiceSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid request body', details: parseResult.error.issues });
    return;
  }

  const { amount, currency, customerEmail, customerName, chain, paymentAddress, programId, tokenMint, merchant, taxLine } = parseResult.data;

  // Validate address format when provided (chain-aware)
  if (paymentAddress) {
    const isEvm = chain !== 'solana';
    const valid = isEvm ? EVM_ADDRESS_RE.test(paymentAddress) : SOLANA_ADDRESS_RE.test(paymentAddress);
    if (!valid) {
      res.status(400).json({
        error: 'Invalid payment address',
        message: isEvm
          ? 'Payment address must be a valid EVM address (0x + 40 hex characters)'
          : 'Payment address must be a valid Solana public key (base58, 32–44 characters)',
      });
      return;
    }
  }

  // Solana-specific paymentDetails validation
  if (chain === 'solana') {
    if (programId && programId !== SOLANA_TOKEN_PROGRAM) {
      res.status(400).json({
        error: 'Invalid programId',
        message: `Solana programId must be the SPL Token Program: ${SOLANA_TOKEN_PROGRAM}`,
      });
      return;
    }
    if (tokenMint && tokenMint !== SOLANA_USDC_MINT) {
      res.status(400).json({
        error: 'Invalid tokenMint',
        message: `Only USDC is supported. tokenMint must be: ${SOLANA_USDC_MINT}`,
      });
      return;
    }
    if (programId && !SOLANA_ADDRESS_RE.test(programId)) {
      res.status(400).json({
        error: 'Invalid programId format',
        message: 'programId must be a valid Solana base58 address',
      });
      return;
    }
    if (tokenMint && !SOLANA_ADDRESS_RE.test(tokenMint)) {
      res.status(400).json({
        error: 'Invalid tokenMint format',
        message: 'tokenMint must be a valid Solana base58 address',
      });
      return;
    }
  } else if (programId || tokenMint) {
    res.status(400).json({
      error: 'Invalid parameters',
      message: 'programId and tokenMint are only valid for Solana chain invoices',
    });
    return;
  }

  // Check merchant domain blacklist
  if (merchant?.email) {
    const merchantDomain = extractDomainFromEmail(merchant.email);
    if (merchantDomain && isSpamDomain(merchant.email)) {
      logBlockedAttempt(merchant.email, merchantDomain);
      res.status(403).json({
        error: 'Invoice rejected',
        message: `Cannot create invoice: merchant email domain "${merchantDomain}" is not allowed.`,
      });
      return;
    }
  }

  try {
    const paymentDetails: Record<string, unknown> = { chain };
    if (paymentAddress) paymentDetails.paymentAddress = paymentAddress;
    if (chain === 'solana') {
      paymentDetails.programId = programId || SOLANA_TOKEN_PROGRAM;
      paymentDetails.tokenMint = tokenMint || SOLANA_USDC_MINT;
    }

    // Compute tax and adjust invoice total
    let totalAmount = amount;
    let taxAmount: number | undefined;
    if (taxLine) {
      // Use taxRate to derive amount when provided; fall back to explicit taxLine.amount
      taxAmount = taxLine.taxRate != null
        ? +( amount * taxLine.taxRate ).toFixed(4)
        : taxLine.amount;
      totalAmount = +( amount + taxAmount ).toFixed(4);

      paymentDetails.taxLine = {
        baseAmount: amount,
        taxAmount,
        taxRate: taxLine.taxRate ?? null,
        taxDescription: taxLine.taxDescription ?? null,
        jurisdiction: taxLine.jurisdiction ?? null,
      };
      // Surface jurisdiction at top level for efficient nexus-monitor JSON queries
      if (taxLine.jurisdiction) {
        paymentDetails.jurisdiction = taxLine.jurisdiction;
      }
    }

    const invoice = await createPendingInvoice({
      amount: totalAmount,
      currency,
      customerEmail,
      customerName,
      paymentDetails,
    });

    res.status(201).json({
      id: invoice.id,
      number: 'INV-' + invoice.invoiceNumber,
      amount: Number(invoice.amount),
      baseAmount: amount,
      ...(taxAmount != null && { taxAmount }),
      currency: invoice.currency,
      chain,
      status: invoice.status.toLowerCase(),
      customerEmail: invoice.customerEmail,
      customerName: invoice.customerName,
      createdAt: invoice.createdAt.toISOString(),
      paidAt: null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
