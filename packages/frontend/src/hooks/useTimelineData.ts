import { useCallback, useMemo } from 'react';
import type { TimelineItem } from 'vis-timeline/types';

import { useEncountersByCampaign } from '@/services/api/hooks/encounters';
import { useEventsByCampaign } from '@/services/api/hooks/events';
import { transformToTimelineItems } from '@/utils/timeline-transforms';

/**
 * Timeline data hook for combining events and encounters
 *
 * This hook fetches both events and encounters for a campaign and transforms
 * them into vis-timeline format. It handles loading and error states from
 * both queries and provides a unified interface.
 *
 * Part of TICKET-022 Stage 4 implementation.
 *
 * @param campaignId - The ID of the campaign to fetch timeline data for
 * @param currentWorldTime - Optional current world time for overdue detection
 * @returns Combined timeline data with loading and error states
 *
 * @example
 * ```tsx
 * function TimelineView({ campaignId }: { campaignId: string }) {
 *   const { items, loading, error, refetch } = useTimelineData(campaignId);
 *
 *   if (loading) return <LoadingSkeleton />;
 *   if (error) return <ErrorAlert message={error.message} />;
 *
 *   return <Timeline items={items} />;
 * }
 * ```
 */
export function useTimelineData(campaignId: string, currentWorldTime?: Date) {
  // Fetch events and encounters in parallel
  const {
    events,
    loading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents,
  } = useEventsByCampaign(campaignId);

  const {
    encounters,
    loading: encountersLoading,
    error: encountersError,
    refetch: refetchEncounters,
  } = useEncountersByCampaign(campaignId);

  // Transform data to timeline format
  const items = useMemo<TimelineItem[]>(() => {
    // Don't transform if either query is still loading initial data
    // (but do transform if we have cached data and are refetching)
    if ((eventsLoading && events.length === 0) || (encountersLoading && encounters.length === 0)) {
      return [];
    }

    return transformToTimelineItems(events, encounters, currentWorldTime);
  }, [events, encounters, currentWorldTime, eventsLoading, encountersLoading]);

  // Combined loading state
  // Loading is true only if both queries are loading AND have no cached data
  const loading =
    (eventsLoading && events.length === 0) || (encountersLoading && encounters.length === 0);

  // Combined error state
  // If either query errors, show the error
  const error = eventsError || encountersError;

  // Combined refetch function
  const refetch = useCallback(async () => {
    await Promise.all([refetchEvents(), refetchEncounters()]);
  }, [refetchEvents, refetchEncounters]);

  return useMemo(
    () => ({
      items,
      loading,
      error,
      refetch,
    }),
    [items, loading, error, refetch]
  );
}
