import { Request, Response } from 'express';
import { prisma } from '../db/client';

/**
 * GET /api/recent-activity - Returns the 10 most recent invoices as activity items
 */
export async function getRecentActivity(req: Request, res: Response): Promise<void> {
  try {
    const invoices = await prisma.invoice.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        amount: true,
        currency: true,
        customerName: true,
        createdAt: true,
        settledAt: true,
      },
    });

    const activity = invoices.map((invoice) => ({
      id: invoice.id,
      type: invoice.status === 'SETTLED' || invoice.status === 'COMPLETED' ? 'payment' : 'invoice',
      title: invoice.status === 'SETTLED' ? 'Payment Received' : `Invoice #INV-${invoice.invoiceNumber}`,
      description: `${invoice.customerName} — ${invoice.currency} ${Number(invoice.amount)}`,
      timestamp: invoice.createdAt.toISOString(),
      status: invoice.status === 'SETTLED' || invoice.status === 'COMPLETED' ? 'success' : invoice.status === 'PENDING' ? 'pending' : 'failed',
    }));

    res.json(activity);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
}