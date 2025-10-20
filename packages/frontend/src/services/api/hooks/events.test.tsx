/**
 * Integration tests for Event GraphQL hooks
 *
 * Tests the Event hooks with MSW-mocked GraphQL responses:
 * - useEventsByCampaign
 */

import { ApolloProvider } from '@apollo/client/react';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { createTestApolloClient } from '@/__tests__/utils/test-utils';

import { useEventsByCampaign } from './events';

// Create a wrapper component for Apollo Provider
function createWrapper() {
  const client = createTestApolloClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
  };
}

describe('Event Hooks Integration Tests', () => {
  describe('useEventsByCampaign', () => {
    it('should fetch events for a campaign', async () => {
      const { result } = renderHook(() => useEventsByCampaign('campaign-1'), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.events).toEqual([]);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have events from campaign-1
      expect(result.current.events).toHaveLength(3);
      expect(result.current.events[0].id).toBe('event-1');
      expect(result.current.events[0].name).toBe('Royal Festival');
      expect(result.current.events[1].id).toBe('event-2');
      expect(result.current.events[1].name).toBe('Harvest Moon');
      expect(result.current.events[2].id).toBe('event-3');
      expect(result.current.events[2].name).toBe("Hero's Quest");
    });

    it('should return empty array for campaign with no events', async () => {
      const { result } = renderHook(() => useEventsByCampaign('campaign-999'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.events).toEqual([]);
      expect(result.current.error).toBeUndefined();
    });

    it('should filter events by campaign ID', async () => {
      const { result: result1 } = renderHook(() => useEventsByCampaign('campaign-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result1.current.loading).toBe(false);
      });

      expect(result1.current.events).toHaveLength(3);
      expect(result1.current.events.every((e) => e.campaignId === 'campaign-1')).toBe(true);

      const { result: result2 } = renderHook(() => useEventsByCampaign('campaign-2'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result2.current.loading).toBe(false);
      });

      expect(result2.current.events).toHaveLength(1);
      expect(result2.current.events[0].id).toBe('event-4');
      expect(result2.current.events[0].campaignId).toBe('campaign-2');
    });

    it('should include scheduling information', async () => {
      const { result } = renderHook(() => useEventsByCampaign('campaign-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const completedEvent = result.current.events.find((e) => e.id === 'event-1');
      expect(completedEvent?.isCompleted).toBe(true);
      expect(completedEvent?.scheduledAt).toBe('2024-06-15T12:00:00.000Z');
      expect(completedEvent?.occurredAt).toBe('2024-06-15T14:00:00.000Z');

      const scheduledEvent = result.current.events.find((e) => e.id === 'event-2');
      expect(scheduledEvent?.isCompleted).toBe(false);
      expect(scheduledEvent?.scheduledAt).toBe('2024-09-21T18:00:00.000Z');
      expect(scheduledEvent?.occurredAt).toBeNull();
    });

    it('should include event type information', async () => {
      const { result } = renderHook(() => useEventsByCampaign('campaign-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const kingdomEvent = result.current.events.find((e) => e.id === 'event-1');
      expect(kingdomEvent?.eventType).toBe('kingdom');

      const worldEvent = result.current.events.find((e) => e.id === 'event-2');
      expect(worldEvent?.eventType).toBe('world');

      const partyEvent = result.current.events.find((e) => e.id === 'event-3');
      expect(partyEvent?.eventType).toBe('party');
    });

    it('should include location information', async () => {
      const { result } = renderHook(() => useEventsByCampaign('campaign-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const locationEvent = result.current.events.find((e) => e.id === 'event-1');
      expect(locationEvent?.locationId).toBe('location-1');

      const noLocationEvent = result.current.events.find((e) => e.id === 'event-3');
      expect(noLocationEvent?.locationId).toBeNull();
    });

    it('should provide refetch function', async () => {
      const { result } = renderHook(() => useEventsByCampaign('campaign-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.refetch).toBeInstanceOf(Function);

      // Refetch should work
      const refetchResult = await result.current.refetch();
      expect(refetchResult.data?.eventsByCampaign).toHaveLength(3);
    });

    it('should provide network status', async () => {
      const { result } = renderHook(() => useEventsByCampaign('campaign-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.networkStatus).toBeDefined();
    });
  });
});
