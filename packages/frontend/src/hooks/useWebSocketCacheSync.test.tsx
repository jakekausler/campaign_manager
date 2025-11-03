/**
 * Tests for useWebSocketCacheSync hook
 *
 * Tests the integration between WebSocket events and Apollo cache/Zustand state updates.
 */

import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type {
  EntityUpdatedEvent,
  SettlementUpdatedEvent,
  StateInvalidatedEvent,
  StructureUpdatedEvent,
  WorldTimeChangedEvent,
} from '@campaign/shared';

import { useWebSocketCacheSync } from './useWebSocketCacheSync';

// Mock environment
vi.mock('@/config/env', () => ({
  env: {
    features: {
      debug: false,
    },
  },
}));

// Mock Zustand store
const mockSetCurrentCampaign = vi.fn();
vi.mock('@/stores', () => ({
  useCampaignStore: vi.fn(() => ({
    campaign: {
      id: 'campaign-1',
      name: 'Test Campaign',
      currentWorldTime: '2024-01-01T12:00:00Z',
    },
    setCurrentCampaign: mockSetCurrentCampaign,
  })),
  useStore: {
    getState: vi.fn(() => ({
      token: 'test-token',
    })),
  },
}));

// Mock WebSocket subscription hook
let mockHandlers: {
  onEntityUpdated?: (event: EntityUpdatedEvent) => void;
  onStateInvalidated?: (event: StateInvalidatedEvent) => void;
  onWorldTimeChanged?: (event: WorldTimeChangedEvent) => void;
  onSettlementUpdated?: (event: SettlementUpdatedEvent) => void;
  onStructureUpdated?: (event: StructureUpdatedEvent) => void;
};

vi.mock('./useWebSocketSubscription', () => ({
  useCampaignSubscription: vi.fn((_campaignId, handlers) => {
    mockHandlers = handlers || {};
  }),
}));

// Create test Apollo client
function createTestApolloClient() {
  return new ApolloClient({
    link: new HttpLink({ uri: 'http://localhost:4000/graphql' }),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-first',
      },
      query: {
        fetchPolicy: 'cache-first',
      },
    },
  });
}

// Mock Apollo Client hook
let testClient: ApolloClient;
vi.mock('@apollo/client/react', async () => {
  const actual = await vi.importActual('@apollo/client/react');
  return {
    ...actual,
    useApolloClient: () => testClient,
  };
});

