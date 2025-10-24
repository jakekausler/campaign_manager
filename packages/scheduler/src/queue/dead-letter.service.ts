import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue, Job } from 'bull';

import { AlertingService } from '../monitoring/alerting.service';

import { JobData } from './job.interface';
import { DEAD_LETTER_QUEUE, SCHEDULER_QUEUE } from './queue.constants';

/**
 * Interface for dead-letter job metadata.
 */
export interface DeadLetterJob {
  /** Original job ID */
  originalJobId: string;

  /** Job data that failed */
  jobData: JobData;

  /** Error message from the failure */
  errorMessage: string;

  /** Stack trace (if available) */
  stackTrace?: string;

  /** Number of attempts made */
  attemptsMade: number;

  /** Timestamp when the job was moved to dead-letter queue */
  failedAt: Date;
}

/**
 * Service for managing the dead-letter queue.
 * Failed jobs that exceed retry attempts are moved here for investigation.
 */
@Injectable()
export class DeadLetterService {
  private readonly logger = new Logger(DeadLetterService.name);

  constructor(
    @InjectQueue(SCHEDULER_QUEUE) private readonly schedulerQueue: Queue<JobData>,
    @InjectQueue(DEAD_LETTER_QUEUE) private readonly deadLetterQueue: Queue<DeadLetterJob>,
    private readonly alertingService: AlertingService
  ) {
    // Set up event listener for failed jobs
    this.schedulerQueue.on('failed', this.handleFailedJob.bind(this));
  }

  /**
   * Handle a job that has failed all retry attempts.
   * Move it to the dead-letter queue for investigation.
   */
  private async handleFailedJob(job: Job<JobData>, error: Error): Promise<void> {
    // Only move to dead-letter queue if all attempts have been exhausted
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      this.logger.error(
        `Job ${job.id} failed after ${job.attemptsMade} attempts. Moving to dead-letter queue.`
      );

      const deadLetterJob: DeadLetterJob = {
        originalJobId: job.id.toString(),
        jobData: job.data,
        errorMessage: error.message,
        stackTrace: error.stack,
        attemptsMade: job.attemptsMade,
        failedAt: new Date(),
      };

      await this.deadLetterQueue.add(deadLetterJob, {
        removeOnComplete: false, // Keep completed DLQ jobs
        removeOnFail: false, // Keep failed DLQ jobs
      });

      // Send critical alert for job failure
      await this.alertingService.critical(
        'Job Failed - Moved to Dead Letter Queue',
        `Job ${job.id} of type ${job.data.type} failed after ${job.attemptsMade} attempts`,
        {
          jobId: job.id.toString(),
          jobType: job.data.type,
          campaignId: job.data.campaignId,
          error: error.message,
          attemptsMade: job.attemptsMade,
        }
      );

      this.logger.log(`Job ${job.id} moved to dead-letter queue`);
    }
  }

  /**
   * Get all jobs in the dead-letter queue.
   *
   * @returns Array of dead-letter jobs
   */
  async getDeadLetterJobs(): Promise<Job<DeadLetterJob>[]> {
    // Get jobs in all states (waiting, active, completed, failed)
    const [waiting, active, completed, failed] = await Promise.all([
      this.deadLetterQueue.getWaiting(),
      this.deadLetterQueue.getActive(),
      this.deadLetterQueue.getCompleted(),
      this.deadLetterQueue.getFailed(),
    ]);

    return [...waiting, ...active, ...completed, ...failed];
  }

  /**
   * Get the count of jobs in the dead-letter queue.
   *
   * @returns Number of dead-letter jobs
   */
  async getDeadLetterCount(): Promise<number> {
    const jobs = await this.getDeadLetterJobs();
    return jobs.length;
  }

  /**
   * Retry a job from the dead-letter queue.
   * Removes it from DLQ and re-adds it to the main queue.
   *
   * @param deadLetterJobId - The ID of the job in the dead-letter queue
   */
  async retryDeadLetterJob(deadLetterJobId: string): Promise<void> {
    const job = await this.deadLetterQueue.getJob(deadLetterJobId);

    if (!job) {
      throw new Error(`Dead-letter job ${deadLetterJobId} not found`);
    }

    this.logger.log(`Retrying dead-letter job ${deadLetterJobId}`);

    // Re-add to main queue with original data
    await this.schedulerQueue.add(job.data.jobData);

    // Remove from dead-letter queue
    await job.remove();

    this.logger.log(`Dead-letter job ${deadLetterJobId} retried and removed from DLQ`);
  }

  /**
   * Remove a job from the dead-letter queue without retrying.
   *
   * @param deadLetterJobId - The ID of the job in the dead-letter queue
   */
  async removeDeadLetterJob(deadLetterJobId: string): Promise<void> {
    const job = await this.deadLetterQueue.getJob(deadLetterJobId);

    if (!job) {
      throw new Error(`Dead-letter job ${deadLetterJobId} not found`);
    }

    await job.remove();
    this.logger.log(`Dead-letter job ${deadLetterJobId} removed`);
  }

  /**
   * Clear all jobs from the dead-letter queue.
   *
   * @returns Number of jobs removed
   */
  async clearDeadLetterQueue(): Promise<number> {
    const jobs = await this.getDeadLetterJobs();
    await Promise.all(jobs.map((job) => job.remove()));
    this.logger.warn(`Cleared ${jobs.length} jobs from dead-letter queue`);
    return jobs.length;
  }
}
