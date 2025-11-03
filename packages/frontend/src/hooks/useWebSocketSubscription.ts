/**
 * WebSocket Subscription Hooks
 *
 * Provides React hooks for subscribing to real-time WebSocket events.
 * Handles subscription lifecycle, automatic cleanup, and reconnection.
 *
 * Features:
 * - Generic useWebSocketSubscription for custom event subscriptions
 * - Specialized hooks for campaign, settlement, and structure subscriptions
 * - Automatic re-subscription on reconnection
 * - Type-safe event handlers
 * - Proper cleanup on unmount
 *
 * Usage:
 * ```tsx
 * // Subscribe to campaign events
 * useCampaignSubscription(campaignId, {
 *   onEntityUpdated: (event) => {
 *     // Handle entity update
 *   },
 *   onWorldTimeChanged: (event) => {
 *     // Handle time change
 *   }
 * });
 * ```
 */

import { useEffect, useRef } from 'react';

import { env } from '@/config/env';
import type {
  EntityUpdatedEvent,
  SettlementUpdatedEvent,
  StateInvalidatedEvent,
  StructureUpdatedEvent,
  WebSocketEvent,
  WorldTimeChangedEvent,
} from '@campaign/shared';

import { ConnectionState, useWebSocket } from '../contexts/WebSocketContext';

/**
 * Generic event handler type
 */
export type WebSocketEventHandler<TEvent extends WebSocketEvent = WebSocketEvent> = (
  event: TEvent
) => void;

/**
 * Subscription response from server
 */
interface SubscriptionResponse {
  success: boolean;
  error?: string;
}

/**
 * Generic hook for subscribing to WebSocket events
 *
 * Manages subscription lifecycle, including:
 * - Subscribing when socket is connected
 * - Re-subscribing on reconnection
 * - Cleaning up subscriptions on unmount or when dependencies change
 *
 * @param eventType - The event type to listen for
 * @param handler - Callback function to handle the event
 * @param subscribeMessage - Message to send for subscription (if room-based)
 * @param unsubscribeMessage - Message to send for unsubscription (if room-based)
 * @param enabled - Whether the subscription is enabled (default: true)
 *
 * @example
 * ```tsx
 * useWebSocketSubscription(
 *   'entity_updated',
 *   (event) => console.log('Entity updated:', event),
 *   { type: 'subscribe_campaign', campaignId: '123' },
 *   { type: 'unsubscribe_campaign', campaignId: '123' }
 * );
 * ```
 */
