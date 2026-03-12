/**
 * model-router.ts — Expertise routing matrix for ClawRouter model selection
 *
 * Maps task types to specialist models on ClawRouter. When no model is
 * explicitly requested, classifies the prompt and routes to the best
 * specialist. Maintains backwards compatibility with legacy model names
 * (MiniMax-M2.5, claude-haiku-4-5, etc.).
 */

// ── Task Types ──────────────────────────────────────────────────────────────

export type TaskType = 'code' | 'reason' | 'lang' | 'util' | 'audit' | 'content' | 'data';

import { callOllama } from '../../../scripts/lib/ollama-client';

// ── Expertise Routing Matrix ────────────────────────────────────────────────

interface ModelRoute {
  primary: string;
  fallback: string;
}

const EXPERTISE_MODELS: Record<TaskType, ModelRoute> = {
  code:    { primary: 'deepseek/deepseek-chat',         fallback: 'anthropic/claude-haiku-4.5' },
  reason:  { primary: 'deepseek/deepseek-reasoner',     fallback: 'anthropic/claude-sonnet-4.6' },
  lang:    { primary: 'anthropic/claude-haiku-4.5',     fallback: 'google/gemini-2.5-flash' },
  util:    { primary: 'google/gemini-2.5-flash-lite',   fallback: 'anthropic/claude-haiku-4.5' },
  audit:   { primary: 'anthropic/claude-sonnet-4.6',    fallback: 'deepseek/deepseek-chat' },
  content: { primary: 'anthropic/claude-haiku-4.5',     fallback: 'google/gemini-2.5-flash' },
  data:    { primary: 'deepseek/deepseek-chat',         fallback: 'anthropic/claude-haiku-4.5' },
};

// ── Legacy Model Aliases ────────────────────────────────────────────────────

const MODEL_ALIASES: Record<string, string> = {
  'MiniMax-M2.5':              'minimax/minimax-m2.5',
  'minimax-m2.5':              'minimax/minimax-m2.5',
  'minimax-m2.5-lightning':    'minimax/minimax-m2.5',
  'minimax':                   'minimax/minimax-m2.5',
  'coding':                    'deepseek/deepseek-chat',
  'claude-haiku-4-5':          'anthropic/claude-haiku-4.5',
  'claude-haiku-4.5':          'anthropic/claude-haiku-4.5',
  'claude-sonnet-4':           'anthropic/claude-sonnet-4.6',
  'claude-sonnet-4.6':         'anthropic/claude-sonnet-4.6',
  'claude-3-haiku-20240307':   'anthropic/claude-haiku-4.5',
  'claude-3-5-sonnet-20241022':'anthropic/claude-sonnet-4.6',
};

// ── Task Classification ─────────────────────────────────────────────────────

const TASK_PATTERNS: Array<{ type: TaskType; keywords: RegExp }> = [
  {
    type: 'code',
    keywords: /\b(code|function|debug|implement|refactor|typescript|javascript|python|rust|fix\s+bug|compile|syntax|class\s+\w+|import\s+|require\(|async\s+function|interface\s+\w+)\b/i,
  },
  {
    type: 'audit',
    keywords: /\b(security|audit|review|compliance|vulnerability|penetration|cve|owasp|exploit|threat|risk\s+assess)\b/i,
  },
  {
    type: 'data',
    keywords: /\b(query|sql|database|report|aggregate|join|select\s+|group\s+by|csv|dataframe|pandas|analytics|metrics|dashboard)\b/i,
  },
  {
    type: 'lang',
    keywords: /\b(translate|translation|french|arabic|spanish|german|chinese|japanese|korean|locali[sz]e|multilingual|i18n)\b/i,
  },
  {
    type: 'reason',
    keywords: /\b(why|explain|analy[sz]e|tradeoff|trade-off|compare|evaluate|pros\s+and\s+cons|reasoning|think\s+through|step\s+by\s+step)\b/i,
  },
  {
    type: 'content',
    keywords: /\b(write|draft|compose|blog|caption|essay|article|copy|tweet|post|newsletter|marketing|creative\s+writ)\b/i,
  },
  {
    type: 'util',
    keywords: /\b(classify|tag|format|parse|extract|convert|summarize|summarise|json|xml|regex|validate|clean|normalize|transform)\b/i,
  },
];

/**
 * Classify a prompt into a task type using keyword matching.
 * Returns 'util' as the default (cheapest, fastest model) if no match.
 */
export function classifyTask(prompt: string): TaskType {
  for (const { type, keywords } of TASK_PATTERNS) {
    if (keywords.test(prompt)) return type;
  }
  return 'util';
}

// ── Model Selection ─────────────────────────────────────────────────────────

/**
 * Select the ClawRouter model ID for a request.
 *
 * Priority:
 *   1. If requestedModel is a ClawRouter ID (contains '/'), pass through
 *   2. If requestedModel is a legacy alias, map to ClawRouter ID
 *   3. If requestedModel is a task type name ('code', 'reason'), use expertise matrix
 *   4. If no model specified, auto-classify the prompt and pick specialist
 */
export function selectModel(prompt: string, requestedModel?: string): {
  model: string;
  taskType: TaskType;
  autoClassified: boolean;
} {
  // 1. ClawRouter ID passthrough (e.g., 'deepseek/deepseek-coder-v2')
  if (requestedModel && requestedModel.includes('/')) {
    return { model: requestedModel, taskType: classifyTask(prompt), autoClassified: false };
  }

  // 2. Legacy alias mapping
  if (requestedModel && MODEL_ALIASES[requestedModel]) {
    return { model: MODEL_ALIASES[requestedModel], taskType: classifyTask(prompt), autoClassified: false };
  }

  // 3. Task type name (e.g., model='code' → deepseek-coder-v2)
  if (requestedModel && requestedModel in EXPERTISE_MODELS) {
    const taskType = requestedModel as TaskType;
    return { model: EXPERTISE_MODELS[taskType].primary, taskType, autoClassified: false };
  }

  // 4. Auto-classify prompt
  const taskType = classifyTask(prompt);
  return { model: EXPERTISE_MODELS[taskType].primary, taskType, autoClassified: true };
}

/**
 * Get the fallback model for a task type (used if primary fails).
 */
export function getFallbackModel(taskType: TaskType): string {
  return EXPERTISE_MODELS[taskType].fallback;
}

/**
 * Get all supported legacy aliases (for documentation / API responses).
 */
export function getSupportedAliases(): Record<string, string> {
  return { ...MODEL_ALIASES };
}

export { EXPERTISE_MODELS };

/**
 * Smart task classifier — uses regex first, falls back to qwen3:0.6b nano model
 * when regex returns the uncertain default 'util'.
 */
export async function classifyTaskSmart(prompt: string): Promise<TaskType> {
  // 1. Try regex keywords first (instant, no model call)
  const regexResult = classifyTask(prompt);
  if (regexResult !== 'util') return regexResult; // 'util' is the uncertain fallback

  // 2. If regex is uncertain, ask qwen3:0.6b (~120 tok/s, <1s, free)
  try {
    const result = await callOllama({
      model: 'qwen3:0.6b',
      prompt: `Classify this task into exactly one category: code, reason, lang, util, audit, content, data.\nTask: "${prompt.slice(0, 300)}"\nCategory:`,
      maxTokens: 10,
      temperature: 0.0,
    });
    const classified = result.content.trim().toLowerCase() as TaskType;
    if (['code','reason','lang','util','audit','content','data'].includes(classified)) {
      return classified;
    }
  } catch {
    // Ollama unavailable — fall through to regex result
  }

  return regexResult;
}
