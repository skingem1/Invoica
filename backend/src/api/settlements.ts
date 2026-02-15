import { Request, Response } from 'express';
import { z } from 'zod';

const invoiceIdSchema = z.string().min(1, 'invoiceId is required');

interface SettlementResponse {
  invoiceId: string;
  status: 'pending' | 'confirmed' | 'failed';
  txHash: string | null;
  chain: string;
  confirmedAt: string | null;
  amount: number;
  currency: string;
}

export async function getSettlement(req: Request, res: Response): Promise<void> {
  const validation = invoiceIdSchema.safeParse(req.params.invoiceId);
  if (!validation.success) {
    res.status(400).json({ error: validation.error.errors[0].message });
    return;
  }

  const invoiceId = validation.data;
  const settlement: SettlementResponse = {
    invoiceId,
    status: 'pending',
    txHash: null,
    chain: 'ethereum',
    confirmedAt: null,
    amount: 0,
    currency: 'USD',
  };

  res.status(200).json(settlement);
}