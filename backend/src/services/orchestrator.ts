import { EventEmitter } from 'events';
import { Logger, logger } from '../utils/logger';
import { redis } from '../lib/redis';
type RedisService = typeof redis;

interface TaskInput {
  description?: string;
  context?: string;
  agentName: string;
}

interface TaskResult {
  agentId: string;
  taskId: string;
  status: 'completed' | 'rejected' | 'failed';
  timestamp: Date;
  error?: string;
}

interface AgentRejectionState {
  consecutiveFailures: number;
  lastFailureTime: Date;
  isPaused: boolean;
  pausedUntil?: Date;
}

interface QualityCheckResult {
  taskId: string;
  passed: boolean;
  reason?: string;
}

interface NormalizedAgentName {
  camelCase: string;
  kebabCase: string;
}

/**
 * Orchestrates task execution and manages agent health monitoring
 * Prevents cascade failures by pausing agents with consecutive rejections
 */
export class Orchestrator extends EventEmitter {
  private readonly logger: Logger = logger;
  private readonly redis: RedisService;
  private readonly rejectionStates = new Map<string, AgentRejectionState>();
  private readonly REJECTION_THRESHOLD = 2;
  private readonly PAUSE_DURATION_MS = 60 * 60 * 1000; // 1 hour

  constructor(redisService: RedisService) {
    super();
    this.redis = redisService;
  }

  /**
   * Normalizes agent names between camelCase and kebab-case formats
   * Detects input format and returns both versions
   * @param agentName - Agent name in either camelCase or kebab-case format
   * @returns Object containing both camelCase and kebab-case versions
   */
  normalizeAgentName(agentName: string): NormalizedAgentName {
    const isKebabCase = agentName.includes('-');
    
    if (isKebabCase) {
      const camelCase = agentName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return {
        camelCase,
        kebabCase: agentName
      };
    } else {
      const kebabCase = agentName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      return {
        camelCase: agentName,
        kebabCase
      };
    }
  }

  /**
   * Processes task result and checks for rejection patterns
   * Emits warnings and pauses agents that exceed failure threshold
   */
  async processTaskResult(result: TaskResult): Promise<void> {
    try {
      this.logger.info('Processing task result', {
        agentId: result.agentId,
        taskId: result.taskId,
        status: result.status
      });

      if (result.status === 'rejected') {
        await this.handleRejection(result);
      } else if (result.status === 'completed') {
        await this.handleSuccess(result.agentId);
      }

      // Emit result for other services to consume
      this.emit('taskResult', result);
    } catch (error) {
      this.logger.error('Failed to process task result', {
        error: error instanceof Error ? error.message : 'Unknown error',
        result
      });
      throw error;
    }
  }

  /**
   * Validates task quality without causing cascade rejections
   * Marks only the specific failing task as rejected, not subsequent tasks
   */
  async validateTaskQuality(tasks: Array<{ taskId: string; agentId: string; content: any }>): Promise<QualityCheckResult[]> {
    const results: QualityCheckResult[] = [];

    for (const task of tasks) {
      try {
        // Basic validation - check if content exists and has required fields
        if (!task.content || typeof task.content !== 'object') {
          results.push({
            taskId: task.taskId,
            passed: false,
            reason: 'Task content is missing or invalid'
          });
          continue;
        }

        // Check if agent is currently paused
        const rejectionState = this.rejectionStates.get(task.agentId);
        if (rejectionState?.isPaused && rejectionState.pausedUntil && new Date() < rejectionState.pausedUntil) {
          results.push({
            taskId: task.taskId,
            passed: false,
            reason: `Agent ${task.agentId} is temporarily paused due to consecutive failures`
          });
          continue;
        }

        // Task passes validation
        results.push({
          taskId: task.taskId,
          passed: true
        });
      } catch (error) {
        this.logger.error('Error validating task quality', {
          taskId: task.taskId,
          agentId: task.agentId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        results.push({
          taskId: task.taskId,
          passed: false,
          reason: 'Validation error occurred'
        });
      }
    }

    return results;
  }

  /**
   * Validates task input and normalizes agent name format
   */
  async validateTask(input: TaskInput): Promise<boolean> {
    try {
      if (!input.agentName || typeof input.agentName !== 'string') {
        return false;
      }

      // Normalize agent name to handle both formats
      const normalized = this.normalizeAgentName(input.agentName);
      
      // Check if agent exists in either format
      const agentExists = await this.checkAgentExists(normalized.camelCase) || 
                         await this.checkAgentExists(normalized.kebabCase);

      return agentExists;
    } catch (error) {
      this.logger.error('Error validating task', {
        error: error instanceof Error ? error.message : 'Unknown error',
        input
      });
      return false;
    }
  }

  /**
   * Checks if an agent exists in the system
   */
  private async checkAgentExists(agentName: string): Promise<boolean> {
    try {
      const exists = await (this.redis as any).exists(`agent:${agentName}`);
      return exists === 1;
    } catch (error) {
      this.logger.error('Error checking agent existence', {
        agentName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Handles successful task completion
   * Resets consecutive failure count for the agent
   */
  private async handleSuccess(agentId: string): Promise<void> {
    const state = this.rejectionStates.get(agentId);
    if (state) {
      // Reset failure count on success
      state.consecutiveFailures = 0;
      state.isPaused = false;
      state.pausedUntil = undefined;
      
      this.logger.info('Agent failure count reset after success', { agentId });
    }
  }

  /**
   * Handles task rejection and implements cascade failure prevention
   * Pauses agents that exceed the rejection threshold
   */
  private async handleRejection(result: TaskResult): Promise<void> {
    const agentId = result.agentId;
    let state = this.rejectionStates.get(agentId);

    if (!state) {
      state = {
        consecutiveFailures: 0,
        lastFailureTime: new Date(),
        isPaused: false
      };
      this.rejectionStates.set(agentId, state);
    }

    state.consecutiveFailures++;
    state.lastFailureTime = new Date();

    this.logger.warn('Agent task rejected', {
      agentId,
      consecutiveFailures: state.consecutiveFailures,
      taskId: result.taskId,
      error: result.error
    });

    // Check if agent should be paused
    if (state.consecutiveFailures >= this.REJECTION_THRESHOLD) {
      state.isPaused = true;
      state.pausedUntil = new Date(Date.now() + this.PAUSE_DURATION_MS);

      this.logger.error('Agent paused due to consecutive failures', {
        agentId,
        consecutiveFailures: state.consecutiveFailures,
        pausedUntil: state.pausedUntil
      });

      // Emit warning for monitoring systems
      this.emit('agentPaused', {
        agentId,
        consecutiveFailures: state.consecutiveFailures,
        pausedUntil: state.pausedUntil
      });
    }
  }

  /**
   * Gets the current rejection state for an agent
   */
  getAgentRejectionState(agentId: string): AgentRejectionState | undefined {
    return this.rejectionStates.get(agentId);
  }

  /**
   * Manually resets an agent's rejection state
   * Useful for administrative intervention
   */
  resetAgentState(agentId: string): void {
    this.rejectionStates.delete(agentId);
    this.logger.info('Agent state manually reset', { agentId });
  }
}