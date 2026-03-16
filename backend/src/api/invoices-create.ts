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
  merchant: z.object({
    email: z.string().email(),
    name: z.string().min(1),
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

  const { amount, currency, customerEmail, customerName, chain, paymentAddress, merchant } = parseResult.data;

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
    const invoice = await createPendingInvoice({
      amount,
      currency,
      customerEmail,
      customerName,
      paymentDetails: {
        chain,
        ...(paymentAddress ? { paymentAddress } : {}),
      },
    });

    res.status(201).json({
      id: invoice.id,
      number: 'INV-' + invoice.invoiceNumber,
      amount: Number(invoice.amount),
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
