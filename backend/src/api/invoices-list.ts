import { Request, Response } from 'express';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export async function listInvoices(req: Request, res: Response): Promise<void> {
  const result = querySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: 'Invalid query parameters', details: result.error.flatten() });
    return;
  }
  const { limit, offset } = result.data;
  res.json({
    invoices: [{ id: 'inv_001', number: 'INV-001', amount: 100, currency: 'USD', status: 'pending', createdAt: new Date().toISOString() }],
    total: 1,
    limit,
    offset,
  });
}