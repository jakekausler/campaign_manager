import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { JobType } from './job-types.enum';
import { JobData } from './job.interface';
import { SCHEDULER_QUEUE } from './queue.constants';

/**
 * Processes jobs from the scheduler queue.
 * Routes jobs to appropriate handlers based on job type.
 */
@Processor(SCHEDULER_QUEUE)
export class JobProcessorService {
  private readonly logger = new Logger(JobProcessorService.name);

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
          await this.processDeferredEffect(job as Job<JobData>);
          break;

        case JobType.SETTLEMENT_GROWTH:
          await this.processSettlementGrowth(job as Job<JobData>);
          break;

        case JobType.STRUCTURE_MAINTENANCE:
          await this.processStructureMaintenance(job as Job<JobData>);
          break;

        case JobType.EVENT_EXPIRATION:
          await this.processEventExpiration(job as Job<JobData>);
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
  private async processDeferredEffect(job: Job<JobData>): Promise<void> {
    // TODO: Implement in Stage 4
    this.logger.debug(`Processing deferred effect for job ${job.id} (not yet implemented)`);
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
