/**
 * WebSocket Event Type Definitions
 *
 * Defines all real-time event types that can be published via WebSocket/Redis
 * to notify connected clients of state changes.
 *
 * All events follow a common structure with:
 * - type: discriminant for type-safe event handling
 * - timestamp: ISO 8601 timestamp of when event was created
 * - payload: event-specific data
 * - metadata: optional contextual information
 */

/**
 * Base interface for all WebSocket events
 */
export interface BaseWebSocketEvent {
  /**
   * ISO 8601 timestamp of when the event was created
   */
  timestamp: string;

  /**
   * Optional metadata for debugging and tracing
   */
  metadata?: {
    /**
     * User ID that triggered the event (if applicable)
     */
    userId?: string;

    /**
     * Source system that generated the event
     */
    source?: string;

    /**
     * Correlation ID for tracing related events
     */
    correlationId?: string;
  };
}

/**
 * Entity update event
 * Published when any entity (campaign, settlement, structure, etc.) is updated
 */
export interface EntityUpdatedEvent extends BaseWebSocketEvent {
  type: 'entity_updated';
  payload: {
    /**
     * Type of entity that was updated
     */
    entityType:
      | 'campaign'
      | 'settlement'
      | 'structure'
      | 'location'
      | 'encounter'
      | 'event'
      | 'character'
      | 'item';

    /**
     * ID of the entity that was updated
     */
    entityId: string;

    /**
     * ID of the campaign this entity belongs to
     */
    campaignId: string;

    /**
     * Fields that were modified (optional, for granular updates)
     */
    changedFields?: string[];

    /**
     * The updated entity data (optional, can be included to avoid refetch)
     */
    entityData?: Record<string, unknown>;
  };
}

/**
 * State invalidation event
 * Published when computed state needs to be recalculated (e.g., condition evaluations)
 */
export interface StateInvalidatedEvent extends BaseWebSocketEvent {
  type: 'state_invalidated';
  payload: {
    /**
     * ID of the campaign whose state was invalidated
     */
    campaignId: string;

    /**
     * Scope of invalidation (entire campaign vs. specific entities)
     */
    scope: 'campaign' | 'entity';

    /**
     * If scope is 'entity', the specific entity IDs to invalidate
     */
    entityIds?: string[];

    /**
     * Reason for invalidation (for debugging)
     */
    reason?: string;
  };
}

/**
 * World time change event
 * Published when the campaign's world time is updated
 */
export interface WorldTimeChangedEvent extends BaseWebSocketEvent {
  type: 'world_time_changed';
  payload: {
    /**
     * ID of the campaign whose world time changed
     */
    campaignId: string;

    /**
     * Previous world time (ISO 8601 or custom format)
     */
    previousTime: string;

    /**
     * New world time (ISO 8601 or custom format)
     */
    newTime: string;

    /**
     * Amount of time elapsed in world time units
     */
    elapsed?: {
      /**
       * Numeric value of elapsed time
       */
      value: number;

      /**
       * Unit of time (e.g., 'seconds', 'minutes', 'hours', 'days')
       */
      unit: string;
    };
  };
}

/**
 * Settlement update event
 * Published when a settlement is created, updated, or deleted
 */
export interface SettlementUpdatedEvent extends BaseWebSocketEvent {
  type: 'settlement_updated';
  payload: {
    /**
     * ID of the settlement that was updated
     */
    settlementId: string;

    /**
     * ID of the campaign this settlement belongs to
     */
    campaignId: string;

    /**
     * Type of update operation
     */
    operation: 'create' | 'update' | 'delete';

    /**
     * Fields that were modified (for 'update' operations)
     */
    changedFields?: string[];

    /**
     * The updated settlement data (optional)
     */
    settlementData?: Record<string, unknown>;
  };
}

/**
 * Structure update event
 * Published when a structure is created, updated, or deleted
 */
export interface StructureUpdatedEvent extends BaseWebSocketEvent {
  type: 'structure_updated';
  payload: {
    /**
     * ID of the structure that was updated
     */
    structureId: string;

    /**
     * ID of the settlement this structure belongs to
     */
    settlementId: string;

    /**
     * ID of the campaign this structure belongs to
     */
    campaignId: string;

    /**
     * Type of update operation
     */
    operation: 'create' | 'update' | 'delete';

    /**
     * Fields that were modified (for 'update' operations)
     */
    changedFields?: string[];

    /**
     * The updated structure data (optional)
     */
    structureData?: Record<string, unknown>;
  };
}

/**
 * Discriminated union of all possible WebSocket events
 * Enables type-safe event handling based on the 'type' discriminant
 */
