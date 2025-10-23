import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import { ConfigService } from '../config/config.service';
import { EventExpirationJobData, JobPriority, JobType } from '../queue/job.interface';
import { QueueService } from '../queue/queue.service';
import { SettlementSchedulingService } from '../settlements/settlement-scheduling.service';
import { StructureSchedulingService } from '../structures/structure-scheduling.service';

/**
 * Service for managing scheduled cron tasks.
 * Uses @nestjs/schedule to run periodic tasks that queue jobs for processing.
 */
@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);
  private readonly taskStates = new Map<string, boolean>(); // taskName -> isEnabled

  constructor(
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly settlementSchedulingService: SettlementSchedulingService,
    private readonly structureSchedulingService: StructureSchedulingService
  ) {
    // All tasks start enabled by default
    this.taskStates.set('eventExpiration', true);
    this.taskStates.set('settlementGrowth', true);
    this.taskStates.set('structureMaintenance', true);
  }

  /**
   * Initialize all cron schedules dynamically.
   * This is called during module initialization.
   */
  onModuleInit(): void {
    this.logger.log('Initializing cron schedules...');

    // Event expiration task
    const eventExpirationSchedule = this.configService.cronEventExpiration;
    this.addCronJob('eventExpiration', eventExpirationSchedule, () =>
      this.handleEventExpirationTask()
    );

    // Settlement growth task
    const settlementGrowthSchedule = this.configService.cronSettlementGrowth;
    this.addCronJob('settlementGrowth', settlementGrowthSchedule, () =>
      this.handleSettlementGrowthTask()
    );

    // Structure maintenance task
    const structureMaintenanceSchedule = this.configService.cronStructureMaintenance;
    this.addCronJob('structureMaintenance', structureMaintenanceSchedule, () =>
      this.handleStructureMaintenanceTask()
    );

    this.logger.log('All cron schedules initialized successfully');
  }

  /**
   * Add a cron job to the scheduler registry.
   *
   * @param name - Unique name for the cron job
   * @param schedule - Cron expression (e.g., '0 * * * *')
   * @param callback - Function to execute on schedule
   */
  private addCronJob(name: string, schedule: string, callback: () => void | Promise<void>): void {
    const job = new CronJob(schedule, async () => {
      // Check if task is enabled before executing
      if (!this.isTaskEnabled(name)) {
        this.logger.debug(`Task '${name}' is disabled, skipping execution`);
        return;
      }

      const startTime = Date.now();
      this.logger.log(`Starting scheduled task '${name}' at ${new Date().toISOString()}`);

      try {
        await callback();
        const duration = Date.now() - startTime;
        this.logger.log(`Task '${name}' completed successfully in ${duration}ms`);
      } catch (error) {
        const duration = Date.now() - startTime;
        this.logger.error(
          `Task '${name}' failed after ${duration}ms: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error.stack : undefined
        );

        // In production, this is where we would trigger alerts (e.g., PagerDuty, Slack)
        if (this.configService.isProduction) {
          this.alertOnTaskFailure(name, error);
        }
      }
    });

    this.schedulerRegistry.addCronJob(name, job);
    job.start();

    this.logger.log(`Cron job '${name}' registered with schedule: ${schedule}`);
  }

  /**
   * Handle event expiration check task.
   * Queues jobs to check for and mark overdue events as expired.
   */
  private async handleEventExpirationTask(): Promise<void> {
    this.logger.debug('Executing event expiration task');

    // For now, we queue a single job that will check all campaigns
    // In future stages (Stage 5), this will query the API for campaigns
    // and queue a job per campaign with events to check
    const jobData: EventExpirationJobData = {
      type: JobType.EVENT_EXPIRATION,
      campaignId: 'SYSTEM', // Placeholder for system-wide check
      priority: JobPriority.HIGH,
    };

    await this.queueService.addJob(jobData);

    this.logger.debug('Event expiration job queued');
  }

  /**
   * Handle settlement growth check task.
   * Queries for settlements and queues growth jobs.
   */
  private async handleSettlementGrowthTask(): Promise<void> {
    this.logger.debug('Executing settlement growth task');

    try {
      const result = await this.settlementSchedulingService.processAllSettlements();
      this.logger.log(
        `Settlement growth task completed: ${result.totalSettlements} settlement(s), ` +
          `${result.jobsQueued} job(s) queued, ${result.errors} error(s)`
      );

      if (result.errors > 0) {
        this.logger.warn(`Settlement growth had errors: ${result.errorMessages.join('; ')}`);
      }
    } catch (error) {
      this.logger.error(
        `Settlement growth task failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Handle structure maintenance check task.
   * Queries for structures and queues maintenance jobs.
   */
  private async handleStructureMaintenanceTask(): Promise<void> {
    this.logger.debug('Executing structure maintenance task');

    try {
      const result = await this.structureSchedulingService.processAllStructures();
      this.logger.log(
        `Structure maintenance task completed: ${result.totalStructures} structure(s), ` +
          `${result.jobsQueued} job(s) queued, ${result.errors} error(s)`
      );

      if (result.errors > 0) {
        this.logger.warn(`Structure maintenance had errors: ${result.errorMessages.join('; ')}`);
      }
    } catch (error) {
      this.logger.error(
        `Structure maintenance task failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Enable a scheduled task.
   *
   * @param taskName - Name of the task to enable
   */
  enableTask(taskName: string): void {
    if (!this.taskStates.has(taskName)) {
      throw new Error(`Task '${taskName}' does not exist`);
    }

    this.taskStates.set(taskName, true);
    this.logger.log(`Task '${taskName}' enabled`);
  }

  /**
   * Disable a scheduled task.
   *
   * @param taskName - Name of the task to disable
   */
  disableTask(taskName: string): void {
    if (!this.taskStates.has(taskName)) {
      throw new Error(`Task '${taskName}' does not exist`);
    }

    this.taskStates.set(taskName, false);
    this.logger.warn(`Task '${taskName}' disabled`);
  }

  /**
   * Check if a task is currently enabled.
   *
   * @param taskName - Name of the task to check
   * @returns True if enabled, false otherwise
   */
  isTaskEnabled(taskName: string): boolean {
    return this.taskStates.get(taskName) ?? false;
  }

  /**
   * Get the status of all scheduled tasks.
   *
   * @returns Object mapping task names to their enabled status
   */
  getTaskStatuses(): Record<string, boolean> {
    return Object.fromEntries(this.taskStates);
  }

  /**
   * Get information about all registered cron jobs.
   *
   * @returns Array of job information
   */
  getCronJobs(): Array<{ name: string; running: boolean; enabled: boolean }> {
    const jobs = this.schedulerRegistry.getCronJobs();
    const result: Array<{ name: string; running: boolean; enabled: boolean }> = [];

    jobs.forEach((job, name) => {
      result.push({
        name,
        running: job.isActive,
        enabled: this.isTaskEnabled(name),
      });
    });

    return result;
  }

  /**
   * Trigger an alert when a task fails.
   * In production, this would integrate with monitoring systems.
   *
   * @param taskName - Name of the failed task
   * @param error - The error that occurred
   */
  private alertOnTaskFailure(taskName: string, error: unknown): void {
    // TODO: Integrate with alerting systems (PagerDuty, Slack, etc.)
    // For now, just log the error prominently
    this.logger.error(
      `ALERT: Critical task failure - '${taskName}' - ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
