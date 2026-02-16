import { Router, Request, Response, NextFunction } from 'express';

interface SettlementQuery {
  limit?: string;
  offset?: string;
  status?: string;
}

const router = Router();

router.get('/v1/settlements/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    res.json({ success: true, data: { id, status: 'pending', amount: 0, currency: 'USD', invoiceId: null, createdAt: new Date().toISOString() } });
  } catch (err) { next(err); }
});

router.get('/v1/settlements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit = '20', offset = '0' } = req.query as SettlementQuery;
    const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const parsedOffset = parseInt(offset, 10) || 0;
    res.json({ success: true, data: [], meta: { total: 0, limit: parsedLimit, offset: parsedOffset, hasMore: false } });
  } catch (err) { next(err); }
});

export default router;