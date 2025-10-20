import { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TimelineItem } from 'vis-timeline/types';

import { ErrorBoundary } from '@/components';
import {
  Timeline,
  TimelineControls,
  TimelineHandle,
  TimelineFilters,
} from '@/components/features/timeline';
import { useTimelineReschedule } from '@/hooks';
import { useEncountersByCampaign } from '@/services/api/hooks/encounters';
import { useEventsByCampaign } from '@/services/api/hooks/events';
import { useCurrentWorldTime } from '@/services/api/hooks/world-time';
import { useCurrentCampaignId } from '@/stores';
import {
  parseFiltersFromURL,
  serializeFiltersToURL,
  filterEvents,
  filterEncounters,
  applyGrouping,
  type TimelineFilters as FilterConfig,
} from '@/utils/timeline-filters';
import { transformToTimelineItems } from '@/utils/timeline-transforms';

/**
 * TimelinePage - Campaign timeline view showing events and encounters
 *
 * Displays a timeline visualization of all events and encounters in the current
 * campaign. Events are shown with their scheduled/occurred times, encounters
 * are shown when resolved. Color-coding indicates status (completed, scheduled,
 * overdue, resolved, unresolved).
 *
 * Features:
 * - Real-time data from GraphQL API
 * - Current world time marker (red vertical line)
 * - Color-coded status visualization with overdue detection
 * - Drag-to-reschedule functionality with validation
 * - Zoom and pan controls with keyboard shortcuts
 * - Filtering by event type, status, and lane grouping
 * - URL-persisted filter state
 * - Loading skeleton during data fetch
 * - Error handling with user feedback
 * - Timeline item click handlers (shows "coming soon" message for entity inspector)
 *
 * Part of TICKET-022 Stage 5, Stage 6, Stage 7, Stage 10, Stage 11, and Stage 12 implementation.
 */
