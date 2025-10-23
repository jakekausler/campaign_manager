/**
 * Integration tests for useTimelineData hook
 *
 * Tests the useTimelineData hook with MSW-mocked GraphQL responses:
 * - Combining events and encounters
 * - Loading state handling
 * - Error state handling
 * - Current world time for overdue detection
 * - Data transformation to timeline format
 *
 * Part of TICKET-022 Stage 4 implementation.
 */

import { ApolloProvider } from '@apollo/client/react';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, afterEach, vi } from 'vitest';

import { createTestApolloClient } from '@/__tests__/utils/test-utils';

import { useTimelineData } from './useTimelineData';

// Create a wrapper component for Apollo Provider
function createWrapper() {
  const client = createTestApolloClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
  };
}

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks(); // Clear all mock function call history
});

describe('useTimelineData Hook Integration Tests', () => {
  it('should combine events and encounters into timeline items', async () => {
    const { result } = renderHook(() => useTimelineData('campaign-1'), {
      wrapper: createWrapper(),
    });

    // Initially loading with empty items
    expect(result.current.loading).toBe(true);
    expect(result.current.items).toEqual([]);

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should have items from both events and encounters
    // campaign-1 has:
    // - 3 events (event-1: completed with occurredAt, event-2: scheduled, event-3: scheduled)
    // - 2 encounters (encounter-1: resolved, encounter-2: unresolved - no resolvedAt)
    // Only items with valid dates will be in timeline
    expect(result.current.items.length).toBeGreaterThan(0);

    // Check that both event and encounter items exist
    const hasEventItem = result.current.items.some(
      (item) => typeof item.id === 'string' && item.id.startsWith('event-')
    );
    const hasEncounterItem = result.current.items.some(
      (item) => typeof item.id === 'string' && item.id.startsWith('encounter-')
    );
    expect(hasEventItem).toBe(true);
    expect(hasEncounterItem).toBe(true);
  });

  it('should handle campaign with only events', async () => {
    const { result } = renderHook(() => useTimelineData('campaign-2'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // campaign-2 has 1 event and 0 encounters
    expect(result.current.items.length).toBeGreaterThan(0);
    expect(
      result.current.items.every(
        (item) => typeof item.id === 'string' && item.id.startsWith('event-')
      )
    ).toBe(true);
  });

  it('should handle campaign with no data', async () => {
    const { result } = renderHook(() => useTimelineData('campaign-999'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeUndefined();
  });

  it('should transform events to timeline items with correct properties', async () => {
    const { result } = renderHook(() => useTimelineData('campaign-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Find a completed event (event-1: Royal Festival)
    const completedEventItem = result.current.items.find((item) => item.id === 'event-event-1');
    expect(completedEventItem).toBeDefined();
    if (completedEventItem) {
      expect(completedEventItem.content).toBe('Royal Festival');
      expect(completedEventItem.type).toBe('point');
      expect(completedEventItem.start).toBeInstanceOf(Date);
      expect(completedEventItem.editable).toBe(false); // Completed events are not editable
    }

    // Find a scheduled event (event-2: Harvest Moon)
    const scheduledEventItem = result.current.items.find((item) => item.id === 'event-event-2');
    expect(scheduledEventItem).toBeDefined();
    if (scheduledEventItem) {
      expect(scheduledEventItem.content).toBe('Harvest Moon');
      expect(scheduledEventItem.editable).toBe(true); // Scheduled events are editable
    }
  });

  it('should transform encounters to timeline items with correct properties', async () => {
    const { result } = renderHook(() => useTimelineData('campaign-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Find a resolved encounter (encounter-1: Dragon Attack)
    const resolvedEncounterItem = result.current.items.find(
      (item) => item.id === 'encounter-encounter-1'
    );
    expect(resolvedEncounterItem).toBeDefined();
    if (resolvedEncounterItem) {
      expect(resolvedEncounterItem.content).toBe('Dragon Attack');
      expect(resolvedEncounterItem.type).toBe('point');
      expect(resolvedEncounterItem.start).toBeInstanceOf(Date);
      expect(resolvedEncounterItem.editable).toBe(false); // Resolved encounters are not editable
    }
  });

  it('should detect overdue events when currentWorldTime is provided', async () => {
    // Set current world time to after event-2's scheduled date
    const currentWorldTime = new Date('2024-09-01T00:00:00.000Z');

    const { result } = renderHook(() => useTimelineData('campaign-1', currentWorldTime), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // event-2 is scheduled for 2024-08-20 and not completed
    // With currentWorldTime = 2024-09-01, it should be overdue
    const eventItem = result.current.items.find((item) => item.id === 'event-event-2');
    expect(eventItem).toBeDefined();
    if (eventItem) {
      // Check that the style includes overdue color (#ef4444)
      expect(eventItem.style).toContain('#ef4444');
    }
  });

  it('should provide refetch function to reload data', async () => {
    const { result } = renderHook(() => useTimelineData('campaign-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.refetch).toBeDefined();
    expect(typeof result.current.refetch).toBe('function');

    // Calling refetch should not throw
    await expect(result.current.refetch()).resolves.not.toThrow();
  });

  it('should handle loading state correctly', async () => {
    const { result } = renderHook(() => useTimelineData('campaign-1'), {
      wrapper: createWrapper(),
    });

    // Initially should be loading
    expect(result.current.loading).toBe(true);
    expect(result.current.items).toEqual([]);

    // After loading completes
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items.length).toBeGreaterThan(0);
  });

  it('should memoize items to prevent unnecessary recalculations', async () => {
    const { result, rerender } = renderHook(() => useTimelineData('campaign-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const firstItems = result.current.items;

    // Rerender without changing props
    rerender();

    // Items reference should be the same (memoized)
    expect(result.current.items).toBe(firstItems);
  });

  it('should update items when currentWorldTime changes', async () => {
    const { result, rerender } = renderHook(
      ({ currentWorldTime }: { currentWorldTime?: Date }) =>
        useTimelineData('campaign-1', currentWorldTime),
      {
        wrapper: createWrapper(),
        initialProps: { currentWorldTime: undefined as Date | undefined },
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const itemsWithoutTime = result.current.items;

    // Update currentWorldTime to trigger overdue detection
    const newWorldTime: Date | undefined = new Date('2024-09-01T00:00:00.000Z');
    rerender({ currentWorldTime: newWorldTime });

    // Items should be recalculated with new currentWorldTime
    expect(result.current.items).not.toBe(itemsWithoutTime);
  });
});
