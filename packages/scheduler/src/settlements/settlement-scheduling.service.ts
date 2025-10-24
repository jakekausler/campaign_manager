/**
 * Settlement Scheduling Service
 * Manages periodic growth events for settlements (population, resources, level progression)
 */

import { Injectable, Logger } from '@nestjs/common';

import { ApiClientService, SettlementSummary } from '../api/api-client.service';
import { JobType } from '../queue/job-types.enum';
import { JobPriority } from '../queue/job.interface';
import { QueueService } from '../queue/queue.service';

/**
 * Growth event types for settlements
 */
export enum GrowthEventType {
  POPULATION_GROWTH = 'POPULATION_GROWTH',
  RESOURCE_GENERATION = 'RESOURCE_GENERATION',
  LEVEL_UP_CHECK = 'LEVEL_UP_CHECK',
}

/**
 * Growth calculation result
 */
export interface GrowthCalculation {
  campaignId: string;
  settlementId: string;
  eventType: GrowthEventType;
  nextExecutionTime: Date;
  parameters: Record<string, unknown>;
}

/**
 * Result of processing settlement growth
 */
export interface ProcessGrowthResult {
  totalSettlements: number;
  jobsQueued: number;
  errors: number;
  errorMessages: string[];
}

/**
 * Configuration for settlement growth
 */
interface GrowthConfig {
  // Base intervals in minutes for each growth type
  populationGrowthIntervalMinutes: number;
  resourceGenerationIntervalMinutes: number;
  levelCheckIntervalMinutes: number;
  // Growth rate multipliers based on settlement level
  levelGrowthMultipliers: Map<number, number>;
}

@Injectable()
export class SettlementSchedulingService {
  private readonly logger = new Logger(SettlementSchedulingService.name);
  private readonly config: GrowthConfig;

  constructor(
    private readonly apiClientService: ApiClientService,
    private readonly queueService: QueueService
  ) {
    // Default configuration
    this.config = {
      populationGrowthIntervalMinutes: 60, // 1 hour
      resourceGenerationIntervalMinutes: 60, // 1 hour
      levelCheckIntervalMinutes: 360, // 6 hours
      levelGrowthMultipliers: new Map([
        [1, 1.0], // Level 1: baseline
        [2, 0.9], // Level 2: 10% faster
        [3, 0.8], // Level 3: 20% faster
        [4, 0.7], // Level 4: 30% faster
        [5, 0.6], // Level 5: 40% faster
      ]),
    };
  }

