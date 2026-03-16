import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase env vars not set');
  return createClient(url, key);
}

/**
 * GET /v1/metrics
 * Agent economy insights: invoice totals, settlements, reputation summary.
 */
router.get('/v1/metrics', async (req: Request, res: Response): Promise<void> => {
  try {
    const sb = getSb();
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let invoiceQuery: any = sb.from('Invoice').select('status');
    if (from) invoiceQuery = invoiceQuery.gte('createdAt', from);
    if (to) invoiceQuery = invoiceQuery.lte('createdAt', to);

    let settlementQuery: any = sb.from('Invoice').select('id').in('status', ['SETTLED', 'COMPLETED']);
    settlementQuery = settlementQuery.gte('settledAt', from || sevenDaysAgo);
    if (to) settlementQuery = settlementQuery.lte('settledAt', to);

    const [invoiceRes, settlementRes, reputationRes] = await Promise.all([
      invoiceQuery,
      settlementQuery,
      sb.from('AgentReputation').select('agentId, score'),
    ]);

    if (invoiceRes.error) throw invoiceRes.error;
    if (settlementRes.error) throw settlementRes.error;
    if (reputationRes.error) throw reputationRes.error;

    const invoices = invoiceRes.data || [];
    const byStatus: Record<string, number> = { PENDING: 0, PROCESSING: 0, SETTLED: 0, COMPLETED: 0 };
    for (const inv of invoices) {
      if (inv.status in byStatus) byStatus[inv.status]++;
    }

    const agents = reputationRes.data || [];
    const avgScore = agents.length
      ? agents.reduce((sum: number, a: { score: number }) => sum + (a.score || 0), 0) / agents.length
      : 0;

    res.json({
      invoices: {
        total: invoices.length,
        byStatus,
      },
      settlements: {
        total: byStatus.SETTLED + byStatus.COMPLETED,
        last7Days: (settlementRes.data || []).length,
      },
      reputation: {
        agents: agents.length,
        avgScore: Math.round(avgScore * 100) / 100,
      },
      period: { from: from || null, to: to || null },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
  }
});

/**
 * GET /v1/metrics/agent/:agentId
 * Per-agent metrics: invoices, settled value, and reputation snapshot.
 */
router.get('/v1/metrics/agent/:agentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { agentId } = req.params;
    const sb = getSb();

    const [invoiceRes, reputationRes] = await Promise.all([
      sb.from('Invoice').select('status, amount').eq('companyId', agentId),
      sb.from('AgentReputation').select('score, tier').eq('agentId', agentId).single(),
    ]);

    if (invoiceRes.error) throw invoiceRes.error;

    const invoices = invoiceRes.data || [];
    const byStatus: Record<string, number> = { PENDING: 0, PROCESSING: 0, SETTLED: 0, COMPLETED: 0 };
    let totalValueSettled = 0;
    for (const inv of invoices) {
      if (inv.status in byStatus) byStatus[inv.status]++;
      if (inv.status === 'SETTLED' || inv.status === 'COMPLETED') {
        totalValueSettled += parseFloat(inv.amount as string) || 0;
      }
    }

    const rep = reputationRes.data;
    res.json({
      agentId,
      invoices: { total: invoices.length, byStatus },
      totalValueSettled: Math.round(totalValueSettled * 100) / 100,
      reputation: rep ? { score: rep.score, tier: rep.tier } : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
  }
});

export default router;
