import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { DeferredEffectService } from '../effects/deferred-effect.service';

import { JobType } from './job-types.enum';
import { JobData, DeferredEffectJobData } from './job.interface';
import { SCHEDULER_QUEUE } from './queue.constants';

/**
 * Processes jobs from the scheduler queue.
 * Routes jobs to appropriate handlers based on job type.
 */
@Processor(SCHEDULER_QUEUE)
export class JobProcessorService {
  private readonly logger = new Logger(JobProcessorService.name);

  constructor(private readonly deferredEffectService: DeferredEffectService) {}

  /**
   * Main job processing method that routes to specific handlers.
   */
  @Process()
  async processJob(job: Job<JobData>): Promise<void> {
    this.logger.log(
      `Processing job ${job.id} of type ${job.data.type} for campaign ${job.data.campaignId}`
    );

    try {
      switch (job.data.type) {
        case JobType.DEFERRED_EFFECT:
          await this.processDeferredEffect(job as Job<DeferredEffectJobData>);
          break;

        case JobType.SETTLEMENT_GROWTH:
          await this.processSettlementGrowth(job);
          break;

        case JobType.STRUCTURE_MAINTENANCE:
          await this.processStructureMaintenance(job);
          break;

        case JobType.EVENT_EXPIRATION:
          await this.processEventExpiration(job);
          break;

        default:
          // This should never happen due to TypeScript exhaustiveness checking
          throw new Error(`Unknown job type: ${(job.data as JobData).type}`);
      }

      this.logger.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(
        `Job ${job.id} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error; // Re-throw to trigger Bull's retry logic
    }
  }

  /**
   * Process a deferred effect execution job.
   */
  private async processDeferredEffect(job: Job<DeferredEffectJobData>): Promise<void> {
    const { effectId, campaignId, executeAt } = job.data;

    this.logger.log(`Processing deferred effect job ${job.id} for effect ${effectId}`);

    try {
      const result = await this.deferredEffectService.executeDeferredEffect(
        effectId,
        campaignId,
        executeAt
      );

      if (!result.success) {
        const errorMsg = result.error || result.message || 'Unknown failure reason';
        this.logger.error(
          `Deferred effect ${effectId} execution failed: ${errorMsg}. Job will retry if attempts remain.`
        );
        throw new Error(`Effect execution failed: ${errorMsg}`);
      }

      this.logger.log(
        `Deferred effect ${effectId} executed successfully (execution ID: ${result.executionId})`
      );
    } catch (error) {
      this.logger.error(
        `Error processing deferred effect job ${job.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error; // Re-throw to trigger retry
    }
  }

  /**
   * Process a settlement growth job.
   */
  private async processSettlementGrowth(job: Job<JobData>): Promise<void> {
    // TODO: Implement in Stage 6
    this.logger.debug(`Processing settlement growth for job ${job.id} (not yet implemented)`);
  }

  /**
   * Process a structure maintenance job.
   */
  private async processStructureMaintenance(job: Job<JobData>): Promise<void> {
    // TODO: Implement in Stage 7
    this.logger.debug(`Processing structure maintenance for job ${job.id} (not yet implemented)`);
  }

  /**
   * Process an event expiration check job.
   */
  private async processEventExpiration(job: Job<JobData>): Promise<void> {
    // TODO: Implement in Stage 5
    this.logger.debug(`Processing event expiration for job ${job.id} (not yet implemented)`);
  }
}
