import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { DeferredEffectService } from '../effects/deferred-effect.service';
import { EventExpirationService } from '../events/event-expiration.service';

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

  constructor(
    private readonly deferredEffectService: DeferredEffectService,
    private readonly eventExpirationService: EventExpirationService
  ) {}

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
   * Executes growth effects (population, resources, level-up) for a settlement.
   */
  private async processSettlementGrowth(job: Job<JobData>): Promise<void> {
    const jobData = job.data as {
      settlementId: string;
      eventType: string;
      parameters: Record<string, unknown>;
    };
    const { settlementId, eventType, parameters } = jobData;

    this.logger.log(
      `Processing settlement growth for job ${job.id}: ` +
        `settlement ${settlementId}, event type ${eventType}`
    );

    try {
      // TODO: In future implementation, this will:
      // 1. Create an Effect for the growth event via GraphQL mutation
      // 2. Execute the effect to mutate settlement state
      // 3. Update settlement variables (population, resources, level)
      //
      // For now, we log the growth event and mark the job as complete
      // The actual effect creation and execution will be implemented when
      // the API provides settlement-specific effect creation endpoints

      this.logger.log(
        `Settlement growth job ${job.id} completed (effect execution not yet implemented): ` +
          `${eventType} for settlement ${settlementId} with parameters: ${JSON.stringify(parameters)}`
      );
    } catch (error) {
      this.logger.error(
        `Error processing settlement growth job ${job.id}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error; // Re-throw to trigger retry
    }
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
   * Checks for and marks overdue events across all campaigns.
   */
  private async processEventExpiration(job: Job<JobData>): Promise<void> {
    this.logger.log(`Processing event expiration for job ${job.id}`);

    try {
      const result = await this.eventExpirationService.processAllCampaigns();

      this.logger.log(
        `Event expiration job ${job.id} completed: ` +
          `${result.totalChecked} checked, ${result.expired} expired, ${result.errors} errors`
      );

      if (result.errors > 0) {
        this.logger.warn(
          `Event expiration job ${job.id} completed with errors: ${result.errorMessages.join('; ')}`
        );
      }

      // Note: We don't throw an error even if some events failed to expire
      // This allows the job to complete successfully and the cron will retry on next run
    } catch (error) {
      this.logger.error(
        `Event expiration job ${job.id} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error; // Re-throw to trigger retry
    }
  }
}
