/**
 * local-model-router.ts — Decides whether a task runs locally (Ollama) or
 * goes to the cloud (ClawRouter), and which local model to use.
 *
 * Max 120 lines. No external dependencies.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type LocalTier = 'nano' | 'local' | 'power' | 'heavy';

export interface WalletState {
  monthlyBudget:  number;  // USDC budget for the month
  spentThisMonth: number;  // USDC spent so far
  callCount:      number;  // total LLM calls this month
  lastReset:      string;  // ISO date of last monthly reset
}

// ── Model Map ─────────────────────────────────────────────────────────────────

const LOCAL_MODEL_MAP: Record<string, { model: string; tier: LocalTier }> = {
  // Nano tier — sub-second, ~120 tok/s
  classify:           { model: 'qwen3:0.6b',       tier: 'nano'  },
  format:             { model: 'qwen3:0.6b',       tier: 'nano'  },
  // Local tier — fast, ~60 tok/s
  summarize:          { model: 'qwen3:4b',         tier: 'local' },
  draft:              { model: 'qwen3:4b',         tier: 'local' },
  // Power tier — workhorse, ~50 tok/s
  code:               { model: 'qwen3:14b',        tier: 'power' },
  content:            { model: 'qwen3:14b',        tier: 'power' },
  data:               { model: 'qwen3:14b',        tier: 'power' },
  lang:               { model: 'qwen3:14b',        tier: 'power' },
  audit:              { model: 'qwen3:14b',        tier: 'power' },
  // Reasoning tier — deepseek-r1, ~40 tok/s
  reason:             { model: 'deepseek-r1:14b',  tier: 'power' },
  // Heavy tier — qwen3:32b, 20GB RAM, single-task only
  'refactor-complex': { model: 'qwen3:32b',        tier: 'heavy' },
};

// ── Wallet Helpers ────────────────────────────────────────────────────────────

/**
 * Returns true when ≥95% of monthly budget is spent.
 * In frozen mode, all tasks are forced local (sovereign mode).
 */
export function walletIsFrozen(w: WalletState): boolean {
  return w.monthlyBudget > 0 && w.spentThisMonth / w.monthlyBudget >= 0.95;
}

/**
 * Returns true when ≥80% of monthly budget is spent.
 * In degraded mode, non-critical tasks are pushed local.
 */
export function walletIsDegraded(w: WalletState): boolean {
  return w.monthlyBudget > 0 && w.spentThisMonth / w.monthlyBudget >= 0.80;
}

// ── Routing Decision ──────────────────────────────────────────────────────────

/**
 * Decide whether this task should run locally on Ollama.
 *
 * Priority order:
 * 1. task_target === 'local'         → always local
 * 2. walletIsFrozen()                → sovereign mode, always local
 * 3. walletIsDegraded() + non-critical task type → local
 * 4. small deliverable count + cheap task type   → local
 * 5. default                         → cloud
 */
export function shouldRunLocally(
  taskType:        string,
  taskTarget:      string | undefined,
  walletState:     WalletState,
  deliverableCount: number,
): boolean {
  // 1. Explicit local override
  if (taskTarget === 'local') return true;

  // 2. Wallet frozen → sovereign mode
  if (walletIsFrozen(walletState)) return true;

  // 3. Wallet degraded → non-critical tasks go local
  if (walletIsDegraded(walletState)) {
    const nonCritical = ['summarize', 'draft', 'format', 'classify', 'content', 'data'];
    if (nonCritical.includes(taskType)) return true;
  }

  // 4. Small deliverables + cheap task type → local
  if (deliverableCount <= 1) {
    const cheapTypes = ['classify', 'format', 'summarize', 'draft'];
    if (cheapTypes.includes(taskType)) return true;
  }

  // 5. Default → cloud
  return false;
}

// ── Model Selection ───────────────────────────────────────────────────────────

/**
 * Select the local Ollama model for a given task type.
 * Falls back to qwen3:14b (always-loaded workhorse) if type is unknown.
 */
export function selectLocalModel(taskType: string): { model: string; tier: LocalTier } {
  return LOCAL_MODEL_MAP[taskType] ?? LOCAL_MODEL_MAP['code'];
}