export function useWebSocketSubscription<TEvent extends WebSocketEvent = WebSocketEvent>(
  eventType: TEvent['type'],
  handler: WebSocketEventHandler<TEvent>,
  subscribeMessage?: { type: string; [key: string]: unknown },
  unsubscribeMessage?: { type: string; [key: string]: unknown },
  enabled = true
): void {
  const { socket, connectionState } = useWebSocket();

  // Use ref to store the latest handler to avoid re-subscribing when handler changes
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // Use ref to track if we're currently subscribed
  const isSubscribedRef = useRef(false);

  // Use ref to track subscription message for re-subscription
  const subscribeMessageRef = useRef(subscribeMessage);
  subscribeMessageRef.current = subscribeMessage;

  /**
   * Subscribe to room (if subscribeMessage provided)
   */
  const subscribe = async () => {
    if (!socket || !subscribeMessageRef.current || isSubscribedRef.current) {
      return;
    }

    const message = subscribeMessageRef.current;

    // Set subscribed flag BEFORE emitting to prevent race condition
    // where subscribe() is called twice before the first callback executes
    isSubscribedRef.current = true;

    if (env.features.debug) {
      console.log(`[WebSocket] Subscribing to ${message.type}`, message);
    }

    // Emit subscription message and wait for response
    socket.emit(message.type, message, (response: SubscriptionResponse) => {
      if (response.success) {
        if (env.features.debug) {
          console.log(`[WebSocket] Subscribed successfully to ${message.type}`);
        }
      } else {
        // Reset flag on failure so subscription can be retried
        isSubscribedRef.current = false;
        console.error(`[WebSocket] Subscription failed:`, response.error);
      }
    });
  };

  /**
   * Unsubscribe from room (if unsubscribeMessage provided)
   */
  const unsubscribe = () => {
    if (!socket || !unsubscribeMessage || !isSubscribedRef.current) {
      return;
    }

    if (env.features.debug) {
      console.log(`[WebSocket] Unsubscribing from ${unsubscribeMessage.type}`, unsubscribeMessage);
    }

    socket.emit(unsubscribeMessage.type, unsubscribeMessage);
    isSubscribedRef.current = false;
  };

  /**
   * Effect: Subscribe when socket is created and set up event listener
   */
  useEffect(() => {
    if (!socket || !enabled) {
      return;
    }

    // Subscribe to the event
    const eventHandler = (event: TEvent) => {
      if (env.features.debug) {
        console.log(`[WebSocket] Received ${eventType} event:`, event);
      }
      handlerRef.current(event);
    };

    // Socket.IO's on() method expects (eventName: string, listener: (...args: any[]) => void)
    // Our eventHandler type is compatible with this signature
    socket.on(eventType, eventHandler as (...args: unknown[]) => void);

    // Cleanup function
    return () => {
      if (env.features.debug) {
        console.log(`[WebSocket] Cleaning up subscription for ${eventType}`);
      }

      // Remove event listener
      socket.off(eventType, eventHandler as (...args: unknown[]) => void);

      // Unsubscribe from room
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, eventType, enabled]);

  /**
   * Effect: Subscribe/re-subscribe when connection state becomes Connected
   */
  useEffect(() => {
    // Reset subscription status when disconnected
    if (connectionState !== ConnectionState.Connected) {
      isSubscribedRef.current = false;
      return;
    }

    // Only subscribe when connected (initial connection or reconnection)
    // AND when we have a subscribe message (to avoid subscribing for event-only subscriptions)
    if (socket && enabled && subscribeMessageRef.current && !isSubscribedRef.current) {
      if (env.features.debug) {
        console.log(`[WebSocket] Subscribing after connection`);
      }
      subscribe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState]);
}

/**
 * Campaign-level event handlers
 */
export interface CampaignEventHandlers {
  /**
   * Handler for entity update events within the campaign
   */
  onEntityUpdated?: WebSocketEventHandler<EntityUpdatedEvent>;

  /**
   * Handler for state invalidation events
   */
  onStateInvalidated?: WebSocketEventHandler<StateInvalidatedEvent>;

  /**
   * Handler for world time change events
   */
  onWorldTimeChanged?: WebSocketEventHandler<WorldTimeChangedEvent>;

  /**
   * Handler for settlement update events
   */
  onSettlementUpdated?: WebSocketEventHandler<SettlementUpdatedEvent>;

  /**
   * Handler for structure update events
   */
  onStructureUpdated?: WebSocketEventHandler<StructureUpdatedEvent>;
}

/**
 * Hook for subscribing to campaign-level events
 *
 * Automatically subscribes to the campaign room and listens for all
 * campaign-related events. Handlers can be provided for specific event types.
 *
 * @param campaignId - ID of the campaign to subscribe to
 * @param handlers - Event handlers for different event types
 * @param enabled - Whether the subscription is enabled (default: true)
 *
 * @example
 * ```tsx
 * function CampaignView({ campaignId }: { campaignId: string }) {
 *   useCampaignSubscription(campaignId, {
 *     onEntityUpdated: (event) => {
 *       // Refetch entity from Apollo cache
 *       refetch();
 *     },
 *     onWorldTimeChanged: (event) => {
 *       // Update world time in store
 *       updateWorldTime(event.payload.newTime);
 *     }
 *   });
 *
 *   return <div>Campaign content...</div>;
 * }
 * ```
 */
export function useCampaignSubscription(
  campaignId: string | undefined,
  handlers: CampaignEventHandlers,
  enabled = true
): void {
  const actuallyEnabled = enabled && !!campaignId;

  // Subscribe to entity_updated events
  useWebSocketSubscription(
    'entity_updated',
    handlers.onEntityUpdated ?? (() => {}),
    campaignId ? { type: 'subscribe_campaign', campaignId } : undefined,
    campaignId ? { type: 'unsubscribe_campaign', campaignId } : undefined,
    actuallyEnabled && !!handlers.onEntityUpdated
  );

  // Subscribe to state_invalidated events
  useWebSocketSubscription(
    'state_invalidated',
    handlers.onStateInvalidated ?? (() => {}),
    undefined, // state_invalidated doesn't need separate room subscription
    undefined,
    actuallyEnabled && !!handlers.onStateInvalidated
  );

  // Subscribe to world_time_changed events
  useWebSocketSubscription(
    'world_time_changed',
    handlers.onWorldTimeChanged ?? (() => {}),
    undefined, // world_time_changed is already in campaign room
    undefined,
    actuallyEnabled && !!handlers.onWorldTimeChanged
  );

  // Subscribe to settlement_updated events
  useWebSocketSubscription(
    'settlement_updated',
    handlers.onSettlementUpdated ?? (() => {}),
    undefined, // settlement_updated is broadcast to campaign room
    undefined,
    actuallyEnabled && !!handlers.onSettlementUpdated
  );

  // Subscribe to structure_updated events
  useWebSocketSubscription(
    'structure_updated',
    handlers.onStructureUpdated ?? (() => {}),
    undefined, // structure_updated is broadcast to campaign room
    undefined,
    actuallyEnabled && !!handlers.onStructureUpdated
  );
}

/**
 * Settlement-level event handlers
 */
export interface SettlementEventHandlers {
  /**
   * Handler for settlement update events
   */
  onSettlementUpdated?: WebSocketEventHandler<SettlementUpdatedEvent>;

  /**
   * Handler for structure update events (within this settlement)
   */
  onStructureUpdated?: WebSocketEventHandler<StructureUpdatedEvent>;
}

/**
 * Hook for subscribing to settlement-level events
 *
 * Subscribes to a specific settlement room and listens for settlement
 * and structure updates within that settlement.
 *
 * @param settlementId - ID of the settlement to subscribe to
 * @param handlers - Event handlers for different event types
 * @param enabled - Whether the subscription is enabled (default: true)
 *
 * @example
 * ```tsx
 * function SettlementView({ settlementId }: { settlementId: string }) {
 *   useSettlementSubscription(settlementId, {
 *     onSettlementUpdated: (event) => {
 *       // Update settlement data
 *       refetch();
 *     },
 *     onStructureUpdated: (event) => {
 *       // Update structure list
 *       refetchStructures();
 *     }
 *   });
 *
 *   return <div>Settlement content...</div>;
 * }
 * ```
 */
export function useSettlementSubscription(
  settlementId: string | undefined,
  handlers: SettlementEventHandlers,
  enabled = true
): void {
  const actuallyEnabled = enabled && !!settlementId;

  // Subscribe to settlement_updated events
  useWebSocketSubscription(
    'settlement_updated',
    handlers.onSettlementUpdated ?? (() => {}),
    settlementId ? { type: 'subscribe_settlement', settlementId } : undefined,
    settlementId ? { type: 'unsubscribe_settlement', settlementId } : undefined,
    actuallyEnabled && !!handlers.onSettlementUpdated
  );

  // Subscribe to structure_updated events
  useWebSocketSubscription(
    'structure_updated',
    handlers.onStructureUpdated ?? (() => {}),
    undefined, // structure_updated is broadcast to settlement room
    undefined,
    actuallyEnabled && !!handlers.onStructureUpdated
  );
}

/**
 * Structure-level event handlers
 */
export interface StructureEventHandlers {
  /**
   * Handler for structure update events
   */
  onStructureUpdated?: WebSocketEventHandler<StructureUpdatedEvent>;
}

/**
 * Hook for subscribing to structure-level events
 *
 * Subscribes to a specific structure room and listens for structure updates.
 *
 * @param structureId - ID of the structure to subscribe to
 * @param handlers - Event handlers for different event types
 * @param enabled - Whether the subscription is enabled (default: true)
 *
 * @example
 * ```tsx
 * function StructureView({ structureId }: { structureId: string }) {
 *   useStructureSubscription(structureId, {
 *     onStructureUpdated: (event) => {
 *       // Update structure data
 *       refetch();
 *     }
 *   });
 *
 *   return <div>Structure content...</div>;
 * }
 * ```
 */
export function useStructureSubscription(
  structureId: string | undefined,
  handlers: StructureEventHandlers,
  enabled = true
): void {
  const actuallyEnabled = enabled && !!structureId;

  // Subscribe to structure_updated events
  useWebSocketSubscription(
    'structure_updated',
    handlers.onStructureUpdated ?? (() => {}),
    structureId ? { type: 'subscribe_structure', structureId } : undefined,
    structureId ? { type: 'unsubscribe_structure', structureId } : undefined,
    actuallyEnabled && !!handlers.onStructureUpdated
  );
}