describe('useWebSocketCacheSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testClient = createTestApolloClient();
    mockHandlers = {};
  });

  it('should subscribe to campaign events when enabled', () => {
    const { unmount } = renderHook(() => useWebSocketCacheSync('campaign-1', true));

    // Verify that handlers were registered
    expect(mockHandlers.onEntityUpdated).toBeDefined();
    expect(mockHandlers.onStateInvalidated).toBeDefined();
    expect(mockHandlers.onWorldTimeChanged).toBeDefined();
    expect(mockHandlers.onSettlementUpdated).toBeDefined();
    expect(mockHandlers.onStructureUpdated).toBeDefined();

    unmount();
  });

  it('should not subscribe when campaignId is null', () => {
    const { unmount } = renderHook(() => useWebSocketCacheSync(null, true));

    // Handlers might still be registered but should not be active
    unmount();
  });

  it('should not subscribe when disabled', () => {
    const { unmount } = renderHook(() => useWebSocketCacheSync('campaign-1', false));

    // Verify that handlers were not registered
    expect(mockHandlers.onEntityUpdated).toBeUndefined();
    expect(mockHandlers.onStateInvalidated).toBeUndefined();
    expect(mockHandlers.onWorldTimeChanged).toBeUndefined();
    expect(mockHandlers.onSettlementUpdated).toBeUndefined();
    expect(mockHandlers.onStructureUpdated).toBeUndefined();

    unmount();
  });

  describe('entity_updated handler', () => {
    it('should evict entity from cache on update', () => {
      renderHook(() => useWebSocketCacheSync('campaign-1', true));

      // Spy on cache methods
      const evictSpy = vi.spyOn(testClient.cache, 'evict');
      const gcSpy = vi.spyOn(testClient.cache, 'gc');

      // Simulate entity_updated event
      const event: EntityUpdatedEvent = {
        type: 'entity_updated',
        timestamp: new Date().toISOString(),
        payload: {
          entityType: 'settlement',
          entityId: 'settlement-1',
          campaignId: 'campaign-1',
          changedFields: ['name'],
        },
      };

      mockHandlers.onEntityUpdated?.(event);

      // Verify cache eviction
      expect(evictSpy).toHaveBeenCalled();
      expect(gcSpy).toHaveBeenCalled();
    });

    it('should handle unknown entity types gracefully', () => {
      renderHook(() => useWebSocketCacheSync('campaign-1', true));

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Simulate event with unknown entity type to test error handling
      const event: EntityUpdatedEvent = {
        type: 'entity_updated',
        timestamp: new Date().toISOString(),
        payload: {
          entityType: 'unknown' as unknown as 'settlement',
          entityId: 'unknown-1',
          campaignId: 'campaign-1',
        },
      };

      mockHandlers.onEntityUpdated?.(event);

      // Should log warning
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown entity type'));

      consoleWarnSpy.mockRestore();
    });
  });

  describe('state_invalidated handler', () => {
    it('should evict computed fields for campaign scope', () => {
      renderHook(() => useWebSocketCacheSync('campaign-1', true));

      const evictSpy = vi.spyOn(testClient.cache, 'evict');
      const gcSpy = vi.spyOn(testClient.cache, 'gc');

      // Simulate state_invalidated event with campaign scope
      const event: StateInvalidatedEvent = {
        type: 'state_invalidated',
        timestamp: new Date().toISOString(),
        payload: {
          campaignId: 'campaign-1',
          scope: 'campaign',
          reason: 'Rule evaluation changed',
        },
      };

      mockHandlers.onStateInvalidated?.(event);

      // Verify computed fields were evicted
      expect(evictSpy).toHaveBeenCalledWith({ fieldName: 'computedFields' });
      expect(gcSpy).toHaveBeenCalled();
    });

    it('should evict computed fields for specific entities', () => {
      renderHook(() => useWebSocketCacheSync('campaign-1', true));

      const evictSpy = vi.spyOn(testClient.cache, 'evict');
      const gcSpy = vi.spyOn(testClient.cache, 'gc');

      // Simulate state_invalidated event with entity scope
      const event: StateInvalidatedEvent = {
        type: 'state_invalidated',
        timestamp: new Date().toISOString(),
        payload: {
          campaignId: 'campaign-1',
          scope: 'entity',
          entityIds: ['settlement-1', 'structure-1'],
          reason: 'Variable changed',
        },
      };

      mockHandlers.onStateInvalidated?.(event);

      // Verify eviction was called (will attempt multiple entity types)
      expect(evictSpy).toHaveBeenCalled();
      expect(gcSpy).toHaveBeenCalled();
    });
  });

  describe('world_time_changed handler', () => {
    it('should update Zustand store and evict time-dependent queries', () => {
      renderHook(() => useWebSocketCacheSync('campaign-1', true));

      const evictSpy = vi.spyOn(testClient.cache, 'evict');
      const gcSpy = vi.spyOn(testClient.cache, 'gc');

      // Simulate world_time_changed event
      const event: WorldTimeChangedEvent = {
        type: 'world_time_changed',
        timestamp: new Date().toISOString(),
        payload: {
          campaignId: 'campaign-1',
          previousTime: '2024-01-01T12:00:00Z',
          newTime: '2024-01-02T12:00:00Z',
          elapsed: {
            value: 1,
            unit: 'days',
          },
        },
      };

      mockHandlers.onWorldTimeChanged?.(event);

      // Verify Zustand store was updated
      expect(mockSetCurrentCampaign).toHaveBeenCalledWith('campaign-1', {
        id: 'campaign-1',
        name: 'Test Campaign',
        currentWorldTime: '2024-01-02T12:00:00Z',
      });

      // Verify time-dependent queries were evicted
      expect(evictSpy).toHaveBeenCalledWith({ fieldName: 'eventsByCampaign' });
      expect(evictSpy).toHaveBeenCalledWith({ fieldName: 'encountersByCampaign' });
      expect(gcSpy).toHaveBeenCalled();
    });
  });

  describe('settlement_updated handler', () => {
    it('should evict settlement on delete', () => {
      renderHook(() => useWebSocketCacheSync('campaign-1', true));

      const evictSpy = vi.spyOn(testClient.cache, 'evict');
      const gcSpy = vi.spyOn(testClient.cache, 'gc');

      // Simulate settlement_updated event with delete operation
      const event: SettlementUpdatedEvent = {
        type: 'settlement_updated',
        timestamp: new Date().toISOString(),
        payload: {
          settlementId: 'settlement-1',
          campaignId: 'campaign-1',
          operation: 'delete',
        },
      };

      mockHandlers.onSettlementUpdated?.(event);

      // Verify settlement was evicted
      expect(evictSpy).toHaveBeenCalled();
      expect(evictSpy).toHaveBeenCalledWith({ fieldName: 'settlementsByKingdom' });
      expect(gcSpy).toHaveBeenCalled();
    });

    it('should evict settlement on create/update', () => {
      renderHook(() => useWebSocketCacheSync('campaign-1', true));

      const evictSpy = vi.spyOn(testClient.cache, 'evict');
      const gcSpy = vi.spyOn(testClient.cache, 'gc');

      // Simulate settlement_updated event with update operation
      const event: SettlementUpdatedEvent = {
        type: 'settlement_updated',
        timestamp: new Date().toISOString(),
        payload: {
          settlementId: 'settlement-1',
          campaignId: 'campaign-1',
          operation: 'update',
          changedFields: ['name', 'level'],
        },
      };

      mockHandlers.onSettlementUpdated?.(event);

      // Verify settlement was evicted
      expect(evictSpy).toHaveBeenCalled();
      expect(gcSpy).toHaveBeenCalled();
    });
  });

  describe('structure_updated handler', () => {
    it('should evict structure and parent settlement on delete', () => {
      renderHook(() => useWebSocketCacheSync('campaign-1', true));

      const evictSpy = vi.spyOn(testClient.cache, 'evict');
      const gcSpy = vi.spyOn(testClient.cache, 'gc');

      // Simulate structure_updated event with delete operation
      const event: StructureUpdatedEvent = {
        type: 'structure_updated',
        timestamp: new Date().toISOString(),
        payload: {
          structureId: 'structure-1',
          settlementId: 'settlement-1',
          campaignId: 'campaign-1',
          operation: 'delete',
        },
      };

      mockHandlers.onStructureUpdated?.(event);

      // Verify structure was evicted
      expect(evictSpy).toHaveBeenCalled();
      expect(evictSpy).toHaveBeenCalledWith({ fieldName: 'structuresBySettlement' });
      expect(gcSpy).toHaveBeenCalled();
    });

    it('should evict structure and parent settlement on create/update', () => {
      renderHook(() => useWebSocketCacheSync('campaign-1', true));

      const evictSpy = vi.spyOn(testClient.cache, 'evict');
      const gcSpy = vi.spyOn(testClient.cache, 'gc');

      // Simulate structure_updated event with update operation
      const event: StructureUpdatedEvent = {
        type: 'structure_updated',
        timestamp: new Date().toISOString(),
        payload: {
          structureId: 'structure-1',
          settlementId: 'settlement-1',
          campaignId: 'campaign-1',
          operation: 'update',
          changedFields: ['name', 'type'],
        },
      };

      mockHandlers.onStructureUpdated?.(event);

      // Verify structure was evicted and parent settlement structures field evicted
      expect(evictSpy).toHaveBeenCalled();
      expect(gcSpy).toHaveBeenCalled();
    });
  });
});
