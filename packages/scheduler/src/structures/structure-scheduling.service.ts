/**
 * Structure Scheduling Service
 * Manages periodic maintenance events for structures (construction completion, maintenance, upgrades)
 */

import { Injectable, Logger } from '@nestjs/common';

import { ApiClientService, StructureSummary } from '../api/api-client.service';
import { JobType } from '../queue/job-types.enum';
import { JobPriority } from '../queue/job.interface';
import { QueueService } from '../queue/queue.service';

/**
 * Maintenance event types for structures
 */
export enum MaintenanceEventType {
  CONSTRUCTION_COMPLETE = 'CONSTRUCTION_COMPLETE',
  MAINTENANCE_DUE = 'MAINTENANCE_DUE',
  UPGRADE_AVAILABLE = 'UPGRADE_AVAILABLE',
}

/**
 * Maintenance calculation result
 */
export interface MaintenanceCalculation {
  campaignId: string;
  structureId: string;
  eventType: MaintenanceEventType;
  nextExecutionTime: Date;
  parameters: Record<string, unknown>;
}

/**
 * Result of processing structure maintenance
 */
export interface ProcessMaintenanceResult {
  totalStructures: number;
  jobsQueued: number;
  errors: number;
  errorMessages: string[];
}

/**
 * Configuration for structure maintenance
 */
interface MaintenanceConfig {
  // Base interval in minutes for maintenance checks
  defaultMaintenanceIntervalMinutes: number;
}

@Injectable()
export class StructureSchedulingService {
  private readonly logger = new Logger(StructureSchedulingService.name);
  private readonly config: MaintenanceConfig;

  constructor(
    private readonly apiClientService: ApiClientService,
    private readonly queueService: QueueService
  ) {
    // Default configuration
    this.config = {
      defaultMaintenanceIntervalMinutes: 120, // 2 hours
    };
  }