export type WebSocketEvent =
  | EntityUpdatedEvent
  | StateInvalidatedEvent
  | WorldTimeChangedEvent
  | SettlementUpdatedEvent
  | StructureUpdatedEvent;

/**
 * Type guard to check if an object is a valid WebSocket event
 */
export function isWebSocketEvent(obj: unknown): obj is WebSocketEvent {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const event = obj as Record<string, unknown>;

  // Check for required base fields
  if (!event.type || typeof event.type !== 'string') {
    return false;
  }

  if (!event.timestamp || typeof event.timestamp !== 'string') {
    return false;
  }

  if (!event.payload || typeof event.payload !== 'object') {
    return false;
  }

  // Check for valid event type
  const validTypes = [
    'entity_updated',
    'state_invalidated',
    'world_time_changed',
    'settlement_updated',
    'structure_updated',
  ];

  return validTypes.includes(event.type as string);
}

/**
 * Helper to create an entity updated event
 */
export function createEntityUpdatedEvent(
  entityType: EntityUpdatedEvent['payload']['entityType'],
  entityId: string,
  campaignId: string,
  options?: {
    changedFields?: string[];
    entityData?: Record<string, unknown>;
    userId?: string;
    source?: string;
    correlationId?: string;
  }
): EntityUpdatedEvent {
  return {
    type: 'entity_updated',
    timestamp: new Date().toISOString(),
    payload: {
      entityType,
      entityId,
      campaignId,
      changedFields: options?.changedFields,
      entityData: options?.entityData,
    },
    metadata: {
      userId: options?.userId,
      source: options?.source,
      correlationId: options?.correlationId,
    },
  };
}

/**
 * Helper to create a state invalidated event
 */
export function createStateInvalidatedEvent(
  campaignId: string,
  scope: StateInvalidatedEvent['payload']['scope'],
  options?: {
    entityIds?: string[];
    reason?: string;
    userId?: string;
    source?: string;
    correlationId?: string;
  }
): StateInvalidatedEvent {
  return {
    type: 'state_invalidated',
    timestamp: new Date().toISOString(),
    payload: {
      campaignId,
      scope,
      entityIds: options?.entityIds,
      reason: options?.reason,
    },
    metadata: {
      userId: options?.userId,
      source: options?.source,
      correlationId: options?.correlationId,
    },
  };
}

/**
 * Helper to create a world time changed event
 */
export function createWorldTimeChangedEvent(
  campaignId: string,
  previousTime: string,
  newTime: string,
  options?: {
    elapsed?: WorldTimeChangedEvent['payload']['elapsed'];
    userId?: string;
    source?: string;
    correlationId?: string;
  }
): WorldTimeChangedEvent {
  return {
    type: 'world_time_changed',
    timestamp: new Date().toISOString(),
    payload: {
      campaignId,
      previousTime,
      newTime,
      elapsed: options?.elapsed,
    },
    metadata: {
      userId: options?.userId,
      source: options?.source,
      correlationId: options?.correlationId,
    },
  };
}

/**
 * Helper to create a settlement updated event
 */
export function createSettlementUpdatedEvent(
  settlementId: string,
  campaignId: string,
  operation: SettlementUpdatedEvent['payload']['operation'],
  options?: {
    changedFields?: string[];
    settlementData?: Record<string, unknown>;
    userId?: string;
    source?: string;
    correlationId?: string;
  }
): SettlementUpdatedEvent {
  return {
    type: 'settlement_updated',
    timestamp: new Date().toISOString(),
    payload: {
      settlementId,
      campaignId,
      operation,
      changedFields: options?.changedFields,
      settlementData: options?.settlementData,
    },
    metadata: {
      userId: options?.userId,
      source: options?.source,
      correlationId: options?.correlationId,
    },
  };
}

/**
 * Helper to create a structure updated event
 */
export function createStructureUpdatedEvent(
  structureId: string,
  settlementId: string,
  campaignId: string,
  operation: StructureUpdatedEvent['payload']['operation'],
  options?: {
    changedFields?: string[];
    structureData?: Record<string, unknown>;
    userId?: string;
    source?: string;
    correlationId?: string;
  }
): StructureUpdatedEvent {
  return {
    type: 'structure_updated',
    timestamp: new Date().toISOString(),
    payload: {
      structureId,
      settlementId,
      campaignId,
      operation,
      changedFields: options?.changedFields,
      structureData: options?.structureData,
    },
    metadata: {
      userId: options?.userId,
      source: options?.source,
      correlationId: options?.correlationId,
    },
  };
}
