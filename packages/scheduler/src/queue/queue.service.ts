import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';

import { JobData, JobOptions, JobPriority } from './job.interface';
import { DEFAULT_JOB_OPTIONS, SCHEDULER_QUEUE } from './queue.constants';

/**
 * Service for managing the scheduler job queue.
 * Provides methods to add jobs and query queue metrics.
 */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(@InjectQueue(SCHEDULER_QUEUE) private readonly schedulerQueue: Queue<JobData>) {}

  /**
   * Add a job to the scheduler queue.
   *
   * @param jobData - The job data including type and payload
   * @param options - Optional job options (priority, delay, retries, etc.)
   * @returns The created job ID
   */
  async addJob(jobData: JobData, options?: JobOptions): Promise<string> {
    const priority = jobData.priority ?? options?.priority ?? JobPriority.NORMAL;

    // Bull uses lower priority values for higher priority jobs (opposite of our enum)
    // So we need to invert: CRITICAL (10) -> 1, HIGH (8) -> 3, NORMAL (5) -> 6, LOW (1) -> 10
    const invertedPriority = 11 - priority;

    const jobOptions = {
      ...DEFAULT_JOB_OPTIONS,
      ...options,
      priority: invertedPriority,
    };

    this.logger.debug(
      `Adding job of type ${jobData.type} for campaign ${jobData.campaignId} with priority ${priority} (Bull priority: ${invertedPriority})`
    );

    const job = await this.schedulerQueue.add(jobData, jobOptions);

    this.logger.log(`Job ${job.id} added to queue`);

    return job.id.toString();
  }

  /**
   * Get metrics about the queue.
   *
   * @returns Queue metrics including counts for different job states
   */
  async getMetrics(): Promise<{
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [active, waiting, completed, failed, delayed] = await Promise.all([
      this.schedulerQueue.getActiveCount(),
      this.schedulerQueue.getWaitingCount(),
      this.schedulerQueue.getCompletedCount(),
      this.schedulerQueue.getFailedCount(),
      this.schedulerQueue.getDelayedCount(),
    ]);

    return {
      active,
      waiting,
      completed,
      failed,
      delayed,
    };
  }

  /**
   * Get the number of jobs in a specific state.
   *
   * @param state - The job state to count
   * @returns The number of jobs in that state
   */
  async getJobCount(
    state: 'active' | 'waiting' | 'completed' | 'failed' | 'delayed'
  ): Promise<number> {
    switch (state) {
      case 'active':
        return this.schedulerQueue.getActiveCount();
      case 'waiting':
        return this.schedulerQueue.getWaitingCount();
      case 'completed':
        return this.schedulerQueue.getCompletedCount();
      case 'failed':
        return this.schedulerQueue.getFailedCount();
      case 'delayed':
        return this.schedulerQueue.getDelayedCount();
    }
  }

  /**
   * Pause the queue (stop processing jobs).
   */
  async pauseQueue(): Promise<void> {
    await this.schedulerQueue.pause();
    this.logger.warn('Scheduler queue paused');
  }

  /**
   * Resume the queue (start processing jobs again).
   */
  async resumeQueue(): Promise<void> {
    await this.schedulerQueue.resume();
    this.logger.log('Scheduler queue resumed');
  }

  /**
   * Clean up old completed jobs.
   *
   * @param maxAge - Maximum age in milliseconds (default: 24 hours)
   * @returns Number of jobs removed
   */
  async cleanCompleted(maxAge: number = 24 * 60 * 60 * 1000): Promise<number> {
    const jobs = await this.schedulerQueue.clean(maxAge, 'completed');
    this.logger.log(`Cleaned up ${jobs.length} completed jobs`);
    return jobs.length;
  }

  /**
   * Clean up old failed jobs.
   *
   * @param maxAge - Maximum age in milliseconds (default: 7 days)
   * @returns Number of jobs removed
   */
  async cleanFailed(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const jobs = await this.schedulerQueue.clean(maxAge, 'failed');
    this.logger.log(`Cleaned up ${jobs.length} failed jobs`);
    return jobs.length;
  }
}
