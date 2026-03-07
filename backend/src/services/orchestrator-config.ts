// orchestrator-config.ts
// Stub created to unblock pre-flight check (CTO-20260307-001 fix).
// AGENT-001 will overwrite this with the real configuration.

/**
 * Meta-task IDs that should be excluded from the generation pool
 * to prevent cascade failures from self-referential tasks
 */
const META_TASK_BLACKLIST: string[] = [
  'ORCH-001',
  'QUALITY-001'
];

export const validTaskTypes: string[] = [
  'AGENT',
  'BACKEND',
  'FRONTEND',
  'INFRA',
  // 'ORCH-001',   // Disabled: causes cascade-blocking pre-flight failures
  // 'QUALITY-001', // Disabled: causes cascade-blocking pre-flight failures
];

/**
 * Checks if a task ID is blacklisted from generation
 * @param taskId - The task ID to check
 * @returns true if the task ID is blacklisted
 */
export const isBlacklistedTaskId = (taskId: string): boolean => {
  return META_TASK_BLACKLIST.includes(taskId);
};

/**
 * Filters out blacklisted task IDs from a list
 * @param taskIds - Array of task IDs to filter
 * @returns Array of task IDs with blacklisted ones removed
 */
export const filterBlacklistedTaskIds = (taskIds: string[]): string[] => {
  return taskIds.filter(taskId => !isBlacklistedTaskId(taskId));
};

export { META_TASK_BLACKLIST };

export default { 
  validTaskTypes,
  META_TASK_BLACKLIST,
  isBlacklistedTaskId,
  filterBlacklistedTaskIds
};