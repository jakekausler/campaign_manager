/**
 * WebSocket Event Publisher Service
 *
 * Provides methods for publishing WebSocket events to specific rooms or campaigns.
 * Events are automatically distributed across all API instances via Redis pub/sub adapter.
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
 * Publisher service for WebSocket events
 *
 * This service is injected into other services (Campaign, Settlement, Structure, etc.)
 * to enable them to publish real-time updates to connected clients.
 *
 * The events are automatically distributed to all API instances via the Redis adapter.
 */
@Injectable()
export class WebSocketPublisherService {
  private readonly logger = new Logger(WebSocketPublisherService.name);
  private server: Server | null = null;

  /**
   * Set the Socket.IO server instance
   * Called by the WebSocketGateway after initialization
   */
  setServer(server: Server): void {
    this.server = server;
    this.logger.log('WebSocket publisher service initialized with server instance');
  }

  /**
   * Publish a generic WebSocket event to a specific room
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
   * Publish an entity_updated event
   *
   * Publishes to the appropriate campaign room based on the entity's campaignId
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
   * Publish a state_invalidated event
   *
   * Publishes to the campaign room to trigger cache invalidation on all clients
   */
  publishStateInvalidated(event: StateInvalidatedEvent): void {
    const campaignRoom = getRoomName(RoomType.CAMPAIGN, event.payload.campaignId);
    this.publishToRoom(campaignRoom, event);
  }

  /**
   * Publish a world_time_changed event
   *
   * Publishes to the campaign room to notify all clients of world time changes
   */
  publishWorldTimeChanged(event: WorldTimeChangedEvent): void {
    const campaignRoom = getRoomName(RoomType.CAMPAIGN, event.payload.campaignId);
    this.publishToRoom(campaignRoom, event);
  }

  /**
   * Publish a settlement_updated event
   *
   * Publishes to both the campaign room and the settlement-specific room
   */
  publishSettlementUpdated(event: SettlementUpdatedEvent): void {
    const campaignRoom = getRoomName(RoomType.CAMPAIGN, event.payload.campaignId);
    const settlementRoom = getRoomName(RoomType.SETTLEMENT, event.payload.settlementId);

    this.publishToRoom(campaignRoom, event);
    this.publishToRoom(settlementRoom, event);
  }

  /**
   * Publish a structure_updated event
   *
   * Publishes to the campaign room, settlement room, and structure-specific room
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
   * Publish a generic event (type-safe union of all event types)
   *
   * This method automatically routes to the appropriate specific publish method
   * based on the event type discriminant.
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
