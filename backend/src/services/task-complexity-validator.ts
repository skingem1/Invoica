/**
 * task-complexity-validator.ts
 *
 * Emergency killswitch module for the sprint pipeline.
 * Created manually on 2026-03-06 to unblock sprint-runner (see EMERGENCY-001).
 *
 * EMERGENCY_SUSPEND_ORCHESTRATION=true blocks ORCH-* and AGENT-034-* cascade tasks
 * that caused a 36-hour pipeline stall (CEO escalation 2026-03-06).
 */

export const EMERGENCY_SUSPEND_ORCHESTRATION = true;

export interface TaskValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Validates whether a task should proceed through the pipeline.
 * Returns allowed=false for tasks matching emergency killswitch criteria.
 */
export function validateTask(task: {
  type?: string;
  description?: string;
  id?: string;
}): TaskValidationResult {
  if (EMERGENCY_SUSPEND_ORCHESTRATION) {
    const desc = (task.description ?? '').toLowerCase();
    const id   = (task.id ?? '').toUpperCase();

    // Block: feature tasks about orchestration (prevents ORCH-001 child spawning)
    if (task.type === 'feature' && (desc.includes('orchestrat') || desc.includes('orch-'))) {
      return {
        allowed: false,
        reason: 'Emergency killswitch: feature task with orchestration keywords blocked',
      };
    }

    // Block: any task with ORCH-* ID
    if (id.startsWith('ORCH-')) {
      return {
        allowed: false,
        reason: 'Emergency killswitch: ORCH-* task ID blocked',
      };
    }

    // Block: stale AGENT-034-* cascade tasks
    if (/^AGENT-034-/.test(id)) {
      return {
        allowed: false,
        reason: 'Emergency killswitch: AGENT-034-* cascade task blocked',
      };
    }
  }

  return { allowed: true };
}

export default { validateTask, EMERGENCY_SUSPEND_ORCHESTRATION };