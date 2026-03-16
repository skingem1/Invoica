import { Router, Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase env vars not set');
  return createClient(url, key);
}

const VALID_TIERS = ['platinum', 'gold', 'silver', 'bronze', 'unrated'];

/**
 * GET /v1/reputation/leaderboard
 * Top agents ranked by reputation score, filterable by tier.
 * Query params: tier (optional), limit (default 20, max 100)
 */
router.get('/v1/reputation/leaderboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '20', 10) || 20, 100);
    const tier = req.query.tier as string | undefined;
    const sb = getSb();

    let query: any = sb
      .from('AgentReputation')
      .select('agentId, score, tier, invoicesCompleted, invoicesDisputed, totalValueSettled, lastUpdated')
      .order('score', { ascending: false });

    if (tier && VALID_TIERS.includes(tier.toLowerCase())) {
      query = query.eq('tier', tier.toLowerCase());
    }

    const { data, error } = await query.limit(limit);
    if (error) throw error;

    res.json({
      success: true,
      data: (data || []).map((agent, idx) => ({
        rank: idx + 1,
        agentId: agent.agentId,
        score: agent.score,
        tier: agent.tier,
        invoicesCompleted: agent.invoicesCompleted,
        invoicesDisputed: agent.invoicesDisputed,
        totalValueSettled: agent.totalValueSettled,
        lastUpdated: agent.lastUpdated,
      })),
      meta: { total: (data || []).length, limit },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
