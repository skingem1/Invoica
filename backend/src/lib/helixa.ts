// Helixa Cred Score API client
// Uses /api/v2/reputation/8004/{walletAddress} endpoint for external agents
// No Authorization header needed for reads.

const HELIXA_API_URL = 'https://api.helixa.xyz';
const TIMEOUT_MS = 5000;

/**
 * Fetch Helixa Cred Score for an external agent by wallet address.
 * Uses the ERC-8004 reputation endpoint (wallet address → avgScore).
 * Returns null if agent not found, API unavailable, or timeout.
 */
export async function fetchHelixaScore(walletAddress: string): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `${HELIXA_API_URL}/api/v2/reputation/8004/${walletAddress}`,
      { signal: controller.signal },
    );
    if (!res.ok) {
      console.log(`[helixa] addr=${walletAddress} score=null (HTTP ${res.status})`);
      return null;
    }
    const data = await res.json() as { avgScore?: number | null };
    const score = data?.avgScore ?? null;
    console.log(`[helixa] addr=${walletAddress} score=${score}`);
    return score;
  } catch (err) {
    console.log(`[helixa] addr=${walletAddress} score=null (${(err as Error).message})`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
