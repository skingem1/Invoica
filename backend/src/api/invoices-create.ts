import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';

/** Creates a new invoice with validated data */
export const createInvoiceSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  description: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

export type CreateInvoiceBody = z.infer<typeof createInvoiceSchema>;

/**
 * POST /v1/invoices - Create a new invoice
 * @param req - Express request with validated body
 * @param res - Express response
 */
export async function createInvoice(req: Request, res: Response): Promise<void> {
  const parseResult = createInvoiceSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.errors });
    return;
  }

  try {
    const { amount, currency, description, metadata } = parseResult.data;
    const id = crypto.randomUUID();
    const number = `INV-${Date.now()}`;
    const createdAt = new Date().toISOString();

    res.status(201).json({
      id,
      number,
      amount,
      currency,
      status: 'pending',
      description: description ?? null,
      metadata: metadata ?? null,
      createdAt,
      paidAt: null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}