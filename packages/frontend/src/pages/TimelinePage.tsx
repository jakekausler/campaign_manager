import { useRef, useCallback } from 'react';
import type { TimelineItem } from 'vis-timeline/types';

import { Timeline, TimelineControls, TimelineHandle } from '@/components/features/timeline';
import { useTimelineData, useTimelineReschedule } from '@/hooks';
import { useCurrentWorldTime } from '@/services/api/hooks/world-time';
import { useCurrentCampaignId } from '@/stores';

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
 * - Loading skeleton during data fetch
 * - Error handling with user feedback
 *
 * Part of TICKET-022 Stage 5, Stage 6, Stage 7, and Stage 10 implementation.
 */
export default function TimelinePage() {
  // Ref to control the timeline programmatically
  const timelineRef = useRef<TimelineHandle>(null);

  // Get current campaign from store
  const campaignId = useCurrentCampaignId();

  // Fetch current world time for marker and overdue detection
  const { currentTime } = useCurrentWorldTime(campaignId || undefined);

  // Fetch timeline data (events + encounters) with overdue detection
  const { items, loading, error, refetch } = useTimelineData(
    campaignId || '',
    currentTime || undefined
  );

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
        type: (item as any).type as 'event' | 'encounter' | undefined,
        isCompleted: (item as any).isCompleted as boolean | undefined,
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

      {/* Timeline visualization */}
      <div className="flex-1 p-6">
        <Timeline
          ref={timelineRef}
          items={items}
          currentTime={currentTime}
          onItemMove={handleItemMove}
        />
        {rescheduling && (
          <div className="fixed bottom-4 right-4 bg-card border rounded-lg shadow-lg px-4 py-3">
            <div className="text-sm font-medium">Rescheduling...</div>
          </div>
        )}
      </div>
    </div>
  );
}
