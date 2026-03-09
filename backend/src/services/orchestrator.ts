import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { RedisService } from './redis';

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

        // Mark this specific task as failed due to system error
        await this.processTaskResult({
          agentId: task.agentId,
          taskId: task.taskId,
          status: 'failed',
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Quality check system error'
        });
      }
    }

    return results;
  }

  /**
   * Performs quality check on individual task
   */
  private async performQualityCheck(task: { taskId: string; agentId: string; content: any }): Promise<QualityCheckResult> {
    // Basic quality checks
    if (!task.content) {
      return {
        taskId: task.taskId,
        passed: false,
        reason: 'Task content is empty'
      };
    }

    if (typeof task.content === 'string' && task.content.trim().length < 10) {
      return {
        taskId: task.taskId,
        passed: false,
        reason: 'Task content too short'
      };
    }

    // Check for placeholder content
    const placeholderPatterns = [
      /TODO/i,
      /PLACEHOLDER/i,
      /FIXME/i,
      /\[.*\]/,
      /\{.*\}/
    ];

    const contentStr = typeof task.content === 'string' ? task.content : JSON.stringify(task.content);
    
    for (const pattern of placeholderPatterns) {
      if (pattern.test(contentStr)) {
        return {
          taskId: task.taskId,
          passed: false,
          reason: `Contains placeholder content: ${pattern.source}`
        };
      }
    }

    return {
      taskId: task.taskId,
      passed: true
    };
  }

  /**
   * Handles rejection by tracking consecutive failures and pausing if threshold exceeded
   */
  private async handleRejection(result: TaskResult): Promise<void> {
    const agentId = result.agentId;
    const currentState = this.rejectionStates.get(agentId) || {
      consecutiveFailures: 0,
      lastFailureTime: new Date(),
      isPaused: false
    };

    currentState.consecutiveFailures += 1;
    currentState.lastFailureTime = result.timestamp;

    this.rejectionStates.set(agentId, currentState);

    this.logger.warn('Agent rejection detected', {
      agentId,
      consecutiveFailures: currentState.consecutiveFailures,
      threshold: this.REJECTION_THRESHOLD
    });

    if (currentState.consecutiveFailures >= this.REJECTION_THRESHOLD) {
      await this.pauseAgent(agentId, currentState);
    }
  }

  /**
   * Pauses agent queue and schedules automatic resume
   */
  private async pauseAgent(agentId: string, state: AgentRejectionState): Promise<void> {
    const pausedUntil = new Date(Date.now() + this.PAUSE_DURATION_MS);
    
    state.isPaused = true;
    state.pausedUntil = pausedUntil;
    this.rejectionStates.set(agentId, state);

    try {
      await this.redis.pauseQueue(`agent:${agentId}`, this.PAUSE_DURATION_MS);
      
      this.logger.error('Agent paused due to consecutive rejections', {
        agentId,
        consecutiveFailures: state.consecutiveFailures,
        pausedUntil: pausedUntil.toISOString()
      });

      this.emit('agentPaused', {
        agentId,
        reason: 'consecutive_rejections',
        pausedUntil
      });

      // Schedule automatic resume
      setTimeout(() => {
        this.resumeAgent(agentId);
      }, this.PAUSE_DURATION_MS);

    } catch (error) {
      this.logger.error('Failed to pause agent queue', {
        agentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Handles successful task completion by resetting rejection state
   */
  private async handleSuccess(agentId: string): Promise<void> {
    const currentState = this.rejectionStates.get(agentId);
    
    if (currentState && currentState.consecutiveFailures > 0) {
      this.logger.info('Agent recovered from rejections', {
        agentId,
        previousFailures: currentState.consecutiveFailures
      });

      // Reset failure count on success
      currentState.consecutiveFailures = 0;
      this.rejectionStates.set(agentId, currentState);
    }
  }

  /**
   * Resumes paused agent and clears rejection state
   */
  private async resumeAgent(agentId: string): Promise<void> {
    try {
      const state = this.rejectionStates.get(agentId);
      
      if (state && state.isPaused) {
        await this.redis.resumeQueue(`agent:${agentId}`);
        
        state.isPaused = false;
        state.pausedUntil = undefined;
        state.consecutiveFailures = 0;
        this.rejectionStates.set(agentId, state);

        this.logger.info('Agent resumed after pause period', { agentId });
        
        this.emit('agentResumed', { agentId });
      }
    } catch (error) {
      this.logger.error('Failed to resume agent', {
        agentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Gets current rejection state for an agent
   */
  getAgentState(agentId: string): AgentRejectionState | undefined {
    return this.rejectionStates.get(agentId);
  }

  /**
   * Checks if agent is currently paused
   */
  isAgentPaused(agentId: string): boolean {
    const state = this.rejectionStates.get(agentId);
    return state?.isPaused || false;
  }

  /**
   * Manually resume a paused agent (for admin intervention)
   */
  async forceResumeAgent(agentId: string): Promise<void> {
    await this.resumeAgent(agentId);
  }
}