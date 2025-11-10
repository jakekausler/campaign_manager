/**
 * @fileoverview WebSocket Publisher Service - Real-time event publishing via Redis pub/sub
 *
 * Provides centralized methods for publishing WebSocket events to specific rooms (campaigns,
 * settlements, structures). Events are automatically distributed across all API instances via
 * the Socket.IO Redis adapter, enabling horizontal scaling and multi-instance deployments.
 *
 * Key features:
 * - Room-based event targeting: Campaign-wide, settlement-specific, structure-specific rooms
 * - Multi-room publishing: Events cascade to relevant rooms (e.g., structure → settlement → campaign)
 * - Horizontal scaling: Redis adapter distributes events across all API instances
 * - Type-safe events: Discriminated union of all WebSocket event types from @campaign/shared
 * - Automatic routing: `publishEvent()` routes to appropriate specific method based on event type
 * - Server lifecycle: Lazy initialization via `setServer()` after WebSocketGateway bootstrap
 *
 * Event Types Supported:
 * - entity_updated: Generic entity change notification with entity type and ID
 * - state_invalidated: Cache invalidation trigger for computed state
 * - world_time_changed: Campaign world clock updates
 * - settlement_updated: Settlement-specific updates (cascades to campaign and settlement rooms)
 * - structure_updated: Structure-specific updates (cascades to campaign, settlement, and structure rooms)
 *
 * Room Naming Convention:
 * - Campaign: `campaign:{campaignId}`
 * - Settlement: `settlement:{settlementId}`
 * - Structure: `structure:{structureId}`
 *
 * @module websocket/publisher
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

import type {
  WebSocketEvent,
  EntityUpdatedEvent,
  StateInvalidatedEvent,
  WorldTimeChangedEvent,
  SettlementUpdatedEvent,
  StructureUpdatedEvent,
} from '@campaign/shared';

import { getRoomName, RoomType } from './types';

/**
 * Service for publishing real-time WebSocket events to connected clients
 *
 * Central publisher service injected into domain services (Campaign, Settlement, Structure, etc.)
 * to enable broadcasting real-time updates to subscribed clients. Uses Socket.IO rooms for
 * targeted event delivery and Redis adapter for horizontal scaling across multiple API instances.
 *
 * Architecture:
 * - Socket.IO server instance injected via `setServer()` after gateway initialization
 * - Redis adapter automatically distributes events to all API instances in cluster
 * - Room-based subscriptions allow clients to receive only relevant events
 * - Type-safe event discriminated union ensures correct payload structure
 *
 * Usage Pattern:
 * 1. Domain service injects WebSocketPublisherService via constructor
 * 2. After mutation, service calls appropriate `publish*()` method with event payload
 * 3. Publisher routes event to all relevant rooms (campaign, settlement, structure)
 * 4. Redis adapter broadcasts to all API instances
 * 5. Socket.IO emits to all connected clients in target rooms
 *
 * @class WebSocketPublisherService
 * @injectable
 */
@Injectable()
export class WebSocketPublisherService {
  private readonly logger = new Logger(WebSocketPublisherService.name);
  private server: Server | null = null;

  /**
   * Sets the Socket.IO server instance for event publishing
   *
   * Called by WebSocketGateway after server initialization during application bootstrap.
   * The server instance is required for all publishing operations. If server is not set,
   * publishing operations will log a warning and no-op.
   *
   * @param server - Initialized Socket.IO server instance with Redis adapter
   *
   * @example
   * ```typescript
   * // In WebSocketGateway.afterInit()
   * this.websocketPublisher.setServer(server);
   * ```
   */
  setServer(server: Server): void {
    this.server = server;
    this.logger.log('WebSocket publisher service initialized with server instance');
  }

