jest.mock('../../db/client', () => ({
  prisma: {
    invoice: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  },
}));

import { InvoiceStatus } from '@prisma/client';
import {
  isValidStatusTransition,
  CreateInvoiceInputSchema,
  UpdatePaymentDetailsInputSchema,
  InvoiceNotFoundError,
  InvalidStatusTransitionError,
} from '../invoice';

describe('isValidStatusTransition()', () => {
  it('allows PENDING → SETTLED', () => {
    expect(isValidStatusTransition(InvoiceStatus.PENDING, InvoiceStatus.SETTLED)).toBe(true);
  });

  it('allows SETTLED → PROCESSING', () => {
    expect(isValidStatusTransition(InvoiceStatus.SETTLED, InvoiceStatus.PROCESSING)).toBe(true);
  });

  it('allows PROCESSING → COMPLETED', () => {
    expect(isValidStatusTransition(InvoiceStatus.PROCESSING, InvoiceStatus.COMPLETED)).toBe(true);
  });

  it('rejects COMPLETED → any status', () => {
    expect(isValidStatusTransition(InvoiceStatus.COMPLETED, InvoiceStatus.PENDING)).toBe(false);
    expect(isValidStatusTransition(InvoiceStatus.COMPLETED, InvoiceStatus.SETTLED)).toBe(false);
  });

  it('rejects PENDING → PROCESSING (skipping SETTLED)', () => {
    expect(isValidStatusTransition(InvoiceStatus.PENDING, InvoiceStatus.PROCESSING)).toBe(false);
  });

  it('rejects PENDING → COMPLETED (skipping two steps)', () => {
    expect(isValidStatusTransition(InvoiceStatus.PENDING, InvoiceStatus.COMPLETED)).toBe(false);
  });

  it('rejects SETTLED → COMPLETED (skipping PROCESSING)', () => {
    expect(isValidStatusTransition(InvoiceStatus.SETTLED, InvoiceStatus.COMPLETED)).toBe(false);
  });
});

describe('InvoiceNotFoundError', () => {
  it('sets correct message, code, and invoiceId', () => {
    const err = new InvoiceNotFoundError('inv-123');
    expect(err.message).toContain('inv-123');
    expect(err.code).toBe('INVOICE_NOT_FOUND');
    expect(err.invoiceId).toBe('inv-123');
    expect(err.name).toBe('InvoiceNotFoundError');
  });

  it('accepts custom message', () => {
    const err = new InvoiceNotFoundError('inv-abc', 'Custom not found');
    expect(err.message).toBe('Custom not found');
  });
});

describe('InvalidStatusTransitionError', () => {
  it('sets correct message, code, and status fields', () => {
    const err = new InvalidStatusTransitionError(InvoiceStatus.COMPLETED, InvoiceStatus.PENDING);
    expect(err.message).toContain('COMPLETED');
    expect(err.message).toContain('PENDING');
    expect(err.code).toBe('INVALID_STATUS_TRANSITION');
    expect(err.currentStatus).toBe(InvoiceStatus.COMPLETED);
    expect(err.targetStatus).toBe(InvoiceStatus.PENDING);
    expect(err.name).toBe('InvalidStatusTransitionError');
  });
});

describe('CreateInvoiceInputSchema', () => {
  const validInput = {
    amount: 10000,
    currency: 'USD',
    customerEmail: 'test@example.com',
    customerName: 'Test Customer',
  };

  it('accepts valid input', () => {
    expect(() => CreateInvoiceInputSchema.parse(validInput)).not.toThrow();
  });

  it('defaults currency to USD if not provided', () => {
    const { currency: _, ...withoutCurrency } = validInput;
    const result = CreateInvoiceInputSchema.parse(withoutCurrency);
    expect(result.currency).toBe('USD');
  });

  it('rejects negative amount', () => {
    expect(() => CreateInvoiceInputSchema.parse({ ...validInput, amount: -1 })).toThrow();
  });

  it('rejects zero amount', () => {
    expect(() => CreateInvoiceInputSchema.parse({ ...validInput, amount: 0 })).toThrow();
  });

  it('rejects invalid email', () => {
    expect(() => CreateInvoiceInputSchema.parse({ ...validInput, customerEmail: 'not-an-email' })).toThrow();
  });

  it('rejects missing customerName', () => {
    const { customerName: _, ...withoutName } = validInput;
    expect(() => CreateInvoiceInputSchema.parse(withoutName)).toThrow();
  });
});

describe('UpdatePaymentDetailsInputSchema', () => {
  it('accepts valid paymentDetails object', () => {
    expect(() => UpdatePaymentDetailsInputSchema.parse({
      paymentDetails: { txHash: '0xabc', chain: 'ETH' },
    })).not.toThrow();
  });

  it('rejects missing paymentDetails field', () => {
    expect(() => UpdatePaymentDetailsInputSchema.parse({})).toThrow();
  });
});
