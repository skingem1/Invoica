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

/**
 * GET /v1/metrics/daily
 * Invoice counts per day for the last 7 days. Zeros filled in for empty days.
 */
router.get('/v1/metrics/daily', async (_req: Request, res: Response): Promise<void> => {
  try {
    const sb = getSb();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);

    const { data, error } = await sb
      .from('Invoice')
      .select('status, createdAt')
      .gte('createdAt', sevenDaysAgo.toISOString());

    if (error) throw error;

    // Build a map of date → { invoiceCount, settlementCount }
    const SETTLED = ['SETTLED', 'COMPLETED'];
    const dayMap = new Map<string, { invoiceCount: number; settlementCount: number }>();

    // Pre-fill last 7 days with zeros
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { invoiceCount: 0, settlementCount: 0 });
    }

    for (const row of (data || [])) {
      const key = new Date(row.createdAt).toISOString().slice(0, 10);
      if (dayMap.has(key)) {
        const entry = dayMap.get(key)!;
        entry.invoiceCount += 1;
        if (SETTLED.includes(row.status)) entry.settlementCount += 1;
      }
    }

    const result = Array.from(dayMap.entries()).map(([date, counts]) => ({ date, ...counts }));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
  }
});

/**
 * GET /v1/metrics/leaderboard
 * Top N agents by total invoice amount. ?limit=10 (default 10, max 100).
 * Must be before /summary and /compare to avoid any future param conflicts.
 */
router.get('/v1/metrics/leaderboard', async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 100);
  try {
    const sb = getSb();
    const { data, error } = await sb
      .from('Invoice')
      .select('agentId, amount');

    if (error) throw error;

    const agentMap = new Map<string, { agentId: string; totalAmount: number; invoiceCount: number }>();
    for (const row of (data || [])) {
      const key = row.agentId || 'unknown';
      if (!agentMap.has(key)) agentMap.set(key, { agentId: key, totalAmount: 0, invoiceCount: 0 });
      const entry = agentMap.get(key)!;
      entry.totalAmount += row.amount || 0;
      entry.invoiceCount += 1;
    }

    const sorted = Array.from(agentMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, limit)
      .map((entry, idx) => ({ rank: idx + 1, ...entry }));

    res.json({ success: true, data: sorted });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
  }
});

/**
 * GET /v1/metrics/summary
 * High-level KPI summary: totalInvoices, totalAgents, totalVolumeSettled, avgInvoiceAmount, topAgentId.
 * Reads from Invoice table only.
 */
