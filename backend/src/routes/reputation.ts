import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { computeAndStoreReputation } from '../services/reputation';

const router = Router();

/**
 * Create Supabase client helper (uses service role for leaderboard reads)
 */
const getSb = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase env vars not set');
  return createClient(url, key);
};

/**
 * GET /x402/oracle/score/:agentId
 * Public endpoint to get reputation score for a specific agent
 */
router.get('/x402/oracle/score/:agentId', async (req, res): Promise<void> => {
  try {
    const { agentId } = req.params;
    
    if (!agentId) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Agent ID is required',
          code: 'MISSING_AGENT_ID'
        }
      });
      return;
    }

    const result = await computeAndStoreReputation(agentId);

    // Check if agent has no invoice history
    if (result.invoicesCompleted === 0 && result.invoicesDisputed === 0) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Agent not found or no invoice history',
          code: 'NOT_FOUND'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        agentId: result.agentId,
        score: result.score,
        tier: result.tier,
        invoicesCompleted: result.invoicesCompleted,
        invoicesDisputed: result.invoicesDisputed,
        totalValueSettled: result.totalValueSettled,
        lastUpdated: result.lastUpdated,
        verifiedAt: new Date().toISOString(),
      }
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: 'DB_ERROR'
      }
    });
  }
});

/**
 * GET /x402/oracle/scores
 * Public leaderboard endpoint - top 50 agents by score
 */
router.get('/x402/oracle/scores', async (req, res): Promise<void> => {
  try {
    const { data, error } = await getSb()
      .from('AgentReputation')
      .select('agentId, score, tier, invoicesCompleted, totalValueSettled, lastUpdated')
      .order('score', { ascending: false })
      .limit(50);

    if (error) {
      res.status(500).json({
        success: false,
        error: {
          message: error.message,
          code: 'DB_ERROR'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: data || []
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: 'DB_ERROR'
      }
    });
  }
});

export default router;