  /**
   * Process settlement growth for all campaigns.
   * This is the entry point called by the cron scheduler.
   *
   * @returns Result summary with counts and details
   */
  async processAllSettlements(): Promise<ProcessGrowthResult> {
    this.logger.log('Processing settlement growth for all campaigns');

    const result: ProcessGrowthResult = {
      totalSettlements: 0,
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

      this.logger.log(`Processing settlements across ${campaignIds.length} campaign(s)`);

      // Process each campaign
      for (const campaignId of campaignIds) {
        try {
          const campaignResult = await this.processSettlementsForCampaign(campaignId);
          result.totalSettlements += campaignResult.totalSettlements;
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
        `Settlement growth processing complete: ` +
          `${result.totalSettlements} settlement(s) checked, ` +
          `${result.jobsQueued} job(s) queued, ` +
          `${result.errors} error(s)`
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process settlement growth: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Process settlement growth for a specific campaign
   *
   * @param campaignId - The campaign ID
   * @returns Result summary
   */
  async processSettlementsForCampaign(campaignId: string): Promise<ProcessGrowthResult> {
    this.logger.log(`Processing settlement growth for campaign ${campaignId}`);

    const result: ProcessGrowthResult = {
      totalSettlements: 0,
      jobsQueued: 0,
      errors: 0,
      errorMessages: [],
    };

    try {
      // Query API for settlements in this campaign
      const settlements = await this.getSettlementsForCampaign(campaignId);
      result.totalSettlements = settlements.length;

      if (settlements.length === 0) {
        this.logger.debug(`No settlements found in campaign ${campaignId}`);
        return result;
      }

      this.logger.log(`Found ${settlements.length} settlement(s) in campaign ${campaignId}`);

      // Process each settlement
      for (const settlement of settlements) {
        try {
          const growthEvents = await this.scheduleGrowthForSettlement(settlement);
          result.jobsQueued += growthEvents.length;
        } catch (error) {
          result.errors++;
          result.errorMessages.push(
            `Settlement ${settlement.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      this.logger.log(
        `Completed settlement growth processing for campaign ${campaignId}: ` +
          `${result.jobsQueued} job(s) queued, ${result.errors} error(s)`
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process settlements for campaign ${campaignId}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Schedule growth events for a single settlement
   *
   * @param settlement - Settlement to schedule growth for
   * @returns Array of growth calculations that were queued
   */
  private async scheduleGrowthForSettlement(
    settlement: SettlementSummary
  ): Promise<GrowthCalculation[]> {
    this.logger.debug(`Scheduling growth for settlement ${settlement.id} (${settlement.name})`);

    // Calculate growth events
    const growthEvents = this.calculateGrowthEvents(settlement);

    // Queue jobs for each growth event
    for (const event of growthEvents) {
      await this.queueGrowthJob(event);
    }

    this.logger.debug(
      `Queued ${growthEvents.length} growth job(s) for settlement ${settlement.id}`
    );

    return growthEvents;
  }

  /**
   * Calculate growth events for a settlement based on level and variables
   *
   * @param settlement - Settlement data
   * @returns Array of growth calculations
   */
  private calculateGrowthEvents(settlement: SettlementSummary): GrowthCalculation[] {
    const calculations: GrowthCalculation[] = [];

    // Get level multiplier (defaults to 1.0 for unknown levels)
    const levelMultiplier = this.config.levelGrowthMultipliers.get(settlement.level) || 1.0;

    // Check for custom growth rates in settlement variables
    const customPopulationInterval =
      (settlement.variables.populationGrowthIntervalMinutes as number) || null;
    const customResourceInterval =
      (settlement.variables.resourceGenerationIntervalMinutes as number) || null;

    // Population growth calculation
    const populationInterval =
      customPopulationInterval || this.config.populationGrowthIntervalMinutes * levelMultiplier;

    calculations.push({
      campaignId: settlement.campaignId,
      settlementId: settlement.id,
      eventType: GrowthEventType.POPULATION_GROWTH,
      nextExecutionTime: new Date(Date.now() + populationInterval * 60 * 1000),
      parameters: {
        growthRate: settlement.variables.populationGrowthRate || 0.05, // 5% default
        currentPopulation: settlement.variables.population || 100,
        populationCap: settlement.variables.populationCap || 1000,
      },
    });

    // Resource generation calculation
    const resourceInterval =
      customResourceInterval || this.config.resourceGenerationIntervalMinutes * levelMultiplier;

    calculations.push({
      campaignId: settlement.campaignId,
      settlementId: settlement.id,
      eventType: GrowthEventType.RESOURCE_GENERATION,
      nextExecutionTime: new Date(Date.now() + resourceInterval * 60 * 1000),
      parameters: {
        resourceTypes: settlement.variables.resourceTypes || ['food', 'gold', 'materials'],
        generationRates: settlement.variables.generationRates || {
          food: 10,
          gold: 5,
          materials: 3,
        },
      },
    });

    // Level-up check calculation
    const levelCheckInterval = this.config.levelCheckIntervalMinutes * levelMultiplier;

    calculations.push({
      campaignId: settlement.campaignId,
      settlementId: settlement.id,
      eventType: GrowthEventType.LEVEL_UP_CHECK,
      nextExecutionTime: new Date(Date.now() + levelCheckInterval * 60 * 1000),
      parameters: {
        currentLevel: settlement.level,
        population: settlement.variables.population || 100,
        populationThreshold: (settlement.level + 1) * 500, // Simple threshold: level * 500
        requiredStructures: settlement.variables.requiredStructuresForLevelUp || [],
      },
    });

    return calculations;
  }

  /**
   * Queue a growth job for execution
   *
   * @param calculation - Growth calculation with timing and parameters
   */
  private async queueGrowthJob(calculation: GrowthCalculation): Promise<void> {
    const delay = calculation.nextExecutionTime.getTime() - Date.now();

    if (delay < 0) {
      this.logger.warn(
        `Growth event ${calculation.eventType} for settlement ${calculation.settlementId} ` +
          `is already overdue, queuing immediately`
      );
    }

    // Construct the job data object with literal type
    const jobData: {
      type: JobType.SETTLEMENT_GROWTH;
      campaignId: string;
      settlementId: string;
      eventType: string;
      parameters: Record<string, unknown>;
      priority: JobPriority;
    } = {
      type: JobType.SETTLEMENT_GROWTH,
      campaignId: calculation.campaignId,
      settlementId: calculation.settlementId,
      eventType: calculation.eventType,
      parameters: calculation.parameters,
      priority: JobPriority.NORMAL,
    };

    await this.queueService.addJob(jobData, {
      delay: Math.max(0, delay),
    });

    this.logger.debug(
      `Queued ${calculation.eventType} job for settlement ${calculation.settlementId} ` +
        `(delay: ${Math.round(delay / 1000)}s)`
    );
  }

  /**
   * Query the API for settlements in a campaign
   *
   * @param campaignId - Campaign ID
   * @returns Array of settlement summaries
   */
  private async getSettlementsForCampaign(campaignId: string): Promise<SettlementSummary[]> {
    this.logger.debug(`Querying settlements for campaign ${campaignId}`);

    try {
      const settlements = await this.apiClientService.getSettlementsByCampaign(campaignId);
      return settlements;
    } catch (error) {
      this.logger.error(
        `Failed to query settlements for campaign ${campaignId}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Get growth configuration
   *
   * @returns Current growth configuration
   */
  getConfig(): GrowthConfig {
    return { ...this.config };
  }

  /**
   * Set population growth interval (minutes)
   *
   * @param minutes - Interval in minutes
   */
  setPopulationGrowthInterval(minutes: number): void {
    if (minutes <= 0) {
      throw new Error('Population growth interval must be positive');
    }
    this.config.populationGrowthIntervalMinutes = minutes;
    this.logger.log(`Population growth interval set to ${minutes} minutes`);
  }

  /**
   * Set resource generation interval (minutes)
   *
   * @param minutes - Interval in minutes
   */
  setResourceGenerationInterval(minutes: number): void {
    if (minutes <= 0) {
      throw new Error('Resource generation interval must be positive');
    }
    this.config.resourceGenerationIntervalMinutes = minutes;
    this.logger.log(`Resource generation interval set to ${minutes} minutes`);
  }

  /**
   * Set level check interval (minutes)
   *
   * @param minutes - Interval in minutes
   */
  setLevelCheckInterval(minutes: number): void {
    if (minutes <= 0) {
      throw new Error('Level check interval must be positive');
    }
    this.config.levelCheckIntervalMinutes = minutes;
    this.logger.log(`Level check interval set to ${minutes} minutes`);
  }

  /**
   * Set growth multiplier for a specific level
   *
   * @param level - Settlement level
   * @param multiplier - Growth rate multiplier
   */
  setLevelGrowthMultiplier(level: number, multiplier: number): void {
    if (level <= 0) {
      throw new Error('Level must be positive');
    }
    if (multiplier <= 0) {
      throw new Error('Multiplier must be positive');
    }
    this.config.levelGrowthMultipliers.set(level, multiplier);
    this.logger.log(`Level ${level} growth multiplier set to ${multiplier}`);
  }
}
