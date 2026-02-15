import { Request, Response } from 'express';
import { prisma } from '../db/client';

export async function getSettlement(req: Request, res: Response): Promise<void> {
  const { invoiceId } = req.params;
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });

  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  const status = invoice.status === 'SETTLED' || invoice.status === 'COMPLETED' ? 'confirmed' : 'pending';
  const paymentDetails = invoice.paymentDetails as Record<string, unknown> | null;

  res.json({
    invoiceId: invoice.id,
    status,
    txHash: paymentDetails?.txHash ?? null,
    chain: paymentDetails?.chain ?? 'ethereum',
    confirmedAt: invoice.settledAt?.toISOString() ?? null,
    amount: Number(invoice.amount),
    currency: invoice.currency,
  });
}