  /**
   * Process structure maintenance for all campaigns.
   * This is the entry point called by the cron scheduler.
   *
   * @returns Result summary with counts and details
   */
  async processAllStructures(): Promise<ProcessMaintenanceResult> {
    this.logger.log('Processing structure maintenance for all campaigns');

    const result: ProcessMaintenanceResult = {
      totalStructures: 0,
      jobsQueued: 0,
      errors: 0,
      errorMessages: [],
    };

    try {
      // Get all campaign IDs
      const campaignIds = await this.apiClientService.getAllCampaignIds();

      if (campaignIds.length === 0) {
        this.logger.debug('No campaigns found');
        return result;
      }

      this.logger.log(`Processing structures across ${campaignIds.length} campaign(s)`);

      // Process each campaign
      for (const campaignId of campaignIds) {
        try {
          const campaignResult = await this.processStructuresForCampaign(campaignId);
          result.totalStructures += campaignResult.totalStructures;
          result.jobsQueued += campaignResult.jobsQueued;
          result.errors += campaignResult.errors;
          result.errorMessages.push(...campaignResult.errorMessages);
        } catch (error) {
          result.errors++;
          result.errorMessages.push(
            `Campaign ${campaignId}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      this.logger.log(
        `Structure maintenance processing complete: ` +
          `${result.totalStructures} structure(s) checked, ` +
          `${result.jobsQueued} job(s) queued, ` +
          `${result.errors} error(s)`
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process structure maintenance: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Process structure maintenance for a specific campaign
   *
   * @param campaignId - The campaign ID
   * @returns Result summary
   */
  async processStructuresForCampaign(campaignId: string): Promise<ProcessMaintenanceResult> {
    this.logger.log(`Processing structure maintenance for campaign ${campaignId}`);

    const result: ProcessMaintenanceResult = {
      totalStructures: 0,
      jobsQueued: 0,
      errors: 0,
      errorMessages: [],
    };

    try {
      // Query API for structures in this campaign
      const structures = await this.getStructuresForCampaign(campaignId);
      result.totalStructures = structures.length;

      if (structures.length === 0) {
        this.logger.debug(`No structures found in campaign ${campaignId}`);
        return result;
      }

      this.logger.log(`Found ${structures.length} structure(s) in campaign ${campaignId}`);

      // Process each structure
      for (const structure of structures) {
        try {
          const maintenanceEvents = await this.scheduleMaintenanceForStructure(structure);
          result.jobsQueued += maintenanceEvents.length;
        } catch (error) {
          result.errors++;
          result.errorMessages.push(
            `Structure ${structure.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      this.logger.log(
        `Completed structure maintenance processing for campaign ${campaignId}: ` +
          `${result.jobsQueued} job(s) queued, ${result.errors} error(s)`
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process structures for campaign ${campaignId}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Schedule maintenance events for a single structure
   *
   * @param structure - Structure to schedule maintenance for
   * @returns Array of maintenance calculations that were queued
   */
  private async scheduleMaintenanceForStructure(
    structure: StructureSummary
  ): Promise<MaintenanceCalculation[]> {
    this.logger.debug(`Scheduling maintenance for structure ${structure.id} (${structure.name})`);

    // Calculate maintenance events
    const maintenanceEvents = this.calculateMaintenanceEvents(structure);

    // Queue jobs for each maintenance event
    for (const event of maintenanceEvents) {
      await this.queueMaintenanceJob(event);
    }

    this.logger.debug(
      `Queued ${maintenanceEvents.length} maintenance job(s) for structure ${structure.id}`
    );

    return maintenanceEvents;
  }

  /**
   * Calculate maintenance events for a structure based on type and variables
   *
   * @param structure - Structure data
   * @returns Array of maintenance calculations
   */
  private calculateMaintenanceEvents(structure: StructureSummary): MaintenanceCalculation[] {
    const calculations: MaintenanceCalculation[] = [];

    // Check for custom maintenance interval in structure variables
    const customMaintenanceInterval =
      (structure.variables.maintenanceIntervalMinutes as number) || null;
    const isOperational = (structure.variables.isOperational as boolean) ?? true;
    const constructionDurationMinutes =
      (structure.variables.constructionDurationMinutes as number) || null;

    // Construction completion calculation (if structure is under construction)
    if (constructionDurationMinutes && constructionDurationMinutes > 0) {
      calculations.push({
        campaignId: structure.campaignId,
        structureId: structure.id,
        eventType: MaintenanceEventType.CONSTRUCTION_COMPLETE,
        nextExecutionTime: new Date(Date.now() + constructionDurationMinutes * 60 * 1000),
        parameters: {
          structureType: structure.type,
          constructionDuration: constructionDurationMinutes,
        },
      });
    }

    // Maintenance due calculation (only for operational structures)
    if (isOperational) {
      const maintenanceInterval =
        customMaintenanceInterval || this.config.defaultMaintenanceIntervalMinutes;

      calculations.push({
        campaignId: structure.campaignId,
        structureId: structure.id,
        eventType: MaintenanceEventType.MAINTENANCE_DUE,
        nextExecutionTime: new Date(Date.now() + maintenanceInterval * 60 * 1000),
        parameters: {
          structureType: structure.type,
          health: structure.variables.health || 100,
          maintenanceInterval,
        },
      });
    }

    // Upgrade available calculation (check if structure meets upgrade criteria)
    const currentLevel = (structure.variables.level as number) || 1;
    const maxLevel = (structure.variables.maxLevel as number) || 5;

    if (isOperational && currentLevel < maxLevel) {
      // Check every 6 hours for upgrade availability
      const upgradeCheckInterval = 360; // 6 hours

      calculations.push({
        campaignId: structure.campaignId,
        structureId: structure.id,
        eventType: MaintenanceEventType.UPGRADE_AVAILABLE,
        nextExecutionTime: new Date(Date.now() + upgradeCheckInterval * 60 * 1000),
        parameters: {
          structureType: structure.type,
          currentLevel,
          maxLevel,
          requiredResourcesForUpgrade: structure.variables.requiredResourcesForUpgrade || {},
        },
      });
    }

    return calculations;
  }

  /**
   * Queue a maintenance job for execution
   *
   * @param calculation - Maintenance calculation with timing and parameters
   */
  private async queueMaintenanceJob(calculation: MaintenanceCalculation): Promise<void> {
    const delay = calculation.nextExecutionTime.getTime() - Date.now();

    if (delay < 0) {
      this.logger.warn(
        `Maintenance event ${calculation.eventType} for structure ${calculation.structureId} ` +
          `is already overdue, queuing immediately`
      );
    }

    // Construct the job data object with literal type
    const jobData: {
      type: JobType.STRUCTURE_MAINTENANCE;
      campaignId: string;
      structureId: string;
      maintenanceType: string;
      parameters: Record<string, unknown>;
      priority: JobPriority;
    } = {
      type: JobType.STRUCTURE_MAINTENANCE,
      campaignId: calculation.campaignId,
      structureId: calculation.structureId,
      maintenanceType: calculation.eventType,
      parameters: calculation.parameters,
      priority: JobPriority.NORMAL,
    };

    await this.queueService.addJob(jobData, {
      delay: Math.max(0, delay),
    });

    this.logger.debug(
      `Queued ${calculation.eventType} job for structure ${calculation.structureId} ` +
        `(delay: ${Math.round(delay / 1000)}s)`
    );
  }

  /**
   * Query the API for structures in a campaign
   *
   * @param campaignId - Campaign ID
   * @returns Array of structure summaries
   */
  private async getStructuresForCampaign(campaignId: string): Promise<StructureSummary[]> {
    this.logger.debug(`Querying structures for campaign ${campaignId}`);

    try {
      const structures = await this.apiClientService.getStructuresByCampaign(campaignId);
      return structures;
    } catch (error) {
      this.logger.error(
        `Failed to query structures for campaign ${campaignId}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Get maintenance configuration
   *
   * @returns Current maintenance configuration
   */
  getConfig(): MaintenanceConfig {
    return { ...this.config };
  }

  /**
   * Set default maintenance interval (minutes)
   *
   * @param minutes - Interval in minutes
   */
  setDefaultMaintenanceInterval(minutes: number): void {
    if (minutes <= 0) {
      throw new Error('Maintenance interval must be positive');
    }
    this.config.defaultMaintenanceIntervalMinutes = minutes;
    this.logger.log(`Default maintenance interval set to ${minutes} minutes`);
  }
}