  /**
   * Publishes a WebSocket event to a specific room
   *
   * Internal helper method that emits the event to all clients subscribed to the specified
   * room name. The Socket.IO Redis adapter automatically distributes the event to all API
   * instances in the cluster. If server is not initialized, logs a warning and returns early.
   *
   * @param roomName - Target room name (e.g., "campaign:uuid", "settlement:uuid")
   * @param event - WebSocket event payload with discriminated type
   *
   * @throws Error - Logs error if event emission fails (does not propagate)
   *
   * @private
   * @internal
   */
  private publishToRoom(roomName: string, event: WebSocketEvent): void {
    if (!this.server) {
      this.logger.warn('Cannot publish event - server not initialized');
      return;
    }

    try {
      // Emit event to all clients in the specified room
      this.server.to(roomName).emit(event.type, event);
      this.logger.debug(`Published ${event.type} event to room: ${roomName}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish ${event.type} event to room ${roomName}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Publishes an entity_updated event to relevant rooms
   *
   * Broadcasts entity update notifications to all clients subscribed to the entity's campaign.
   * For settlement and structure entities, also publishes to entity-specific rooms to enable
   * fine-grained subscriptions for clients viewing detailed entity pages.
   *
   * Room targeting:
   * - All entities: campaign room (campaign-wide visibility)
   * - Settlements: campaign + settlement room
   * - Structures: campaign + structure room
   *
   * @param event - EntityUpdatedEvent payload with entity type, ID, and campaign ID
   *
   * @example
   * ```typescript
   * // After updating a settlement
   * this.websocketPublisher.publishEntityUpdated({
   *   type: 'entity_updated',
   *   payload: {
   *     entityType: 'settlement',
   *     entityId: 'settlement-uuid',
   *     campaignId: 'campaign-uuid',
   *     timestamp: new Date().toISOString(),
   *   },
   * });
   * ```
   */
  publishEntityUpdated(event: EntityUpdatedEvent): void {
    const campaignRoom = getRoomName(RoomType.CAMPAIGN, event.payload.campaignId);
    this.publishToRoom(campaignRoom, event);

    // Also publish to entity-specific rooms if applicable
    if (event.payload.entityType === 'settlement') {
      const settlementRoom = getRoomName(RoomType.SETTLEMENT, event.payload.entityId);
      this.publishToRoom(settlementRoom, event);
    } else if (event.payload.entityType === 'structure') {
      const structureRoom = getRoomName(RoomType.STRUCTURE, event.payload.entityId);
      this.publishToRoom(structureRoom, event);
    }
  }

  /**
   * Publishes a state_invalidated event to trigger client-side cache invalidation
   *
   * Notifies all clients in a campaign that computed state has become stale and should be
   * re-evaluated. Typically published after mutations that affect condition evaluation results,
   * computed field values, or dependency graph state. Clients should invalidate cached computed
   * values and re-query affected entities.
   *
   * Common triggers:
   * - State variable changes (affects condition evaluation)
   * - Dependency graph updates (affects computed fields)
   * - World time changes (affects time-based conditions)
   * - Settlement/structure level changes (affects requirements)
   *
   * @param event - StateInvalidatedEvent payload with campaign ID and optional reason
   *
   * @example
   * ```typescript
   * // After updating a state variable
   * this.websocketPublisher.publishStateInvalidated({
   *   type: 'state_invalidated',
   *   payload: {
   *     campaignId: 'campaign-uuid',
   *     reason: 'state_variable_updated',
   *     timestamp: new Date().toISOString(),
   *   },
   * });
   * ```
   */
  publishStateInvalidated(event: StateInvalidatedEvent): void {
    const campaignRoom = getRoomName(RoomType.CAMPAIGN, event.payload.campaignId);
    this.publishToRoom(campaignRoom, event);
  }

  /**
   * Publishes a world_time_changed event to notify clients of campaign time updates
   *
   * Broadcasts world clock changes to all clients in a campaign. Clients should update
   * their time displays and may need to re-evaluate time-based conditions, scheduled events,
   * or encounter triggers. Used by the world time service after manual time advances or
   * scheduled time progression.
   *
   * Implications:
   * - UI clocks should update to show new campaign time
   * - Time-based conditions may change evaluation results
   * - Scheduled events/encounters may become eligible for resolution
   * - Client-side timelines should refresh to show current time position
   *
   * @param event - WorldTimeChangedEvent payload with campaign ID, old time, and new time
   *
   * @example
   * ```typescript
   * // After advancing world time
   * this.websocketPublisher.publishWorldTimeChanged({
   *   type: 'world_time_changed',
   *   payload: {
   *     campaignId: 'campaign-uuid',
   *     oldTime: { seconds: 1000000 },
   *     newTime: { seconds: 1086400 }, // +1 day
   *     timestamp: new Date().toISOString(),
   *   },
   * });
   * ```
   */
  publishWorldTimeChanged(event: WorldTimeChangedEvent): void {
    const campaignRoom = getRoomName(RoomType.CAMPAIGN, event.payload.campaignId);
    this.publishToRoom(campaignRoom, event);
  }

  /**
   * Publishes a settlement_updated event to campaign and settlement rooms
   *
   * Broadcasts settlement-specific updates to both campaign-wide subscribers (for map view
   * updates) and settlement-specific subscribers (for detail page real-time updates). This
   * dual-room approach enables efficient targeting: clients viewing the campaign map receive
   * all settlement updates, while clients on a settlement detail page receive targeted updates.
   *
   * Use cases:
   * - Settlement name, description, or metadata changes
   * - Settlement level changes (affects structure availability)
   * - Settlement geometry/location updates (map rendering)
   * - Settlement variable changes (affects computed fields)
   *
   * @param event - SettlementUpdatedEvent payload with campaign ID, settlement ID, and change details
   *
   * @example
   * ```typescript
   * // After updating settlement level
   * this.websocketPublisher.publishSettlementUpdated({
   *   type: 'settlement_updated',
   *   payload: {
   *     campaignId: 'campaign-uuid',
   *     settlementId: 'settlement-uuid',
   *     changes: { level: { old: 1, new: 2 } },
   *     timestamp: new Date().toISOString(),
   *   },
   * });
   * ```
   */
  publishSettlementUpdated(event: SettlementUpdatedEvent): void {
    const campaignRoom = getRoomName(RoomType.CAMPAIGN, event.payload.campaignId);
    const settlementRoom = getRoomName(RoomType.SETTLEMENT, event.payload.settlementId);

    this.publishToRoom(campaignRoom, event);
    this.publishToRoom(settlementRoom, event);
  }

  /**
   * Publishes a structure_updated event to campaign, settlement, and structure rooms
   *
   * Broadcasts structure-specific updates to three levels of granularity: campaign-wide (map view),
   * settlement-specific (settlement detail page showing all structures), and structure-specific
   * (structure detail page). This triple-room approach ensures all relevant client views receive
   * updates without over-broadcasting to uninterested clients.
   *
   * Use cases:
   * - Structure name, description, or metadata changes
   * - Structure level changes (affects dependent structures)
   * - Structure geometry/location updates within settlement
   * - Structure variable changes (affects computed fields)
   * - Structure construction state changes (in progress → completed)
   *
   * @param event - StructureUpdatedEvent payload with campaign ID, settlement ID, structure ID, and changes
   *
   * @example
   * ```typescript
   * // After completing structure construction
   * this.websocketPublisher.publishStructureUpdated({
   *   type: 'structure_updated',
   *   payload: {
   *     campaignId: 'campaign-uuid',
   *     settlementId: 'settlement-uuid',
   *     structureId: 'structure-uuid',
   *     changes: { status: { old: 'in_progress', new: 'completed' } },
   *     timestamp: new Date().toISOString(),
   *   },
   * });
   * ```
   */
  publishStructureUpdated(event: StructureUpdatedEvent): void {
    const campaignRoom = getRoomName(RoomType.CAMPAIGN, event.payload.campaignId);
    const settlementRoom = getRoomName(RoomType.SETTLEMENT, event.payload.settlementId);
    const structureRoom = getRoomName(RoomType.STRUCTURE, event.payload.structureId);

    this.publishToRoom(campaignRoom, event);
    this.publishToRoom(settlementRoom, event);
    this.publishToRoom(structureRoom, event);
  }

  /**
   * Publishes a WebSocket event with automatic routing based on event type
   *
   * Generic entry point for publishing any WebSocket event. Uses TypeScript discriminated union
   * to route to the appropriate type-specific publishing method. Provides exhaustiveness checking
   * at compile-time to ensure all event types are handled. Preferred method when the event type
   * is determined dynamically or passed from external sources.
   *
   * Type Safety:
   * - Discriminated union ensures type-safe payload access in specific publish methods
   * - Exhaustiveness check catches unhandled event types at compile-time
   * - Never type in default case ensures all cases are covered
   *
   * @param event - Any WebSocketEvent type (entity_updated, state_invalidated, world_time_changed, etc.)
   *
   * @example
   * ```typescript
   * // Dynamic event type from external source
   * const event: WebSocketEvent = await externalService.getEvent();
   * this.websocketPublisher.publishEvent(event);
   * // Automatically routes to correct publish method based on event.type
   * ```
   */
  publishEvent(event: WebSocketEvent): void {
    switch (event.type) {
      case 'entity_updated':
        this.publishEntityUpdated(event);
        break;
      case 'state_invalidated':
        this.publishStateInvalidated(event);
        break;
      case 'world_time_changed':
        this.publishWorldTimeChanged(event);
        break;
      case 'settlement_updated':
        this.publishSettlementUpdated(event);
        break;
      case 'structure_updated':
        this.publishStructureUpdated(event);
        break;
      default: {
        // TypeScript exhaustiveness check - this should never happen
        const _exhaustiveCheck: never = event;
        this.logger.error(`Unknown event type: ${(_exhaustiveCheck as WebSocketEvent).type}`);
      }
    }
  }
}
