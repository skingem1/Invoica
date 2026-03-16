import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─────────────────────────────────────────────
// GET /v1/agents/top-earners
// Top N agents by settled revenue.
// Must be registered before /:agentId to avoid param capture.
// ─────────────────────────────────────────────
router.get('/v1/agents/top-earners', async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 50);
  const sb = getSb();

  const { data, error } = await sb
    .from('Invoice')
    .select('agentId, amount')
    .in('status', ['SETTLED', 'COMPLETED']);

  if (error) {
    res.status(500).json({ success: false, error: { message: error.message, code: 'DB_ERROR' } });
    return;
  }

  const agentMap = new Map<string, { agentId: string; totalRevenue: number; invoiceCount: number }>();
  for (const row of (data || [])) {
    const agentId = row.agentId || 'unknown';
    const existing = agentMap.get(agentId) || { agentId, totalRevenue: 0, invoiceCount: 0 };
    existing.totalRevenue += Number(row.amount) || 0;
    existing.invoiceCount += 1;
    agentMap.set(agentId, existing);
  }

  const sorted = Array.from(agentMap.values())
    .map((a) => ({ ...a, avgRevenue: a.invoiceCount > 0 ? a.totalRevenue / a.invoiceCount : 0 }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);

  res.json({ success: true, data: sorted });
});

// ─────────────────────────────────────────────
// GET /v1/agents/activity/summary
// Platform-wide agent activity summary.
// Must be registered before /:agentId to avoid param capture.
// ─────────────────────────────────────────────
router.get('/v1/agents/activity/summary', async (_req: Request, res: Response): Promise<void> => {
  const sb = getSb();

  const { data, error } = await sb
    .from('Invoice')
    .select('agentId, amount, status, updatedAt');

  if (error) {
    res.status(500).json({ success: false, error: { message: error.message, code: 'DB_ERROR' } });
    return;
  }

  const rows = data || [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const settledStatuses = new Set(['SETTLED', 'COMPLETED']);

  const allAgents = new Set<string>(rows.map((r: any) => r.agentId).filter(Boolean));
  const activeAgents = new Set<string>(
    rows
      .filter((r: any) => r.agentId && new Date(r.updatedAt) >= thirtyDaysAgo)
      .map((r: any) => r.agentId)
  );

  let totalRevenue = 0;
  let totalSettled = 0;

  for (const r of rows) {
    if (settledStatuses.has(r.status)) {
      totalSettled++;
      totalRevenue += Number(r.amount) || 0;
    }
  }

  res.json({
    success: true,
    data: {
      totalAgents:  allAgents.size,
      activeAgents: activeAgents.size,
      totalInvoices: rows.length,
      totalSettled,
      totalRevenue,
    },
  });
});

// ─────────────────────────────────────────────
// GET /v1/agents
// List distinct agents with invoice counts and settled value.
// Must be registered before /:agentId to avoid param capture.
// ─────────────────────────────────────────────
router.get('/v1/agents', async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
  const offset = parseInt((req.query.offset as string) || '0', 10);
  const sb = getSb();

  const { data, error } = await sb
    .from('Invoice')
    .select('agentId, amount, status');

  if (error) {
    res.status(500).json({ success: false, error: { message: error.message, code: 'DB_ERROR' } });
    return;
  }

  const agentMap = new Map<string, { agentId: string; invoiceCount: number; totalValueSettled: number }>();
  for (const row of (data || [])) {
    const key = row.agentId || 'unknown';
    if (!agentMap.has(key)) agentMap.set(key, { agentId: key, invoiceCount: 0, totalValueSettled: 0 });
    const entry = agentMap.get(key)!;
    entry.invoiceCount += 1;
    if (row.status === 'SETTLED' || row.status === 'COMPLETED') {
      entry.totalValueSettled += row.amount || 0;
    }
  }

  const agents = Array.from(agentMap.values());
  const paginated = agents.slice(offset, offset + limit);

  res.json({
    success: true,
    data: paginated,
    meta: { total: agents.length, limit, offset, hasMore: (offset + limit) < agents.length },
  });
});

