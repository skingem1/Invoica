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

interface TaskState {
  taskId: string;
  parentTaskId?: string;
  rejectionCount: number;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'split';
  agentId?: string;
  createdAt: Date;
  updatedAt: Date;
  originalScope?: string;
  subtasks?: string[];
}

interface SubtaskDefinition {
  taskId: string;
  parentTaskId: string;
  scope: string;
  priority: number;
}

/**
 * Orchestrates task execution and manages agent health monitoring
 * Prevents cascade failures by pausing agents with consecutive rejections
 * Automatically splits tasks after quality gate rejection threshold
 */
export class Orchestrator extends EventEmitter {
  private readonly logger = Logger.getInstance();
  private readonly redis: RedisService;
  private readonly rejectionStates = new Map<string, AgentRejectionState>();
  private readonly taskStates = new Map<string, TaskState>();
  private readonly REJECTION_THRESHOLD = 2;
  private readonly TASK_REJECTION_THRESHOLD = 5;
  private readonly PAUSE_DURATION_MS = 60 * 60 * 1000; // 1 hour

  constructor(redisService: RedisService) {
    super();
    this.redis = redisService;
  }

  /**
   * Processes task result and checks for rejection patterns
   * Emits warnings and pauses agents that exceed failure threshold
   * Handles task-level rejection counting and automatic splitting
   */
  async processTaskResult(result: TaskResult): Promise<void> {
    try {
      this.logger.info('Processing task result', {
        agentId: result.agentId,
        taskId: result.taskId,
        status: result.status
      });

      // Update task state
      await this.updateTaskState(result);

      if (result.status === 'rejected') {
        await this.handleRejection(result);
        await this.handleTaskRejection(result);
      } else if (result.status === 'completed') {
        await this.handleSuccess(result.agentId);
        await this.handleTaskAcceptance(result.taskId);
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
   * Updates task state with result information
   */
  private async updateTaskState(result: TaskResult): Promise<void> {
    const taskState = this.taskStates.get(result.taskId) || {
      taskId: result.taskId,
      rejectionCount: 0,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    taskState.agentId = result.agentId;
    taskState.status = result.status;
    taskState.updatedAt = result.timestamp;

    this.taskStates.set(result.taskId, taskState);

    // Persist to Redis for durability
    await this.redis.setJson(`task:state:${result.taskId}`, taskState);
  }

  /**
   * Handles task-level rejection counting and automatic splitting
   */
  private async handleTaskRejection(result: TaskResult): Promise<void> {
    const taskState = this.taskStates.get(result.taskId);
    if (!taskState) {
      this.logger.error('Task state not found for rejection handling', {
        taskId: result.taskId
      });
      return;
    }

    taskState.rejectionCount += 1;
    taskState.updatedAt = result.timestamp;

    this.logger.warn('Task rejection detected', {
      taskId: result.taskId,
      rejectionCount: taskState.rejectionCount,
      threshold: this.TASK_REJECTION_THRESHOLD
    });

    if (taskState.rejectionCount >= this.TASK_REJECTION_THRESHOLD) {
      await this.splitTask(taskState);
    }

    this.taskStates.set(result.taskId, taskState);
    await this.redis.setJson(`task:state:${result.taskId}`, taskState);
  }

  /**
   * Resets task rejection counter on acceptance
   */
  private async handleTaskAcceptance(taskId: string): Promise<void> {
    const taskState = this.taskStates.get(taskId);
    if (!taskState) {
      return;
    }

    if (taskState.rejectionCount > 0) {
      this.logger.info('Resetting task rejection counter on acceptance', {
        taskId,
        previousRejectionCount: taskState.rejectionCount
      });

      taskState.rejectionCount = 0;
      taskState.updatedAt = new Date();

      this.taskStates.set(taskId, taskState);
      await this.redis.setJson(`task:state:${taskId}`, taskState);
    }
  }

  /**
   * Automatically splits a task into 2-3 smaller subtasks after rejection threshold
   */
  private async splitTask(taskState: TaskState): Promise<void> {
    this.logger.info('Splitting task due to consecutive rejections', {
      taskId: taskState.taskId,
      rejectionCount: taskState.rejectionCount
    });

    const subtasks = await this.generateSubtasks(taskState);
    
    // Update original task status
    taskState.status = 'split';
    taskState.subtasks = subtasks.map(st => st.taskId);
    taskState.updatedAt = new Date();

    // Create subtask states
    for (const subtask of subtasks) {
      const subtaskState: TaskState = {
        taskId: subtask.taskId,
        parentTaskId: taskState.taskId,
        rejectionCount: 0,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.taskStates.set(subtask.taskId, subtaskState);
      await this.redis.setJson(`task:state:${subtask.taskId}`, subtaskState);

      // Queue subtask for execution
      await this.redis.lpush('task:queue', JSON.stringify({
        taskId: subtask.taskId,
        parentTaskId: taskState.taskId,
        scope: subtask.scope,
        priority: subtask.priority
      }));
    }

    this.taskStates.set(taskState.taskId, taskState);
    await this.redis.setJson(`task:state:${taskState.taskId}`, taskState);

    this.emit('taskSplit', {
      originalTaskId: taskState.taskId,
      subtasks: subtasks
    });
  }

  /**
   * Generates 2-3 smaller subtasks from a failed task
   */
  private async generateSubtasks(taskState: TaskState): Promise<SubtaskDefinition[]> {
    const baseTaskId = taskState.taskId;
    const timestamp = Date.now();

    // Generate 2-3 subtasks with reduced scope
    const subtasks: SubtaskDefinition[] = [
      {
        taskId: `${baseTaskId}-sub1-${timestamp}`,
        parentTaskId: baseTaskId,
        scope: 'Core functionality implementation',
        priority: 1
      },
      {
        taskId: `${baseTaskId}-sub2-${timestamp}`,
        parentTaskId: baseTaskId,
        scope: 'Error handling and validation',
        priority: 2
      }
    ];

    // Add third subtask if original scope was complex
    if (taskState.originalScope && taskState.originalScope.length > 200) {
      subtasks.push({
        taskId: `${baseTaskId}-sub3-${timestamp}`,
        parentTaskId: baseTaskId,
        scope: 'Testing and documentation',
        priority: 3
      });
    }

    return subtasks;
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

    this.logger.warn('Agent paused due to consecutive rejections', {
      agentId,
      consecutiveFailures: state.consecutiveFailures,
      pausedUntil
    });

    // Pause the agent's queue in Redis
    await this.redis.set(`agent:${agentId}:paused`, 'true');
    await this.redis.expireat(`agent:${agentId}:paused`, Math.floor(pausedUntil.getTime() / 1000));

    this.emit('agentPaused', {
      agentId,
      reason: 'consecutive_rejections',
      pausedUntil
    });

    // Schedule automatic resume
    setTimeout(() => {
      this.resumeAgent(agentId);
    }, this.PAUSE_DURATION_MS);
  }

  /**
   * Handles successful task completion by resetting agent failure state
   */
  private async handleSuccess(agentId: string): Promise<void> {
    const currentState = this.rejectionStates.get(agentId);
    
    if (currentState && currentState.consecutiveFailures > 0) {
      this.logger.info('Resetting agent failure state after success', {
        agentId,
        previousFailures: currentState.consecutiveFailures
      });

      currentState.consecutiveFailures = 0;
      this.rejectionStates.set(agentId, currentState);
    }
  }

  /**
   * Resumes a paused agent
   */
  private async resumeAgent(agentId: string): Promise<void> {
    const state = this.rejectionStates.get(agentId);
    
    if (state && state.isPaused) {
      state.isPaused = false;
      state.pausedUntil = undefined;
      this.rejectionStates.set(agentId, state);

      await this.redis.del(`agent:${agentId}:paused`);

      this.logger.info('Agent resumed after pause period', { agentId });
      this.emit('agentResumed', { agentId });
    }
  }

  /**
   * Checks if an agent is currently paused
   */
  async isAgentPaused(agentId: string): Promise<boolean> {
    const state = this.rejectionStates.get(agentId);
    
    if (state?.isPaused && state.pausedUntil) {
      if (new Date() > state.pausedUntil) {
        await this.resumeAgent(agentId);
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Gets current task state
   */
  getTaskState(taskId: string): TaskState | undefined {
    return this.taskStates.get(taskId);
  }

  /**
   * Gets agent rejection state
   */
  getAgentState(agentId: string): AgentRejectionState | undefined {
    return this.rejectionStates.get(agentId);
  }

  /**
   * Loads task states from Redis on startup
   */
  async loadTaskStates(): Promise<void> {
    try {
      const keys = await this.redis.keys('task:state:*');
      
      for (const key of keys) {
        const taskState = await this.redis.getJson(key) as TaskState;
        if (taskState) {
          this.taskStates.set(taskState.taskId, taskState);
        }
      }

      this.logger.info('Loaded task states from Redis', {
        count: this.taskStates.size
      });
    } catch (error) {
      this.logger.error('Failed to load task states from Redis', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}