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