// ─────────────────────────────────────────────
// GET /v1/agents/count
// Count of distinct agentIds and how many have activity.
// Registered before /:agentId to avoid param capture.
// ─────────────────────────────────────────────
router.get('/v1/agents/count', async (_req: Request, res: Response): Promise<void> => {
  const sb = getSb();

  const { data, error } = await sb
    .from('Invoice')
    .select('agentId, status');

  if (error) {
    res.status(500).json({ success: false, error: { message: error.message, code: 'DB_ERROR' } });
    return;
  }

  const rows = data || [];
  const allAgents = new Set<string>(rows.map((r: any) => r.agentId).filter(Boolean));
  const activeStatuses = new Set(['SETTLED', 'COMPLETED']);
  const activeAgents = new Set<string>(
    rows.filter((r: any) => activeStatuses.has(r.status)).map((r: any) => r.agentId).filter(Boolean)
  );

  res.json({ success: true, data: { total: allAgents.size, withActivity: activeAgents.size } });
});

// ─────────────────────────────────────────────
// GET /v1/agents/:agentId/invoices/summary
// Invoice count breakdown by status for a specific agent.
// Must be before /:agentId/invoices to avoid partial match.
// ─────────────────────────────────────────────
router.get('/v1/agents/:agentId/invoices/summary', async (req: Request, res: Response): Promise<void> => {
  const { agentId } = req.params;
  const sb = getSb();

  const { data, error } = await sb
    .from('Invoice')
    .select('status, amount')
    .eq('agentId', agentId);

  if (error) {
    res.status(500).json({ success: false, error: { message: error.message, code: 'DB_ERROR' } });
    return;
  }

  const rows = data || [];
  const byStatus: Record<string, number> = {};
  let totalAmount = 0;
  let settledAmount = 0;

  for (const row of rows) {
    const s = row.status || 'UNKNOWN';
    byStatus[s] = (byStatus[s] || 0) + 1;
    totalAmount += row.amount || 0;
    if (s === 'SETTLED' || s === 'COMPLETED') {
      settledAmount += row.amount || 0;
    }
  }

  res.json({
    success: true,
    data: { agentId, total: rows.length, byStatus, totalAmount, settledAmount },
  });
});

// ─────────────────────────────────────────────
// GET /v1/agents/:agentId/invoices
// Paginated invoice list for a specific agent.
// Must be before /:agentId (profile) — Express matches /:agentId first
// otherwise, but the /invoices suffix distinguishes it.
// ─────────────────────────────────────────────
router.get('/v1/agents/:agentId/invoices', async (req: Request, res: Response): Promise<void> => {
  const { agentId } = req.params;
  const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 100);
  const offset = parseInt((req.query.offset as string) || '0', 10);
  const sb = getSb();

  const { data, error } = await sb
    .from('Invoice')
    .select('id, invoiceNumber, status, amount, currency, customerEmail, customerName, createdAt, updatedAt')
    .eq('agentId', agentId)
    .order('createdAt', { ascending: false });

  if (error) {
    res.status(500).json({ success: false, error: { message: error.message, code: 'DB_ERROR' } });
    return;
  }

  const all = data || [];
  const paginated = all.slice(offset, offset + limit);

  res.json({
    success: true,
    data: paginated,
    meta: { total: all.length, limit, offset, hasMore: (offset + limit) < all.length },
  });
});

// ─────────────────────────────────────────────
// GET /v1/agents/:agentId/reputation
// Full AgentReputation record for an agent. Must be before /:agentId.
// ─────────────────────────────────────────────
router.get('/v1/agents/:agentId/reputation', async (req: Request, res: Response): Promise<void> => {
  const { agentId } = req.params;
  const sb = getSb();

  const { data, error } = await sb
    .from('AgentReputation')
    .select('agentId, score, tier, disputeRate, completionRate, updatedAt')
    .eq('agentId', agentId)
    .maybeSingle();

  if (error) {
    res.status(500).json({ success: false, error: { message: error.message, code: 'DB_ERROR' } });
    return;
  }

  if (!data) {
    res.status(404).json({ success: false, error: { message: 'Agent reputation not found', code: 'NOT_FOUND' } });
    return;
  }

  res.json({ success: true, data });
});

// ─────────────────────────────────────────────
// GET /v1/agents/:agentId/activity
// Recent invoice activity for a specific agent. Must be before /:agentId.
// ─────────────────────────────────────────────
router.get('/v1/agents/:agentId/activity', async (req: Request, res: Response): Promise<void> => {
  const { agentId } = req.params;
  const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 20);
  const sb = getSb();

  const { data, error } = await sb
    .from('Invoice')
    .select('id, status, amount, currency, createdAt')
    .eq('agentId', agentId)
    .order('createdAt', { ascending: false })
    .limit(limit);

  if (error) {
    res.status(500).json({ success: false, error: { message: error.message, code: 'DB_ERROR' } });
    return;
  }

  res.json({ success: true, data: data || [] });
});

