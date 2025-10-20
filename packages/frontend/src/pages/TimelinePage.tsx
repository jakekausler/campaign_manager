import { Timeline } from '@/components/features/timeline';
import { useTimelineData } from '@/hooks';
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
 * - Zoom and pan controls
 * - Loading skeleton during data fetch
 * - Error handling with user feedback
 *
 * Part of TICKET-022 Stage 5 and Stage 6 implementation.
 */
export default function TimelinePage() {
  // Get current campaign from store
  const campaignId = useCurrentCampaignId();

  // Fetch current world time for marker and overdue detection
  const { currentTime } = useCurrentWorldTime(campaignId || undefined);

  // Fetch timeline data (events + encounters) with overdue detection
  const { items, loading, error, refetch } = useTimelineData(
    campaignId || '',
    currentTime || undefined
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

      {/* Timeline visualization */}
      <div className="flex-1 p-6">
        <Timeline items={items} currentTime={currentTime} />
      </div>
    </div>
  );
}
