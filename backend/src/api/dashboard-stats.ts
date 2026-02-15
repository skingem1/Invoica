import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    totalInvoices: 142,
    pending: 23,
    settled: 107,
    revenue: 84500,
    failedCount: 12,
    recentCount: 15
  });
});

export default router;