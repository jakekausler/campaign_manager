/**
 * useWebSocketCacheSync
 *
 * Hook that synchronizes WebSocket real-time events with Apollo Client cache and Zustand state.
 * This hook should be mounted once at the app level to handle all cache invalidation and updates
 * from WebSocket events.
 *
 * Event handling strategies:
 * - entity_updated: Evict specific entity from cache to force refetch
 * - state_invalidated: Evict computed fields to force re-evaluation
 * - world_time_changed: Update Zustand campaign store + evict time-dependent queries
 * - settlement_updated: Evict settlement queries + update cache if data provided
 * - structure_updated: Evict structure queries + update cache if data provided
 *
 * @module hooks/useWebSocketCacheSync
 */

import { useApolloClient } from '@apollo/client/react';
import { useCallback, useEffect } from 'react';

import { env } from '@/config';
import { useCampaignStore, useStore } from '@/stores';
import type {
  EntityUpdatedEvent,
  SettlementUpdatedEvent,
  StateInvalidatedEvent,
  StructureUpdatedEvent,
  WorldTimeChangedEvent,
} from '@campaign/shared';

import { useCampaignSubscription } from './useWebSocketSubscription';

/**
 * Hook to sync WebSocket events with Apollo cache and Zustand state
 *
 * This hook must be rendered once at the app level (in App.tsx or similar).
 * It subscribes to the current campaign's WebSocket events and automatically
 * updates the cache and state when events are received.
 *
 * @param campaignId - Current campaign ID to subscribe to
 * @param enabled - Whether to enable cache sync (default: true)
 *
 * @example
 * ```tsx
 * function App() {
 *   const { currentCampaignId } = useCampaignStore();
 *
 *   // Sync cache with WebSocket events for current campaign
 *   useWebSocketCacheSync(currentCampaignId);
 *
 *   return <Routes />;
 * }
 * ```
 */
