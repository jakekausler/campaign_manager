/**
 * Deferred Effect Service
 * Manages scheduling and execution of deferred effects
 */

import { Injectable, Logger } from '@nestjs/common';

import { ApiClientService } from '../api/api-client.service';
import { ConfigService } from '../config/config.service';
import { JobType, JobPriority, DeferredEffectJobData } from '../queue/job.interface';
import { QueueService } from '../queue/queue.service';

/**
 * Result of queuing a deferred effect
 */
export interface QueueDeferredEffectResult {
  jobId: string;
  effectId: string;
  executeAt: string;
  campaignId: string;
}

/**
 * Result of executing a deferred effect
 */
export interface ExecuteDeferredEffectResult {
  success: boolean;
  effectId: string;
  executedAt: Date;
  message?: string;
  executionId?: string;
  error?: string;
}

@Injectable()
export class DeferredEffectService {
  private readonly logger = new Logger(DeferredEffectService.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly apiClientService: ApiClientService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Queue a deferred effect for future execution
   *
   * @param effectId - The effect ID to execute
   * @param executeAt - ISO 8601 timestamp when the effect should execute
   * @param campaignId - The campaign the effect belongs to
   * @param priority - Optional priority for the job (defaults to NORMAL)
   * @returns Job details including job ID
   */
  async queueDeferredEffect(
    effectId: string,
    executeAt: string,
    campaignId: string,
    priority: JobPriority = JobPriority.NORMAL
  ): Promise<QueueDeferredEffectResult> {
    this.logger.log(
      `Queuing deferred effect ${effectId} for campaign ${campaignId} to execute at ${executeAt}`
    );

    // Parse executeAt to calculate delay
    const executeAtTime = new Date(executeAt).getTime();

    // Validate timestamp
    if (isNaN(executeAtTime)) {
      throw new Error(
        `Invalid executeAt timestamp: ${executeAt}. Must be a valid ISO 8601 date string.`
      );
    }

    const now = Date.now();
    const delay = Math.max(0, executeAtTime - now); // Ensure non-negative delay

    if (delay === 0) {
      this.logger.warn(
        `Effect ${effectId} scheduled for immediate execution (executeAt in the past or now)`
      );
    }

    // Create job data
    const jobData: DeferredEffectJobData = {
      type: JobType.DEFERRED_EFFECT,
      campaignId,
      effectId,
      executeAt,
      priority,
    };

    // Queue the job with calculated delay
    const jobId = await this.queueService.addJob(jobData, {
      delay,
      priority,
      attempts: this.configService.queueMaxRetries,
      backoff: {
        type: 'exponential',
        delay: this.configService.queueRetryBackoffMs,
      },
    });

    this.logger.log(`Deferred effect ${effectId} queued with job ID ${jobId} (delay: ${delay}ms)`);

    return {
      jobId,
      effectId,
      executeAt,
      campaignId,
    };
  }

  /**
   * Execute a deferred effect
   * This is called by the job processor when the scheduled time arrives
   *
   * @param effectId - The effect ID to execute
   * @param campaignId - The campaign the effect belongs to
   * @param executeAt - When the effect was supposed to execute (for logging)
   * @returns Execution result
   */
  async executeDeferredEffect(
    effectId: string,
    campaignId: string,
    executeAt: string
  ): Promise<ExecuteDeferredEffectResult> {
    const startTime = Date.now();
    this.logger.log(
      `Executing deferred effect ${effectId} for campaign ${campaignId} (scheduled for ${executeAt})`
    );

    try {
      // Step 1: Fetch effect details from API
      const effect = await this.apiClientService.getEffect(effectId);

      if (!effect) {
        const errorMessage = `Effect ${effectId} not found`;
        this.logger.error(errorMessage);
        return {
          success: false,
          effectId,
          executedAt: new Date(),
          error: errorMessage,
        };
      }

      // Validate campaign ID matches
      if (effect.campaignId !== campaignId) {
        const errorMessage = `Effect ${effectId} belongs to campaign ${effect.campaignId}, expected ${campaignId}`;
        this.logger.error(errorMessage);
        return {
          success: false,
          effectId,
          executedAt: new Date(),
          error: errorMessage,
        };
      }

      // Check if effect is active
      if (!effect.isActive) {
        const message = `Effect ${effectId} is not active, skipping execution`;
        this.logger.warn(message);
        return {
          success: false,
          effectId,
          executedAt: new Date(),
          message,
        };
      }

      // Step 2: Execute the effect via API
      const result = await this.apiClientService.executeEffect(effectId);

      const duration = Date.now() - startTime;
      this.logger.log(
        `Deferred effect ${effectId} execution completed in ${duration}ms: ${result.success ? 'SUCCESS' : 'FAILURE'}`
      );

      return {
        success: result.success,
        effectId,
        executedAt: new Date(),
        message: result.message,
        executionId: result.execution?.id,
        error: result.execution?.error,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to execute deferred effect ${effectId} after ${duration}ms: ${errorMessage}`
      );

      return {
        success: false,
        effectId,
        executedAt: new Date(),
        error: errorMessage,
      };
    }
  }

  /**
   * Cancel a queued deferred effect
   * (Future enhancement - not implemented in this stage)
   *
   * @param jobId - The job ID to cancel
   */
  async cancelDeferredEffect(jobId: string): Promise<void> {
    // TODO: Implement job cancellation in future enhancement
    this.logger.warn(`Cancel deferred effect not yet implemented for job ${jobId}`);
    throw new Error('Job cancellation not yet implemented');
  }
}
