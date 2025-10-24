/**
 * Redis Subscriber Service
 * Subscribes to Redis pub/sub channels for real-time reactivity to campaign events
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

import { ConfigService } from '../config/config.service';
import { JobPriority, JobType } from '../queue/job.interface';
import { QueueService } from '../queue/queue.service';

import {
  EntityModifiedMessage,
  EntityOperation,
  EntityType,
  RedisChannels,
  WorldTimeAdvancedMessage,
} from './types';

@Injectable()
export class RedisSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisSubscriberService.name);
  private subscriber: Redis | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  // Cooldown tracking to prevent rapid time advance processing
  private lastWorldTimeProcessed = new Map<string, number>();
  private readonly worldTimeProcessCooldownMs = 5000; // 5 seconds

  constructor(
    private readonly configService: ConfigService,
    private readonly queueService: QueueService
  ) {}

  /**
   * Module initialization hook - connect to Redis and subscribe to channels
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing Redis subscriber service');
    await this.connect();
  }

  /**
   * Module destruction hook - gracefully disconnect from Redis
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down Redis subscriber service');
    this.isShuttingDown = true;

    // Clear cooldown tracking to prevent memory leaks
    this.lastWorldTimeProcessed.clear();

    await this.disconnect();
  }

  /**
   * Connect to Redis and subscribe to channels
   */
  private async connect(): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.debug('Service is shutting down, skipping connection');
      return;
    }

    try {
      this.logger.debug('Creating Redis subscriber connection');

      // Create a separate Redis connection for pub/sub
      // Bull already uses the main connection, so we need a dedicated subscriber
      this.subscriber = new Redis(this.configService.redisUrl, {
        // Disable automatic retries - we'll handle reconnection manually
        retryStrategy: () => null,
        // Shorter timeout for faster failure detection
        connectTimeout: 10000,
        // Enable keep-alive
        keepAlive: 30000,
        lazyConnect: false,
      });

      // Set up error handler
      this.subscriber.on('error', (error) => {
        this.logger.error(`Redis subscriber error: ${error.message}`);
        // Don't reconnect on error - wait for disconnect event
      });

      // Set up disconnect handler with reconnection logic
      this.subscriber.on('close', () => {
        if (this.isShuttingDown) {
          this.logger.debug('Redis connection closed during shutdown');
          return;
        }

        this.logger.warn('Redis subscriber connection closed');
        this.handleDisconnect();
      });

      // Set up ready handler
      this.subscriber.on('ready', () => {
        this.logger.log('Redis subscriber connection established');
        this.reconnectAttempts = 0;
      });

      // Set up message handler
      this.subscriber.on('pmessage', this.handleMessage.bind(this));

      // Subscribe to channel patterns
      await this.subscribeToChannels();

      this.logger.log('Redis subscriber service initialized successfully');
    } catch (error) {
      this.logger.error(
        `Failed to connect to Redis: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      this.handleDisconnect();
    }
  }

  /**
   * Subscribe to Redis channels using pattern matching
   */
  private async subscribeToChannels(): Promise<void> {
    if (!this.subscriber) {
      throw new Error('Redis subscriber not initialized');
    }

    try {
      // Subscribe to all world time advanced channels across all campaigns
      await this.subscriber.psubscribe(RedisChannels.allWorldTimeAdvanced);
      this.logger.log(`Subscribed to pattern: ${RedisChannels.allWorldTimeAdvanced}`);

      // Subscribe to all entity modified channels across all campaigns
      await this.subscriber.psubscribe(RedisChannels.allEntityModified);
      this.logger.log(`Subscribed to pattern: ${RedisChannels.allEntityModified}`);
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to channels: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Handle disconnection with exponential backoff reconnection
   */
  private handleDisconnect(): void {
    if (this.isShuttingDown) {
      return;
    }

    // Check before incrementing - if we've already hit max, don't schedule another attempt
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(
        `Max reconnection attempts (${this.maxReconnectAttempts}) reached. Giving up.`
      );
      // In a production system, you might want to trigger an alert here
      return;
    }

    // Calculate exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 60s (capped at 60s for more responsive reconnection)
    const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 60000);
    this.reconnectAttempts++;

    this.logger.log(
      `Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} ` +
        `in ${backoffMs}ms`
    );

    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, backoffMs);
  }

  /**
   * Handle incoming Redis messages
   */
  private handleMessage(pattern: string, channel: string, message: string): void {
    this.logger.debug(`Received message on channel ${channel} (pattern: ${pattern})`);

    try {
      // Route message to appropriate handler based on pattern
      if (pattern === RedisChannels.allWorldTimeAdvanced) {
        this.handleWorldTimeAdvancedMessage(message);
      } else if (pattern === RedisChannels.allEntityModified) {
        this.handleEntityModifiedMessage(message);
      } else {
        this.logger.warn(`Unknown channel pattern: ${pattern}`);
      }
    } catch (error) {
      this.logger.error(
        `Error handling message on channel ${channel}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle world time advanced messages
   */
  private handleWorldTimeAdvancedMessage(message: string): void {
    try {
      const payload: WorldTimeAdvancedMessage = JSON.parse(message);

      this.logger.log(
        `World time advanced in campaign ${payload.campaignId}: ` +
          `${payload.previousTime} -> ${payload.newTime}`
      );

      // Trigger immediate event expiration check with HIGH priority
      // Execute asynchronously but don't wait for completion to avoid blocking message processing
      this.onWorldTimeAdvanced(payload).catch((error) => {
        this.logger.error(
          `Unexpected error in onWorldTimeAdvanced: ` +
            `${error instanceof Error ? error.message : 'Unknown error'}`
        );
      });
    } catch (error) {
      this.logger.error(
        `Failed to parse world time advanced message: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle entity modified messages
   */
  private handleEntityModifiedMessage(message: string): void {
    try {
      const payload: EntityModifiedMessage = JSON.parse(message);

      this.logger.log(
        `Entity modified in campaign ${payload.campaignId}: ` +
          `${payload.entityType} ${payload.entityId} (${payload.operation})`
      );

      // Route to appropriate handler based on entity type
      this.onEntityModified(payload);
    } catch (error) {
      this.logger.error(
        `Failed to parse entity modified message: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handler for world time advanced events
   */
  private async onWorldTimeAdvanced(message: WorldTimeAdvancedMessage): Promise<void> {
    // Check cooldown to prevent rapid repeated processing
    const now = Date.now();
    const lastTime = this.lastWorldTimeProcessed.get(message.campaignId) || 0;

    if (now - lastTime < this.worldTimeProcessCooldownMs) {
      this.logger.debug(
        `Skipping world time advanced for campaign ${message.campaignId} - within cooldown period (${this.worldTimeProcessCooldownMs}ms)`
      );
      return;
    }

    // Update last processed time
    this.lastWorldTimeProcessed.set(message.campaignId, now);

    // Process each operation independently to prevent one failure from blocking others
    // Queue jobs instead of calling services directly to prevent thundering herd

    // 1. Queue immediate event expiration check with HIGH priority
    try {
      const expirationJobData: {
        type: JobType.EVENT_EXPIRATION;
        campaignId: string;
        priority: JobPriority;
      } = {
        type: JobType.EVENT_EXPIRATION,
        campaignId: message.campaignId,
        priority: JobPriority.HIGH,
      };

      await this.queueService.addJob(expirationJobData);
      this.logger.debug(`Queued event expiration check for campaign ${message.campaignId}`);
    } catch (error) {
      this.logger.error(
        `Failed to queue event expiration for campaign ${message.campaignId}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // 2. Queue settlement schedule recalculation with NORMAL priority
    try {
      const settlementJobData: {
        type: JobType.RECALCULATE_SETTLEMENT_SCHEDULES;
        campaignId: string;
        priority: JobPriority;
      } = {
        type: JobType.RECALCULATE_SETTLEMENT_SCHEDULES,
        campaignId: message.campaignId,
        priority: JobPriority.NORMAL,
      };

      await this.queueService.addJob(settlementJobData);
      this.logger.debug(
        `Queued settlement schedule recalculation for campaign ${message.campaignId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue settlement schedule recalculation for campaign ${message.campaignId}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // 3. Queue structure schedule recalculation with NORMAL priority
    try {
      const structureJobData: {
        type: JobType.RECALCULATE_STRUCTURE_SCHEDULES;
        campaignId: string;
        priority: JobPriority;
      } = {
        type: JobType.RECALCULATE_STRUCTURE_SCHEDULES,
        campaignId: message.campaignId,
        priority: JobPriority.NORMAL,
      };

      await this.queueService.addJob(structureJobData);
      this.logger.debug(
        `Queued structure schedule recalculation for campaign ${message.campaignId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue structure schedule recalculation for campaign ${message.campaignId}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handler for entity modified events
   */
  private async onEntityModified(message: EntityModifiedMessage): Promise<void> {
    try {
      switch (message.entityType) {
        case EntityType.SETTLEMENT:
          await this.handleSettlementModified(message);
          break;

        case EntityType.STRUCTURE:
          await this.handleStructureModified(message);
          break;

        case EntityType.EVENT:
        case EntityType.ENCOUNTER:
          // Event and Encounter modifications are handled by expiration check
          // No immediate action needed here
          this.logger.debug(
            `${message.entityType} ${message.entityId} modified - ` +
              `will be picked up by next expiration check`
          );
          break;

        default:
          this.logger.warn(`Unknown entity type: ${message.entityType}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle entity modified for ${message.entityType} ${message.entityId}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Don't rethrow - we want to continue processing other messages
    }
  }

  /**
   * Handle settlement modification - update growth schedule for that settlement
   */
  private async handleSettlementModified(message: EntityModifiedMessage): Promise<void> {
    if (message.operation === EntityOperation.DELETE) {
      this.logger.debug(`Settlement ${message.entityId} deleted - no scheduling needed`);
      return;
    }

    try {
      // Queue settlement schedule recalculation for the campaign
      // We don't have a method to schedule a single settlement, so we process the whole campaign
      // This is acceptable since settlement modifications are relatively rare
      const jobData: {
        type: JobType.RECALCULATE_SETTLEMENT_SCHEDULES;
        campaignId: string;
        priority: JobPriority;
      } = {
        type: JobType.RECALCULATE_SETTLEMENT_SCHEDULES,
        campaignId: message.campaignId,
        priority: JobPriority.NORMAL,
      };

      await this.queueService.addJob(jobData);
      this.logger.debug(
        `Queued settlement schedule recalculation for campaign ${message.campaignId} ` +
          `after settlement ${message.entityId} was ${message.operation.toLowerCase()}d`
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue settlement schedule recalculation for settlement ${message.entityId}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle structure modification - update maintenance schedule for that structure
   */
  private async handleStructureModified(message: EntityModifiedMessage): Promise<void> {
    if (message.operation === EntityOperation.DELETE) {
      this.logger.debug(`Structure ${message.entityId} deleted - no scheduling needed`);
      return;
    }

    try {
      // Queue structure schedule recalculation for the campaign
      // We don't have a method to schedule a single structure, so we process the whole campaign
      // This is acceptable since structure modifications are relatively rare
      const jobData: {
        type: JobType.RECALCULATE_STRUCTURE_SCHEDULES;
        campaignId: string;
        priority: JobPriority;
      } = {
        type: JobType.RECALCULATE_STRUCTURE_SCHEDULES,
        campaignId: message.campaignId,
        priority: JobPriority.NORMAL,
      };

      await this.queueService.addJob(jobData);
      this.logger.debug(
        `Queued structure schedule recalculation for campaign ${message.campaignId} ` +
          `after structure ${message.entityId} was ${message.operation.toLowerCase()}d`
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue structure schedule recalculation for structure ${message.entityId}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Gracefully disconnect from Redis
   */
  private async disconnect(): Promise<void> {
    // Clear any pending reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.subscriber) {
      try {
        // Unsubscribe from all channels
        await this.subscriber.punsubscribe();
        this.logger.debug('Unsubscribed from all channels');

        // Disconnect
        this.subscriber.disconnect();
        this.logger.log('Redis subscriber disconnected');
      } catch (error) {
        this.logger.error(
          `Error during disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      } finally {
        this.subscriber = null;
      }
    }
  }

  /**
   * Get connection status (for health checks)
   */
  isConnected(): boolean {
    return this.subscriber?.status === 'ready';
  }

  /**
   * Get number of reconnection attempts (for monitoring)
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}
