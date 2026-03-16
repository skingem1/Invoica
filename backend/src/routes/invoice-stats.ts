import { Router, Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase env vars not set');
  return createClient(url, key);
}

/**
 * GET /v1/invoices/stats
 * Returns invoice totals and revenue metrics, optionally filtered by companyId.
 * Query params: companyId (optional)
 */
router.get('/v1/invoices/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.query.companyId as string | undefined;
    const sb = getSupabase();

    let query = sb.from('Invoice').select('status, amount');
    if (companyId) query = query.eq('companyId', companyId);

    const { data, error } = await query;
    if (error) throw error;

    const invoices = data || [];
    const statusCounts: Record<string, number> = {};
    const statusRevenue: Record<string, number> = {};
    let totalRevenue = 0;

    for (const inv of invoices) {
      const amt = parseFloat(inv.amount as string) || 0;
      statusCounts[inv.status] = (statusCounts[inv.status] || 0) + 1;
      statusRevenue[inv.status] = (statusRevenue[inv.status] || 0) + amt;
      if (inv.status === 'COMPLETED' || inv.status === 'SETTLED') totalRevenue += amt;
    }

    res.json({
      success: true,
      data: {
        total: invoices.length,
        totalRevenue,
        averageAmount: invoices.length > 0 ? totalRevenue / invoices.length : 0,
        byStatus: Object.keys(statusCounts).map((status) => ({
          status,
          count: statusCounts[status],
          revenue: statusRevenue[status] || 0,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
