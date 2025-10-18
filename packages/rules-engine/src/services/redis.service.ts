import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

import { CacheService } from './cache.service';
import { DependencyGraphService } from './dependency-graph.service';

/**
 * Message format for cache invalidation events
 */
interface InvalidationMessage {
  campaignId: string;
  branchId?: string;
  entityType?: string;
  entityId?: string;
  timestamp: string;
}

/**
 * RedisService - Manages Redis pub/sub connections for cache invalidation
 *
 * Subscribes to invalidation events from the API service and triggers
 * appropriate cache and dependency graph invalidations.
 *
 * Channels:
 * - condition.created - When field conditions are created
 * - condition.updated - When field conditions are updated
 * - condition.deleted - When field conditions are deleted
 * - variable.created - When state variables are created
 * - variable.updated - When state variables are updated
 * - variable.deleted - When state variables are deleted
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private subscriber: Redis | null = null;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private reconnectAttempts = 0;
  private isShuttingDown = false;

  constructor(
    private readonly cacheService: CacheService,
    private readonly dependencyGraphService: DependencyGraphService
  ) {}

  /**
   * Initialize Redis subscriber on module startup
   */
  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  /**
   * Clean up Redis connections on module shutdown
   */
  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    if (this.subscriber) {
      this.logger.log('Disconnecting from Redis...');
      await this.subscriber.quit();
      this.subscriber = null;
    }
  }

  /**
   * Establish Redis connection and subscribe to channels
   */
  private async connect(): Promise<void> {
    try {
      const host = process.env.REDIS_HOST || 'localhost';
      const port = parseInt(process.env.REDIS_PORT || '6379', 10);
      const password = process.env.REDIS_PASSWORD;
      const db = parseInt(process.env.REDIS_DB || '0', 10);

      this.logger.log(`Connecting to Redis at ${host}:${port}...`);

      this.subscriber = new Redis({
        host,
        port,
        password,
        db,
        retryStrategy: (times) => {
          if (this.isShuttingDown) {
            return null; // Stop retrying during shutdown
          }
          if (times > this.MAX_RECONNECT_ATTEMPTS) {
            this.logger.error(
              `Max reconnection attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`
            );
            return null;
          }
          const delay = Math.min(times * 1000, 10000); // Max 10 seconds
          this.logger.warn(
            `Redis connection lost. Retrying in ${delay}ms (attempt ${times}/${this.MAX_RECONNECT_ATTEMPTS})`
          );
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      // Connection event handlers
      this.subscriber.on('connect', () => {
        this.reconnectAttempts = 0;
        this.logger.log('Connected to Redis successfully');
      });

      this.subscriber.on('ready', async () => {
        this.logger.log('Redis subscriber ready');
        await this.subscribeToChannels();
      });

      this.subscriber.on('error', (error) => {
        this.logger.error(`Redis error: ${error.message}`);
      });

      this.subscriber.on('close', () => {
        if (!this.isShuttingDown) {
          this.logger.warn('Redis connection closed unexpectedly');
        }
      });

      this.subscriber.on('reconnecting', () => {
        this.reconnectAttempts++;
        this.logger.log('Reconnecting to Redis...');
      });

      // Message handler
      this.subscriber.on('message', (channel, message) => {
        this.handleMessage(channel, message);
      });
    } catch (error) {
      this.logger.error(
        `Failed to connect to Redis: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Subscribe to all invalidation channels
   */
  private async subscribeToChannels(): Promise<void> {
    if (!this.subscriber) {
      this.logger.error('Cannot subscribe: Redis subscriber not initialized');
      return;
    }

    try {
      const channels = [
        'condition.created',
        'condition.updated',
        'condition.deleted',
        'variable.created',
        'variable.updated',
        'variable.deleted',
      ];

      await this.subscriber.subscribe(...channels);
      this.logger.log(`Subscribed to channels: ${channels.join(', ')}`);
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to channels: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle incoming invalidation messages
   */
  private handleMessage(channel: string, messageStr: string): void {
    try {
      const message: InvalidationMessage = JSON.parse(messageStr);
      const { campaignId, branchId = 'main' } = message;

      this.logger.debug(
        `Received message on ${channel}: campaignId=${campaignId}, branchId=${branchId}`
      );

      // Validate message
      if (!campaignId) {
        this.logger.warn(`Invalid message on ${channel}: missing campaignId`);
        return;
      }

      switch (channel) {
        case 'condition.created':
          this.handleConditionCreated(message);
          break;
        case 'condition.updated':
          this.handleConditionUpdated(message);
          break;
        case 'condition.deleted':
          this.handleConditionDeleted(message);
          break;
        case 'variable.created':
          this.handleVariableCreated(message);
          break;
        case 'variable.updated':
          this.handleVariableUpdated(message);
          break;
        case 'variable.deleted':
          this.handleVariableDeleted(message);
          break;
        default:
          this.logger.warn(`Unknown channel: ${channel}`);
      }
    } catch (error) {
      this.logger.error(
        `Error handling message from ${channel}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle condition.created event
   * Invalidates dependency graph to include new condition
   */
  private handleConditionCreated(message: InvalidationMessage): void {
    const { campaignId, branchId = 'main', entityId } = message;
    this.logger.log(
      `Handling condition.created: campaignId=${campaignId}, conditionId=${entityId}`
    );

    // Invalidate dependency graph so new condition is included
    this.dependencyGraphService.invalidateGraph(campaignId, branchId);
  }

  /**
   * Handle condition.updated event
   * Invalidates cache and dependency graph since expression may have changed
   */
  private handleConditionUpdated(message: InvalidationMessage): void {
    const { campaignId, branchId = 'main', entityId } = message;
    this.logger.log(
      `Handling condition.updated: campaignId=${campaignId}, conditionId=${entityId}`
    );

    // Invalidate cache for this condition
    if (entityId) {
      this.cacheService.invalidate({
        campaignId,
        branchId,
        nodeId: `CONDITION:${entityId}`,
      });
    }

    // Invalidate dependency graph since expression may have changed
    this.dependencyGraphService.invalidateGraph(campaignId, branchId);
  }

  /**
   * Handle condition.deleted event
   * Invalidates cache and dependency graph
   */
  private handleConditionDeleted(message: InvalidationMessage): void {
    const { campaignId, branchId = 'main', entityId } = message;
    this.logger.log(
      `Handling condition.deleted: campaignId=${campaignId}, conditionId=${entityId}`
    );

    // Invalidate cache for this condition
    if (entityId) {
      this.cacheService.invalidate({
        campaignId,
        branchId,
        nodeId: `CONDITION:${entityId}`,
      });
    }

    // Invalidate dependency graph since condition is removed
    this.dependencyGraphService.invalidateGraph(campaignId, branchId);
  }

  /**
   * Handle variable.created event
   * Invalidates dependency graph to include new variable
   */
  private handleVariableCreated(message: InvalidationMessage): void {
    const { campaignId, branchId = 'main', entityId } = message;
    this.logger.log(`Handling variable.created: campaignId=${campaignId}, variableId=${entityId}`);

    // Invalidate dependency graph so new variable is included
    this.dependencyGraphService.invalidateGraph(campaignId, branchId);
  }

  /**
   * Handle variable.updated event
   * Invalidates cache for dependent conditions and updates dependency graph
   */
  private handleVariableUpdated(message: InvalidationMessage): void {
    const { campaignId, branchId = 'main', entityId } = message;
    this.logger.log(`Handling variable.updated: campaignId=${campaignId}, variableId=${entityId}`);

    // Invalidate all cache entries that depend on this variable
    // Use wildcard invalidation for all conditions in this campaign/branch
    this.cacheService.invalidateByPrefix(campaignId, branchId);

    // Note: We don't rebuild dependency graph here because the variable update
    // doesn't change the graph structure, only the values. The graph only needs
    // to be rebuilt when variable relationships change (creation/deletion).
  }

  /**
   * Handle variable.deleted event
   * Invalidates cache and dependency graph
   */
  private handleVariableDeleted(message: InvalidationMessage): void {
    const { campaignId, branchId = 'main', entityId } = message;
    this.logger.log(`Handling variable.deleted: campaignId=${campaignId}, variableId=${entityId}`);

    // Invalidate all cache entries that might have used this variable
    this.cacheService.invalidateByPrefix(campaignId, branchId);

    // Invalidate dependency graph since variable is removed
    this.dependencyGraphService.invalidateGraph(campaignId, branchId);
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.subscriber?.status === 'ready';
  }

  /**
   * Get current connection status
   */
  getStatus(): string {
    return this.subscriber?.status || 'disconnected';
  }
}
