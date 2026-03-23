import { fetchHelixaScore } from '../lib/helixa';

type TrustTier = 'auto' | 'hold' | 'rejected';

export interface TrustGateResult {
  allowed: boolean;
  tier: TrustTier;
  score: number | null;
  reason: string;
}

/**
 * Check Helixa Cred Score for an incoming agent payer and return acceptance tier.
 *
 * Tier thresholds (from Helixa founder, 2026-03-20):
 *   Preferred  91-100 → auto
 *   Prime      76-90  → auto
 *   Qualified  51-75  → auto
 *   Marginal   26-50  → hold (2x block confirmations)
 *   Junk        0-25  → rejected
 *   Unknown    null   → hold (treat as Marginal)
 */
export async function checkTrustGate(agentId: string): Promise<TrustGateResult> {
  const score = await fetchHelixaScore(agentId);

  let tier: TrustTier;
  let allowed: boolean;
  let reason: string;

  if (score === null) {
    tier = 'hold';
    allowed = true;
    reason = 'Agent not found on Helixa — treated as Marginal';
  } else if (score >= 51) {
    tier = 'auto';
    allowed = true;
    reason = `Helixa score ${score} — Qualified tier, auto-accept`;
  } else if (score >= 26) {
    tier = 'hold';
    allowed = true;
    reason = `Helixa score ${score} — Marginal tier, hold for 2x confirmations`;
  } else {
    tier = 'rejected';
    allowed = false;
    reason = `Helixa score ${score} — Junk tier, rejected`;
  }

  console.log(`[trust-gate] agentId=${agentId} score=${score} tier=${tier}`);
  return { allowed, tier, score, reason };
}