export function useWebSocketCacheSync(campaignId: string | null, enabled = true) {
  const client = useApolloClient();
  const { setCurrentCampaign } = useCampaignStore();

  /**
   * Handle entity_updated events
   *
   * Strategy: Evict the specific entity from cache to force refetch on next query.
   * This is simpler than updating the cache directly and ensures consistency.
   */
  const handleEntityUpdated = useCallback(
    (event: EntityUpdatedEvent) => {
      const { entityType, entityId } = event.payload;

      if (env.features.debug) {
        console.log('[WebSocket Cache Sync] Entity updated:', {
          entityType,
          entityId,
          changedFields: event.payload.changedFields,
        });
      }

      // Map entity types to GraphQL __typename
      const typenameMap: Record<string, string> = {
        campaign: 'Campaign',
        settlement: 'Settlement',
        structure: 'Structure',
        location: 'Location',
        encounter: 'Encounter',
        event: 'Event',
        character: 'Character',
        item: 'Item',
      };

      const typename = typenameMap[entityType];
      if (!typename) {
        console.warn(`[WebSocket Cache Sync] Unknown entity type: ${entityType}`);
        return;
      }

      // Evict the entity from cache
      const cacheId = client.cache.identify({ __typename: typename, id: entityId });
      if (cacheId) {
        client.cache.evict({ id: cacheId });
        client.cache.gc(); // Garbage collect orphaned data
      }
    },
    [client]
  );

  /**
   * Handle state_invalidated events
   *
   * Strategy: Evict computed fields or entire cache entries based on scope.
   * For 'campaign' scope, evict all computed fields. For 'entity' scope, evict
   * specific entities.
   */
  const handleStateInvalidated = useCallback(
    (event: StateInvalidatedEvent) => {
      const { scope, entityIds, reason } = event.payload;

      if (env.features.debug) {
        console.log('[WebSocket Cache Sync] State invalidated:', {
          scope,
          entityIds,
          reason,
        });
      }

      if (scope === 'campaign') {
        // Evict all computed fields in the campaign
        // This is done by evicting the computedFields field from all entities
        client.cache.evict({ fieldName: 'computedFields' });
        client.cache.gc();
      } else if (scope === 'entity' && entityIds && entityIds.length > 0) {
        // Evict specific entities' computed fields
        entityIds.forEach((entityId) => {
          // We don't know the entity type, so we'll need to evict all possible types
          // This is a limitation of not having type info in the event
          const types = ['Settlement', 'Structure', 'Location', 'Encounter', 'Event'];
          types.forEach((typename) => {
            const cacheId = client.cache.identify({ __typename: typename, id: entityId });
            if (cacheId) {
              client.cache.evict({ id: cacheId, fieldName: 'computedFields' });
            }
          });
        });
        client.cache.gc();
      }
    },
    [client]
  );

  /**
   * Handle world_time_changed events
   *
   * Strategy:
   * 1. Update the campaign's currentWorldTime in Zustand store
   * 2. Evict time-dependent query results to force refetch
   */
  const handleWorldTimeChanged = useCallback(
    (event: WorldTimeChangedEvent) => {
      const { newTime, previousTime, elapsed } = event.payload;

      if (env.features.debug) {
        console.log('[WebSocket Cache Sync] World time changed:', {
          from: previousTime,
          to: newTime,
          elapsed,
        });
      }

      // Update campaign's currentWorldTime in Zustand store
      // Get current campaign from store instead of closure to avoid stale reference
      if (campaignId) {
        const currentCampaign = useStore.getState().campaign;
        if (currentCampaign) {
          setCurrentCampaign(campaignId, {
            ...currentCampaign,
            currentWorldTime: newTime,
          });
        }
      }

      // Evict time-dependent queries
      // Events and encounters are time-dependent
      client.cache.evict({ fieldName: 'eventsByCampaign' });
      client.cache.evict({ fieldName: 'encountersByCampaign' });
      client.cache.gc();
    },
    [client, campaignId, setCurrentCampaign]
  );

  /**
   * Handle settlement_updated events
   *
   * Strategy:
   * 1. If operation is 'delete', evict the settlement from cache
   * 2. Otherwise, evict settlement queries to force refetch
   */
  const handleSettlementUpdated = useCallback(
    (event: SettlementUpdatedEvent) => {
      const { settlementId, operation, changedFields } = event.payload;

      if (env.features.debug) {
        console.log('[WebSocket Cache Sync] Settlement updated:', {
          settlementId,
          operation,
          changedFields,
        });
      }

      if (operation === 'delete') {
        // Evict the settlement entirely
        const cacheId = client.cache.identify({
          __typename: 'Settlement',
          id: settlementId,
        });
        if (cacheId) {
          client.cache.evict({ id: cacheId });
        }
      } else {
        // For create/update, evict the settlement to force refetch
        const cacheId = client.cache.identify({
          __typename: 'Settlement',
          id: settlementId,
        });
        if (cacheId) {
          client.cache.evict({ id: cacheId });
        }
      }

      // Always evict settlement list queries
      client.cache.evict({ fieldName: 'settlementsByKingdom' });
      client.cache.gc();
    },
    [client]
  );

  /**
   * Handle structure_updated events
   *
   * Strategy:
   * 1. If operation is 'delete', evict the structure from cache
   * 2. Otherwise, evict structure queries to force refetch
   * 3. Also evict parent settlement's structures field
   */
  const handleStructureUpdated = useCallback(
    (event: StructureUpdatedEvent) => {
      const { structureId, settlementId, operation, changedFields } = event.payload;

      if (env.features.debug) {
        console.log('[WebSocket Cache Sync] Structure updated:', {
          structureId,
          settlementId,
          operation,
          changedFields,
        });
      }

      if (operation === 'delete') {
        // Evict the structure entirely
        const cacheId = client.cache.identify({
          __typename: 'Structure',
          id: structureId,
        });
        if (cacheId) {
          client.cache.evict({ id: cacheId });
        }
      } else {
        // For create/update, evict the structure to force refetch
        const cacheId = client.cache.identify({
          __typename: 'Structure',
          id: structureId,
        });
        if (cacheId) {
          client.cache.evict({ id: cacheId });
        }
      }

      // Evict parent settlement's structures field
      const settlementCacheId = client.cache.identify({
        __typename: 'Settlement',
        id: settlementId,
      });
      if (settlementCacheId) {
        client.cache.evict({ id: settlementCacheId, fieldName: 'structures' });
      }

      // Evict structure list queries
      client.cache.evict({ fieldName: 'structuresBySettlement' });
      client.cache.gc();
    },
    [client]
  );

  // Subscribe to campaign events (only if campaignId is not null)
  useCampaignSubscription(campaignId || undefined, {
    onEntityUpdated: enabled ? handleEntityUpdated : undefined,
    onStateInvalidated: enabled ? handleStateInvalidated : undefined,
    onWorldTimeChanged: enabled ? handleWorldTimeChanged : undefined,
    onSettlementUpdated: enabled ? handleSettlementUpdated : undefined,
    onStructureUpdated: enabled ? handleStructureUpdated : undefined,
  });

  // Log when cache sync is enabled/disabled
  useEffect(() => {
    if (enabled && campaignId) {
      if (env.features.debug) {
        console.log('[WebSocket Cache Sync] Enabled for campaign:', campaignId);
      }
    } else {
      if (env.features.debug) {
        console.log('[WebSocket Cache Sync] Disabled');
      }
    }
  }, [enabled, campaignId]);
}
