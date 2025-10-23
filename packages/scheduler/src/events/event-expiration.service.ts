/**
 * Event Expiration Service
 * Manages detection and marking of overdue events
 */

import { Injectable, Logger } from '@nestjs/common';

import { ApiClientService, EventSummary } from '../api/api-client.service';

/**
 * Result of processing event expiration
 */
export interface ProcessExpirationResult {
  totalChecked: number;
  expired: number;
  errors: number;
  expiredEventIds: string[];
  errorMessages: string[];
}

/**
 * Configuration for expiration grace period
 */
interface ExpirationConfig {
  gracePeriodMinutes: number;
}

@Injectable()
export class EventExpirationService {
  private readonly logger = new Logger(EventExpirationService.name);
  private readonly config: ExpirationConfig;

  constructor(private readonly apiClientService: ApiClientService) {
    // Default grace period: 5 minutes
    // This prevents premature expiration due to scheduling delays
    this.config = {
      gracePeriodMinutes: 5,
    };
  }

  /**
   * Process event expiration for a specific campaign.
   * Queries the API for overdue events and marks them as expired.
   *
   * @param campaignId - The campaign ID to check for expired events
   * @returns Result summary with counts and details
   */
  async processExpiration(campaignId: string): Promise<ProcessExpirationResult> {
    this.logger.log(`Processing event expiration for campaign ${campaignId}`);

    const result: ProcessExpirationResult = {
      totalChecked: 0,
      expired: 0,
      errors: 0,
      expiredEventIds: [],
      errorMessages: [],
    };

    try {
      // Query API for overdue events
      const overdueEvents = await this.getOverdueEvents(campaignId);
      result.totalChecked = overdueEvents.length;

      if (overdueEvents.length === 0) {
        this.logger.debug(`No overdue events found for campaign ${campaignId}`);
        return result;
      }

      this.logger.log(`Found ${overdueEvents.length} overdue event(s) in campaign ${campaignId}`);

      // Process events in batches to avoid overwhelming the API
      const batchSize = 10;
      for (let i = 0; i < overdueEvents.length; i += batchSize) {
        const batch = overdueEvents.slice(i, i + batchSize);
        await this.processBatch(batch, result);
      }

      this.logger.log(
        `Expiration processing complete for campaign ${campaignId}: ` +
          `${result.expired} expired, ${result.errors} errors`
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process event expiration for campaign ${campaignId}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Process event expiration for all campaigns.
   * This is the entry point called by the job processor.
   *
   * @returns Combined result summary for all campaigns
   */
  async processAllCampaigns(): Promise<ProcessExpirationResult> {
    this.logger.log('Processing event expiration for all campaigns');

    const combinedResult: ProcessExpirationResult = {
      totalChecked: 0,
      expired: 0,
      errors: 0,
      expiredEventIds: [],
      errorMessages: [],
    };

    try {
      // Query API for all campaign IDs
      const campaignIds = await this.getAllCampaignIds();

      if (campaignIds.length === 0) {
        this.logger.debug('No campaigns found');
        return combinedResult;
      }

      this.logger.log(`Processing ${campaignIds.length} campaign(s)`);

      // Process each campaign
      for (const campaignId of campaignIds) {
        try {
          const result = await this.processExpiration(campaignId);
          combinedResult.totalChecked += result.totalChecked;
          combinedResult.expired += result.expired;
          combinedResult.errors += result.errors;
          combinedResult.expiredEventIds.push(...result.expiredEventIds);
          combinedResult.errorMessages.push(...result.errorMessages);
        } catch (error) {
          combinedResult.errors++;
          combinedResult.errorMessages.push(
            `Campaign ${campaignId}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      this.logger.log(
        `Expiration processing complete for all campaigns: ` +
          `${combinedResult.expired} expired, ${combinedResult.errors} errors`
      );

      return combinedResult;
    } catch (error) {
      this.logger.error(
        `Failed to process event expiration for all campaigns: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Query the API for overdue events in a campaign.
   * Overdue = scheduledAt < currentWorldTime - gracePeriod AND isCompleted = false
   *
   * @param campaignId - The campaign ID
   * @returns Array of overdue event summaries
   */
  private async getOverdueEvents(campaignId: string): Promise<EventSummary[]> {
    this.logger.debug(`Querying overdue events for campaign ${campaignId}`);

    try {
      const events = await this.apiClientService.getOverdueEvents(campaignId);
      return events;
    } catch (error) {
      this.logger.error(
        `Failed to query overdue events for campaign ${campaignId}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Get all campaign IDs from the API
   *
   * @returns Array of campaign IDs
   */
  private async getAllCampaignIds(): Promise<string[]> {
    this.logger.debug('Querying all campaign IDs');

    try {
      const campaignIds = await this.apiClientService.getAllCampaignIds();
      return campaignIds;
    } catch (error) {
      this.logger.error(
        `Failed to query campaign IDs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Process a batch of overdue events, marking them as expired
   *
   * @param events - Batch of events to process
   * @param result - Result object to update
   */
  private async processBatch(
    events: EventSummary[],
    result: ProcessExpirationResult
  ): Promise<void> {
    this.logger.debug(`Processing batch of ${events.length} event(s)`);

    const promises = events.map(async (event) => {
      try {
        await this.expireEvent(event.id, event.campaignId);
        result.expired++;
        result.expiredEventIds.push(event.id);
        this.logger.log(
          `Marked event ${event.id} (${event.name}) as expired in campaign ${event.campaignId}`
        );
      } catch (error) {
        result.errors++;
        const errorMsg = `Event ${event.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errorMessages.push(errorMsg);
        this.logger.error(`Failed to expire event ${event.id}: ${errorMsg}`);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Mark a single event as expired via API mutation
   *
   * @param eventId - The event ID to expire
   * @param campaignId - The campaign ID
   */
  private async expireEvent(eventId: string, campaignId: string): Promise<void> {
    this.logger.debug(`Expiring event ${eventId} in campaign ${campaignId}`);

    try {
      await this.apiClientService.expireEvent(eventId);
      this.logger.debug(`Successfully expired event ${eventId}`);
    } catch (error) {
      this.logger.error(
        `Failed to expire event ${eventId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Get the configured grace period in minutes
   *
   * @returns Grace period in minutes
   */
  getGracePeriodMinutes(): number {
    return this.config.gracePeriodMinutes;
  }

  /**
   * Set the grace period in minutes
   *
   * @param minutes - Grace period in minutes
   */
  setGracePeriodMinutes(minutes: number): void {
    if (minutes < 0) {
      throw new Error('Grace period must be non-negative');
    }
    this.config.gracePeriodMinutes = minutes;
    this.logger.log(`Grace period set to ${minutes} minutes`);
  }
}
