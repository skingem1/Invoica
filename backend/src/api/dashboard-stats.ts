import { Request, Response } from 'express';
import { prisma } from '../db/client';

export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  try {
    const [total, pending, settled, revenue] = await Promise.all([
      prisma.invoice.count(),
      prisma.invoice.count({ where: { status: 'PENDING' } }),
      prisma.invoice.count({ where: { status: { in: ['SETTLED', 'COMPLETED'] } } }),
      prisma.invoice.aggregate({ where: { status: { in: ['SETTLED', 'COMPLETED'] } }, _sum: { amount: true } })
    ]);
    res.json({ totalInvoices: total, pending, settled, revenue: Number(revenue._sum.amount ?? 0) });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}