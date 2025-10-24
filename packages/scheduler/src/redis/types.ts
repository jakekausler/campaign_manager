/**
 * Redis Pub/Sub Message Types
 * Defines the structure of messages published to Redis channels
 */

/**
 * Message payload when world time advances in a campaign
 */
export interface WorldTimeAdvancedMessage {
  /** Campaign ID where time advanced */
  campaignId: string;

  /** Previous world time (ISO 8601 timestamp) */
  previousTime: string;

  /** New world time (ISO 8601 timestamp) */
  newTime: string;
}

/**
 * Entity types that can be modified
 */
export enum EntityType {
  SETTLEMENT = 'Settlement',
  STRUCTURE = 'Structure',
  EVENT = 'Event',
  ENCOUNTER = 'Encounter',
}

/**
 * Operations that can be performed on entities
 */
export enum EntityOperation {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

/**
 * Message payload when an entity is modified in a campaign
 */
export interface EntityModifiedMessage {
  /** Campaign ID where entity was modified */
  campaignId: string;

  /** Type of entity that was modified */
  entityType: EntityType;

  /** ID of the entity that was modified */
  entityId: string;

  /** Operation performed on the entity */
  operation: EntityOperation;
}

/**
 * Redis channel patterns for pub/sub
 */
export const RedisChannels = {
  /**
   * Get the world time advanced channel for a campaign
   */
  worldTimeAdvanced: (campaignId: string) => `campaign.${campaignId}.worldTimeAdvanced`,

  /**
   * Get the entity modified channel for a campaign
   */
  entityModified: (campaignId: string) => `campaign.${campaignId}.entityModified`,

  /**
   * Pattern to match all world time advanced channels
   */
  allWorldTimeAdvanced: 'campaign.*.worldTimeAdvanced',

  /**
   * Pattern to match all entity modified channels
   */
  allEntityModified: 'campaign.*.entityModified',
} as const;
