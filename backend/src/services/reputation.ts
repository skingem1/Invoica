import { createClient } from '@supabase/supabase-js';

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase env vars not set');
  return createClient(url, key);
}

export interface AgentReputationRecord {
  agentId: string;
  score: number;
  tier: string;
  invoicesCompleted: number;
  invoicesDisputed: number;
  totalValueSettled: number;
  lastUpdated: string;
}

/**
 * Computes and stores reputation metrics for an agent based on their invoice history.
 * 
 * @param agentId - The ID of the agent to compute reputation for
 * @returns Promise<AgentReputationRecord> - The computed reputation record
 * @throws Error if Supabase query fails
 */
export async function computeAndStoreReputation(agentId: string): Promise<AgentReputationRecord> {
  const supabase = getSb();

  // Query Supabase Invoice table
  const { data: invoices, error } = await supabase
    .from('Invoice')
    .select('status, amount')
    .eq('companyId', agentId);

  if (error) {
    throw error;
  }

  // Compute metrics from invoice data
  let invoicesCompleted = 0;
  let invoicesDisputed = 0;
  let totalValueSettled = 0;

  for (const invoice of invoices || []) {
    const status = invoice.status;
    const amount = parseFloat(invoice.amount as string);

    if (status === 'SETTLED' || status === 'COMPLETED') {
      invoicesCompleted++;
      totalValueSettled += amount;
    } else if (status === 'REFUNDED') {
      invoicesDisputed++;
    }
  }

  // Calculate score (0-100)
  const base = invoicesCompleted > 0
    ? (invoicesCompleted / (invoicesCompleted + invoicesDisputed)) * 70
    : 0;
  const volumeBonus = Math.min(totalValueSettled / 10000 * 20, 20);
  const countBonus = Math.min(invoicesCompleted / 50 * 10, 10);
  const score = Math.min(Math.round(base + volumeBonus + countBonus), 100);

  // Assign tier based on score
  let tier: string;
  if (score >= 90) {
    tier = 'platinum';
  } else if (score >= 70) {
    tier = 'gold';
  } else if (score >= 50) {
    tier = 'silver';
  } else if (score >= 25) {
    tier = 'bronze';
  } else {
    tier = 'unrated';
  }

  const lastUpdated = new Date().toISOString();

  // Upsert to AgentReputation table
  const { error: upsertError } = await supabase
    .from('AgentReputation')
    .upsert(
      {
        agentId,
        score,
        tier,
        invoicesCompleted,
        invoicesDisputed,
        totalValueSettled,
        lastUpdated,
        updatedAt: lastUpdated,
      },
      { onConflict: 'agentId' }
    );

  if (upsertError) {
    throw upsertError;
  }

  return {
    agentId,
    score,
    tier,
    invoicesCompleted,
    invoicesDisputed,
    totalValueSettled,
    lastUpdated,
  };
}