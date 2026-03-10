import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { RedisService } from './redis';

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

/**
 * Helper type for normalizing agent names between camelCase and kebab-case
 */
type AgentNameNormalizer = {
  toKebabCase: (camelCase: string) => string;
  toCamelCase: (kebabCase: string) => string;
};

/**
 * Orchestrates task execution and manages agent health monitoring
 * Prevents cascade failures by pausing agents with consecutive rejections
 */
export class Orchestrator extends EventEmitter {
  private readonly logger = Logger.getInstance();
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
   */
  private readonly agentNameNormalizer: AgentNameNormalizer = {
    toKebabCase: (camelCase: string): string => {
      return camelCase.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    },
    toCamelCase: (kebabCase: string): string => {
      return kebabCase.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    }
  };

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
        const qualityResult = await this.performQualityCheck(task);
        results.push(qualityResult);

        if (!qualityResult.passed) {
          // Mark only this specific task as rejected
          await this.processTaskResult({
            agentId: task.agentId,
            taskId: task.taskId,
            status: 'rejected',
            timestamp: new Date(),
            error: qualityResult.reason
          });

          this.logger.warn('Task failed quality check', {
            taskId: task.taskId,
            agentId: task.agentId,
            reason: qualityResult.reason
          });
        }
      } catch (error) {
        this.logger.error('Quality check failed', {
          taskId: task.taskId,
          agentId: task.agentId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        results.push({
          taskId: task.taskId,
          passed: false,
          reason: 'Quality check system error'
        });
      }
    }

    return results;
  }

  /**
   * Handles agent rejection by tracking consecutive failures
   * Pauses agent if threshold is exceeded
   */
  private async handleRejection(result: TaskResult): Promise<void> {
    const state = this.rejectionStates.get(result.agentId) || {
      consecutiveFailures: 0,
      lastFailureTime: new Date(),
      isPaused: false
    };

    state.consecutiveFailures++;
    state.lastFailureTime = result.timestamp;

    if (state.consecutiveFailures >= this.REJECTION_THRESHOLD) {
      state.isPaused = true;
      state.pausedUntil = new Date(Date.now() + this.PAUSE_DURATION_MS);

      this.logger.warn('Agent paused due to consecutive rejections', {
        agentId: result.agentId,
        consecutiveFailures: state.consecutiveFailures,
        pausedUntil: state.pausedUntil
      });

      this.emit('agentPaused', {
        agentId: result.agentId,
        reason: 'consecutive_rejections',
        pausedUntil: state.pausedUntil
      });
    }

    this.rejectionStates.set(result.agentId, state);
  }

  /**
   * Handles successful task completion by resetting rejection state
   */
  private async handleSuccess(agentId: string): Promise<void> {
    const state = this.rejectionStates.get(agentId);
    if (state) {
      // Reset consecutive failures on success
      state.consecutiveFailures = 0;
      state.isPaused = false;
      state.pausedUntil = undefined;
      this.rejectionStates.set(agentId, state);

      this.logger.info('Agent rejection state reset after success', {
        agentId
      });
    }
  }

  /**
   * Performs quality check on task content
   */
  private async performQualityCheck(task: { taskId: string; agentId: string; content: any }): Promise<QualityCheckResult> {
    // Basic quality checks
    if (!task.content) {
      return {
        taskId: task.taskId,
        passed: false,
        reason: 'Empty task content'
      };
    }

    if (typeof task.content === 'string' && task.content.trim().length < 10) {
      return {
        taskId: task.taskId,
        passed: false,
        reason: 'Task content too short'
      };
    }

    // Additional quality checks can be added here
    return {
      taskId: task.taskId,
      passed: true
    };
  }

  /**
   * Checks if an agent is currently paused
   */
  isAgentPaused(agentId: string): boolean {
    const state = this.rejectionStates.get(agentId);
    if (!state || !state.isPaused) {
      return false;
    }

    // Check if pause period has expired
    if (state.pausedUntil && new Date() > state.pausedUntil) {
      state.isPaused = false;
      state.pausedUntil = undefined;
      this.rejectionStates.set(agentId, state);
      return false;
    }

    return true;
  }

  /**
   * Gets agent rejection statistics
   */
  getAgentStats(agentId: string): AgentRejectionState | null {
    return this.rejectionStates.get(agentId) || null;
  }

  /**
   * Normalizes agent name to kebab-case
   */
  normalizeAgentName(agentName: string): string {
    return this.agentNameNormalizer.toKebabCase(agentName);
  }

  /**
   * Converts kebab-case agent name to camelCase
   */
  denormalizeAgentName(kebabCaseName: string): string {
    return this.agentNameNormalizer.toCamelCase(kebabCaseName);
  }
}