router.get('/v1/metrics/summary', async (_req: Request, res: Response): Promise<void> => {
  try {
    const sb = getSb();
    const { data, error } = await sb
      .from('Invoice')
      .select('agentId, amount, status');

    if (error) throw error;

    const invoices = data || [];
    const totalInvoices = invoices.length;
    const agentSet = new Set<string>();
    const agentVolume = new Map<string, number>();
    let totalVolumeSettled = 0;
    let totalAmount = 0;

    for (const inv of invoices) {
      const agentId = inv.agentId || 'unknown';
      agentSet.add(agentId);
      totalAmount += inv.amount || 0;
      if (inv.status === 'SETTLED' || inv.status === 'COMPLETED') {
        totalVolumeSettled += inv.amount || 0;
        agentVolume.set(agentId, (agentVolume.get(agentId) || 0) + (inv.amount || 0));
      }
    }

    let topAgentId: string | null = null;
    let topVolume = 0;
    for (const [agentId, vol] of agentVolume.entries()) {
      if (vol > topVolume) { topVolume = vol; topAgentId = agentId; }
    }

    res.json({
      success: true,
      data: {
        totalInvoices,
        totalAgents: agentSet.size,
        totalVolumeSettled,
        avgInvoiceAmount: totalInvoices > 0 ? Math.round((totalAmount / totalInvoices) * 100) / 100 : 0,
        topAgentId,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
  }
});

/**
 * GET /v1/metrics/compare
 * Compare invoice and settlement counts across two time periods.
 * Query params: period1Start, period1End, period2Start, period2End (ISO strings)
 */
router.get('/v1/metrics/compare', async (req: Request, res: Response): Promise<void> => {
  const { period1Start, period1End, period2Start, period2End } = req.query as Record<string, string>;

  if (!period1Start || !period1End || !period2Start || !period2End) {
    res.status(400).json({
      success: false,
      error: { message: 'period1Start, period1End, period2Start, and period2End are all required', code: 'MISSING_PARAMS' },
    });
    return;
  }

  try {
    const sb = getSb();

    const [p1Res, p2Res] = await Promise.all([
      sb.from('Invoice').select('status').gte('createdAt', period1Start).lte('createdAt', period1End),
      sb.from('Invoice').select('status').gte('createdAt', period2Start).lte('createdAt', period2End),
    ]);

    if (p1Res.error) throw p1Res.error;
    if (p2Res.error) throw p2Res.error;

    const p1Invoices = p1Res.data || [];
    const p2Invoices = p2Res.data || [];

    const SETTLED_STATUSES = ['SETTLED', 'COMPLETED'];
    const p1InvoiceCount = p1Invoices.length;
    const p1SettlementCount = p1Invoices.filter((r: { status: string }) => SETTLED_STATUSES.includes(r.status)).length;
    const p2InvoiceCount = p2Invoices.length;
    const p2SettlementCount = p2Invoices.filter((r: { status: string }) => SETTLED_STATUSES.includes(r.status)).length;

    res.json({
      success: true,
      data: {
        period1: { from: period1Start, to: period1End, invoiceCount: p1InvoiceCount, settlementCount: p1SettlementCount },
        period2: { from: period2Start, to: period2End, invoiceCount: p2InvoiceCount, settlementCount: p2SettlementCount },
        delta: {
          invoiceCount: p2InvoiceCount - p1InvoiceCount,
          settlementCount: p2SettlementCount - p1SettlementCount,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
  }
});

/**
 * GET /v1/metrics/chains
 * Invoice counts grouped by blockchain (paymentDetails.chain), sorted by count DESC.
 */
router.get('/v1/metrics/chains', async (_req: Request, res: Response): Promise<void> => {
  try {
    const sb = getSb();
    const { data, error } = await sb.from('Invoice').select('amount, paymentDetails');
    if (error) throw error;

    const chainMap = new Map<string, { chain: string; invoiceCount: number; totalAmount: number }>();
    for (const row of (data || [])) {
      const pd = row.paymentDetails
        ? (typeof row.paymentDetails === 'string' ? JSON.parse(row.paymentDetails) : row.paymentDetails)
        : {};
      const chain = (pd.chain || pd.network || 'unknown').toLowerCase();
      if (!chainMap.has(chain)) chainMap.set(chain, { chain, invoiceCount: 0, totalAmount: 0 });
      const entry = chainMap.get(chain)!;
      entry.invoiceCount += 1;
      entry.totalAmount += row.amount || 0;
    }

    const sorted = Array.from(chainMap.values()).sort((a, b) => b.invoiceCount - a.invoiceCount);
    res.json({ success: true, data: sorted });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
  }
});

/**
 * GET /v1/metrics/top-currencies
 * Most used payment currencies by invoice count, sorted DESC.
 */
router.get('/v1/metrics/top-currencies', async (_req: Request, res: Response): Promise<void> => {
  try {
    const sb = getSb();
    const { data, error } = await sb.from('Invoice').select('currency, amount');
    if (error) throw error;

    const currMap = new Map<string, { currency: string; invoiceCount: number; totalAmount: number }>();
    for (const row of (data || [])) {
      const key = (row.currency || 'UNKNOWN').toUpperCase();
      if (!currMap.has(key)) currMap.set(key, { currency: key, invoiceCount: 0, totalAmount: 0 });
      const entry = currMap.get(key)!;
      entry.invoiceCount += 1;
      entry.totalAmount += row.amount || 0;
    }

    const sorted = Array.from(currMap.values()).sort((a, b) => b.invoiceCount - a.invoiceCount);
    res.json({ success: true, data: sorted });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
  }
});

/**
 * GET /v1/metrics/revenue
 * Daily revenue totals for last 30 days. Only SETTLED/COMPLETED invoices. Zero-fills empty days.
 */
router.get('/v1/metrics/revenue', async (_req: Request, res: Response): Promise<void> => {
  try {
    const sb = getSb();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

    const { data, error } = await sb
      .from('Invoice')
      .select('amount, status, createdAt')
      .in('status', ['SETTLED', 'COMPLETED'])
      .gte('createdAt', thirtyDaysAgo.toISOString());

    if (error) throw error;

    // Pre-fill last 30 days with zeros
    const dayMap = new Map<string, { revenue: number; invoiceCount: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { revenue: 0, invoiceCount: 0 });
    }

    for (const row of (data || [])) {
      const key = new Date(row.createdAt).toISOString().slice(0, 10);
      if (dayMap.has(key)) {
        const entry = dayMap.get(key)!;
        entry.revenue += row.amount || 0;
        entry.invoiceCount += 1;
      }
    }

    const result = Array.from(dayMap.entries()).map(([date, vals]) => ({ date, ...vals }));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
  }
});

/**
 * GET /v1/metrics/agents/top
 * Top agents sorted by total settled invoice value DESC.
 * Optional ?limit=N (default 10, max 50).
 */
router.get('/v1/metrics/agents/top', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 50);
    const sb = getSb();

    const { data, error } = await sb
      .from('Invoice')
      .select('agentId, amount, status')
      .in('status', ['SETTLED', 'COMPLETED']);

    if (error) throw error;

    const agentMap = new Map<string, { agentId: string; settledCount: number; totalSettledAmount: number }>();
    for (const row of (data || [])) {
      const key = row.agentId || 'unknown';
      if (!agentMap.has(key)) agentMap.set(key, { agentId: key, settledCount: 0, totalSettledAmount: 0 });
      const entry = agentMap.get(key)!;
      entry.settledCount += 1;
      entry.totalSettledAmount += row.amount || 0;
    }

    const sorted = Array.from(agentMap.values())
      .sort((a, b) => b.totalSettledAmount - a.totalSettledAmount)
      .slice(0, limit);

    res.json({ success: true, data: sorted });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
  }
});

export default router;
