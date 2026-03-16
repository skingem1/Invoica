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
