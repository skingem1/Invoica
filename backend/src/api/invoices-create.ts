import { Request, Response } from 'express';
import { z } from 'zod';
import { createPendingInvoice } from '../services/invoice';

export const createInvoiceSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  customerEmail: z.string().email(),
  customerName: z.string().min(1),
});

type CreateInvoiceBody = z.infer<typeof createInvoiceSchema>;

export async function createInvoice(req: Request, res: Response): Promise<void> {
  const parseResult = createInvoiceSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid request body', details: parseResult.error.issues });
    return;
  }

  try {
    const invoice = await createPendingInvoice(parseResult.data);
    res.status(201).json({
      id: invoice.id,
      number: 'INV-' + invoice.invoiceNumber,
      amount: Number(invoice.amount),
      currency: invoice.currency,
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