export default function TimelinePage() {
  // Ref to control the timeline programmatically
  const timelineRef = useRef<TimelineHandle>(null);

  // Get current campaign from store
  const campaignId = useCurrentCampaignId();

  // Fetch current world time for marker and overdue detection
  const { currentTime } = useCurrentWorldTime(campaignId || undefined);

  // URL search params for filter persistence
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse filters from URL or use defaults
  const [filters, setFilters] = useState<FilterConfig>(() => parseFiltersFromURL(searchParams));

  // Sync filters to URL when they change
  useEffect(() => {
    const params = serializeFiltersToURL(filters);
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  // Fetch raw events and encounters (not transformed yet)
  const {
    events,
    loading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents,
  } = useEventsByCampaign(campaignId || '');

  const {
    encounters,
    loading: encountersLoading,
    error: encountersError,
    refetch: refetchEncounters,
  } = useEncountersByCampaign(campaignId || '');

  // Apply filters and transform to timeline items
  const items = useMemo<TimelineItem[]>(() => {
    // Don't transform if either query is still loading initial data
    if ((eventsLoading && events.length === 0) || (encountersLoading && encounters.length === 0)) {
      return [];
    }

    // Apply filters to raw data
    const filteredEvents = filterEvents(events, filters, currentTime || undefined);
    const filteredEncounters = filterEncounters(encounters, filters);

    // Transform filtered data to timeline items
    const timelineItems = transformToTimelineItems(
      filteredEvents,
      filteredEncounters,
      currentTime || undefined
    );

    // Apply grouping strategy
    return applyGrouping(timelineItems, filters.groupBy, filteredEvents, filteredEncounters);
  }, [events, encounters, filters, currentTime, eventsLoading, encountersLoading]);

  // Combined loading and error states
  const loading =
    (eventsLoading && events.length === 0) || (encountersLoading && encounters.length === 0);
  const error = eventsError || encountersError;

  // Combined refetch function
  const refetch = useCallback(async () => {
    await Promise.all([refetchEvents(), refetchEncounters()]);
  }, [refetchEvents, refetchEncounters]);

  // Drag-to-reschedule hook with validation
  const { reschedule, loading: rescheduling } = useTimelineReschedule({
    currentWorldTime: currentTime || undefined,
    onSuccess: () => {
      // Refetch timeline data to show updated state
      refetch();
    },
    onError: (itemId, errorMessage) => {
      // Log error (in production, could show a toast notification)
      console.error(`Failed to reschedule item ${itemId}: ${errorMessage}`);
    },
  });

  // Handle timeline item move (drag-to-reschedule)
  const handleItemMove = useCallback(
    (item: TimelineItem, callback: (item: TimelineItem | null) => void) => {
      // Extract item metadata for validation
      const itemData = {
        id: item.id as string,
        content: item.content as string,
        start: item.start as Date,
        editable: item.editable !== false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: (item as any).type as 'event' | 'encounter' | undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        isCompleted: (item as any).isCompleted as boolean | undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        isResolved: (item as any).isResolved as boolean | undefined,
      };

      // Attempt to reschedule the item
      reschedule(itemData, item.start as Date).then((result) => {
        if (result.success) {
          // Success: confirm the move
          callback(item);
        } else {
          // Failure: revert the move and show error
          callback(null);
          alert(result.error || 'Failed to reschedule item');
        }
      });
    },
    [reschedule]
  );

  // Handle timeline item selection (shows "coming soon" message for future entity inspector integration)
  const handleItemSelect = useCallback(
    (properties: { items: string[]; event: Event }) => {
      // Only handle single-item selection
      if (properties.items.length !== 1) return;

      const selectedItemId = properties.items[0];

      // Find the selected item in our items array
      const selectedItem = items.find((item) => item.id === selectedItemId);
      if (!selectedItem) return;

      // Extract item type from metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemType = (selectedItem as any).type as 'event' | 'encounter' | undefined;
      const itemContent = selectedItem.content as string;

      // Show informational message - entity inspector for events/encounters not yet implemented
      // eslint-disable-next-line no-alert
      alert(
        `Entity inspector for ${itemType}s is coming soon!\n\nSelected ${itemType}: ${itemContent} (ID: ${selectedItemId})\n\nIn the future, clicking timeline items will open the entity inspector with detailed information.`
      );
    },
    [items]
  );

  // Show loading skeleton while fetching data
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Loading timeline...</div>
          <div className="text-sm text-muted-foreground mt-2">Fetching events and encounters</div>
        </div>
      </div>
    );
  }

  // Show error state on fetch failure
  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium text-destructive">Failed to load timeline</div>
          <div className="text-sm text-muted-foreground mt-2">{error.message}</div>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            aria-label="Retry loading timeline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show empty state if no campaign selected
  if (!campaignId) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">No campaign selected</div>
          <div className="text-sm text-muted-foreground mt-2">
            Please select a campaign to view its timeline
          </div>
        </div>
      </div>
    );
  }

  // Show empty state if no timeline items
  if (items.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">No timeline items found</div>
          <div className="text-sm text-muted-foreground mt-2">
            This campaign doesn&apos;t have any events or encounters yet
          </div>
        </div>
      </div>
    );
  }

  // Render timeline with data
  return (
    <div className="h-screen w-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <h1 className="text-2xl font-bold">Campaign Timeline</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {items.length} {items.length === 1 ? 'item' : 'items'}
          {currentTime && (
            <span className="ml-2">• Current Time: {currentTime.toLocaleDateString()}</span>
          )}
        </p>
      </div>

      {/* Timeline controls */}
      <div className="border-b bg-card px-6 py-3">
        <TimelineControls timelineRef={timelineRef} currentTime={currentTime} />
      </div>

      {/* Main content area with sidebar and timeline */}
      <div className="flex-1 flex overflow-hidden">
        {/* Filter sidebar */}
        <aside className="w-64 border-r bg-card overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Filters</h2>
            <TimelineFilters filters={filters} onChange={setFilters} />
          </div>
        </aside>

        {/* Timeline visualization */}
        <div className="flex-1 p-6">
          <ErrorBoundary
            boundaryName="Timeline"
            fallback={(error, _errorInfo, reset) => (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-lg">
                  <h2 className="text-xl font-semibold text-destructive mb-2">
                    Timeline Rendering Error
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    The timeline failed to render. This may be due to invalid data or a rendering
                    issue.
                  </p>
                  <details className="text-left bg-card border rounded p-4 mb-4">
                    <summary className="cursor-pointer font-medium text-sm mb-2">
                      Error Details
                    </summary>
                    <pre className="text-xs p-2 bg-muted rounded overflow-auto">
                      {error.message}
                    </pre>
                  </details>
                  <button
                    type="button"
                    onClick={reset}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    aria-label="Retry rendering timeline"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
            onError={(error, errorInfo) => {
              console.error('Timeline rendering error:', error);
              console.error('Component stack:', errorInfo.componentStack);
            }}
          >
            <Timeline
              ref={timelineRef}
              items={items}
              currentTime={currentTime}
              onItemMove={handleItemMove}
              onSelect={handleItemSelect}
            />
          </ErrorBoundary>
          {rescheduling && (
            <div className="fixed bottom-4 right-4 bg-card border rounded-lg shadow-lg px-4 py-3">
              <div className="text-sm font-medium">Rescheduling...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