// ─────────────────────────────────────────────
// GET /v1/agents/:agentId/earnings
// Weekly earnings for a specific agent for the last 8 weeks.
// Returns zero-filled weeks sorted chronologically. Must be before /:agentId.
// ─────────────────────────────────────────────
router.get('/v1/agents/:agentId/earnings', async (req: Request, res: Response): Promise<void> => {
  const { agentId } = req.params;
  const sb = getSb();

  const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000);

  const { data, error } = await sb
    .from('Invoice')
    .select('amount, createdAt')
    .eq('agentId', agentId)
    .in('status', ['SETTLED', 'COMPLETED'])
    .gte('createdAt', eightWeeksAgo.toISOString());

  if (error) {
    res.status(500).json({ success: false, error: { message: error.message, code: 'DB_ERROR' } });
    return;
  }

  // Build ISO week map for last 8 weeks
  function getISOWeek(d: Date): string {
    const thursday = new Date(d);
    thursday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
    const year = thursday.getUTCFullYear();
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const week = Math.round(((thursday.getTime() - jan4.getTime()) / 86400000 + (jan4.getUTCDay() + 6) % 7) / 7) + 1;
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  const weekMap = new Map<string, { week: string; amount: number; count: number }>();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
    const key = getISOWeek(d);
    if (!weekMap.has(key)) weekMap.set(key, { week: key, amount: 0, count: 0 });
  }

  for (const row of (data || [])) {
    const key = getISOWeek(new Date(row.createdAt));
    if (weekMap.has(key)) {
      const entry = weekMap.get(key)!;
      entry.amount += row.amount || 0;
      entry.count += 1;
    }
  }

  res.json({ success: true, data: Array.from(weekMap.values()) });
});

// ─────────────────────────────────────────────
// GET /v1/agents/:agentId/settlements/summary
// Settlement summary for a specific agent.
// Must be before /:agentId (profile).
// ─────────────────────────────────────────────
router.get('/v1/agents/:agentId/settlements/summary', async (req: Request, res: Response): Promise<void> => {
  const { agentId } = req.params;
  const sb = getSb();

  const { data, error } = await sb
    .from('Invoice')
    .select('amount, currency, status')
    .eq('agentId', agentId)
    .in('status', ['SETTLED', 'COMPLETED']);

  if (error) {
    res.status(500).json({ success: false, error: { message: error.message, code: 'DB_ERROR' } });
    return;
  }

  const rows = data || [];
  const totalSettled = rows.length;
  const totalAmount = rows.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
  const avgAmount = totalSettled > 0 ? totalAmount / totalSettled : 0;
  const currencies = [...new Set(rows.map((r: any) => r.currency).filter(Boolean))] as string[];

  res.json({
    success: true,
    data: { agentId, totalSettled, totalAmount, avgAmount, currencies },
  });
});

// ─────────────────────────────────────────────
// GET /v1/agents/:agentId
// Combined agent profile: reputation + invoice stats
// ─────────────────────────────────────────────
router.get('/v1/agents/:agentId', async (req: Request, res: Response): Promise<void> => {
  const { agentId } = req.params;
  const sb = getSb();

  const [reputationResult, invoicesResult] = await Promise.all([
    sb
      .from('AgentReputation')
      .select('score, tier')
      .eq('agentId', agentId)
      .maybeSingle(),
    sb
      .from('Invoice')
      .select('status, amount')
      .eq('agentId', agentId),
  ]);

  if (reputationResult.error) {
    res.status(500).json({ success: false, error: { message: reputationResult.error.message, code: 'DB_ERROR' } });
    return;
  }
  if (invoicesResult.error) {
    res.status(500).json({ success: false, error: { message: invoicesResult.error.message, code: 'DB_ERROR' } });
    return;
  }

  const reputation = reputationResult.data || null;
  const invoices = invoicesResult.data || [];

  if (!reputation && invoices.length === 0) {
    res.status(404).json({ success: false, error: { message: 'Agent not found', code: 'NOT_FOUND' } });
    return;
  }

  const byStatus: Record<string, number> = {};
  let totalValueSettled = 0;
  for (const inv of invoices) {
    byStatus[inv.status] = (byStatus[inv.status] || 0) + 1;
    if (inv.status === 'SETTLED' || inv.status === 'COMPLETED') {
      totalValueSettled += inv.amount || 0;
    }
  }

  res.json({
    success: true,
    data: {
      agentId,
      reputation: reputation ? { score: reputation.score, tier: reputation.tier } : null,
      invoices: { total: invoices.length, byStatus },
      totalValueSettled,
    },
  });
});

export default router;
