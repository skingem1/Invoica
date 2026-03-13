/**
 * byterover-client.ts — Optional ByteRover CLI wrapper
 *
 * ByteRover (brv) enables compound learning across sprint runs by storing
 * task context and curating learnings after each successful execution.
 *
 * All functions degrade gracefully if brv is not installed — the pipeline
 * is never blocked or broken by ByteRover absence.
 *
 * Five Seed Principles: Seek Knowledge (اطلبوا العلم) — ByteRover compounds
 * institutional knowledge across every agent execution.
 */

import { execSync } from 'child_process';

// ── Availability cache — check once per process lifetime ─────────────────────
let _available: boolean | null = null;

/**
 * Returns true if the brv CLI is installed and reachable on PATH.
 * Result is cached after the first call.
 */
export async function brvIsAvailable(): Promise<boolean> {
  if (_available !== null) return _available;
  try {
    execSync('which brv', { stdio: 'pipe' });
    _available = true;
  } catch {
    _available = false;
  }
  return _available;
}

/**
 * Queries ByteRover for relevant context given a task objective.
 * Returns context string, or null if brv is not available or query fails.
 *
 * Never throws — all errors are caught and return null.
 */
export async function brvQuery(taskObjective: string): Promise<string | null> {
  if (!(await brvIsAvailable())) return null;

  try {
    // Sanitize: cap length, replace double quotes to avoid shell injection
    const safeObjective = taskObjective.slice(0, 200).replace(/"/g, "'");
    const raw = execSync(
      `brv query "${safeObjective}" --headless --format json`,
      { timeout: 15_000, encoding: 'utf8', stdio: 'pipe' }
    );

    const parsed = JSON.parse(raw) as
      | { context: string }
      | { results: Array<{ content: string }> };

    let context: string | null = null;
    if ('context' in parsed && typeof parsed.context === 'string') {
      context = parsed.context;
    } else if ('results' in parsed && Array.isArray(parsed.results) && parsed.results[0]) {
      context = parsed.results[0].content ?? null;
    }

    if (context) {
      console.log(`[ByteRover] Context injected: ${context.slice(0, 100)}...`);
    }
    return context;
  } catch {
    // brv not responding, timeout, parse error — non-fatal
    return null;
  }
}

/**
 * Curates a task learning into ByteRover after successful completion.
 * Best-effort — never throws, never blocks the pipeline.
 */
export async function brvCurate(
  taskId: string,
  decision: string,
  fileRefs: string[]
): Promise<void> {
  if (!(await brvIsAvailable())) return;

  try {
    const safeDecision = decision.slice(0, 150);
    const fileList = fileRefs.join(', ');
    const entry = `[${taskId}] ${safeDecision} | files: ${fileList}`;

    execSync(`brv curate "${entry}" --headless`, {
      timeout: 10_000,
      stdio: 'pipe',
    });

    console.log(`[ByteRover] Learning captured for: ${taskId}`);
  } catch {
    // Curate is best-effort — log warning but never throw
    console.warn(`[ByteRover] Curate failed for ${taskId} (non-critical)`);
  }
}
