import { memo, useMemo } from 'react';
import VisTimeline from 'react-vis-timeline';
import type { TimelineItem, TimelineGroup, TimelineOptions } from 'vis-timeline/types';
import 'vis-timeline/styles/vis-timeline-graph2d.css';
import './Timeline.css';

/**
 * Default timeline options following vis-timeline configuration
 * from the implementation plan.
 */
const DEFAULT_OPTIONS: TimelineOptions = {
  editable: {
    updateTime: true, // Allow dragging items to reschedule
    remove: false, // Prevent deletion from timeline
  },
  orientation: 'top',
  stack: true, // Stack overlapping items
  zoomMin: 1000 * 60 * 60 * 24, // Min zoom: 1 day
  zoomMax: 1000 * 60 * 60 * 24 * 365 * 10, // Max zoom: 10 years
  showCurrentTime: false, // We'll render custom marker
  verticalScroll: true,
  horizontalScroll: true,
  height: '600px',
  width: '100%',
};

/**
 * Props for the Timeline component
 */
export interface TimelineProps {
  /**
   * Timeline items (events and encounters) to display
   */
  items: TimelineItem[];

  /**
   * Optional groups for lane-based organization
   */
  groups?: TimelineGroup[];

  /**
   * Custom timeline options (merged with defaults)
   */
  options?: Partial<TimelineOptions>;

  /**
   * Current world time marker (displayed as vertical line)
   */
  currentTime?: Date | null;

  /**
   * Handler called when an item is moved (drag-to-reschedule)
   */
  onItemMove?: (item: TimelineItem, callback: (item: TimelineItem | null) => void) => void;

  /**
   * Handler called when an item is selected
   */
  onSelect?: (properties: { items: string[]; event: Event }) => void;

  /**
   * Optional class name for styling
   */
  className?: string;
}

/**
 * Timeline - Interactive timeline visualization for events and encounters
 *
 * Displays events and encounters over campaign world-time with:
 * - Drag-to-reschedule functionality
 * - Color-coded availability states
 * - Zoom and pan controls
 * - Lane grouping (by type, location, etc.)
 * - Current world time marker (red vertical line)
 *
 * Uses vis-timeline library wrapped in React component.
 * Memoized to prevent unnecessary re-renders.
 *
 * Part of TICKET-022 Stage 1 and Stage 6 implementation.
 *
 * @example
 * ```tsx
 * const items = [
 *   { id: '1', content: 'Event Name', start: new Date(), type: 'box' },
 * ];
 * const currentTime = new Date('2024-01-15T12:00:00Z');
 *
 * <Timeline items={items} currentTime={currentTime} onItemMove={handleMove} />
 * ```
 */
function TimelineComponent({
  items,
  groups,
  options = {},
  currentTime,
  onItemMove,
  onSelect,
  className = '',
}: TimelineProps) {
  // Memoize merged options to prevent unnecessary re-renders
  const mergedOptions = useMemo<TimelineOptions>(
    () => ({
      ...DEFAULT_OPTIONS,
      ...options,
    }),
    [options]
  );

  // Memoize custom times for current world time marker
  const customTimes = useMemo(() => {
    if (!currentTime) return undefined;
    return [
      {
        id: 'current-world-time',
        datetime: currentTime,
      },
    ];
  }, [currentTime]);

  return (
    <div className={className ? `timeline-container ${className}` : 'timeline-container'}>
      <VisTimeline
        initialItems={items}
        initialGroups={groups}
        options={mergedOptions}
        customTimes={customTimes}
        timechangeHandler={onItemMove}
        selectHandler={onSelect}
      />
    </div>
  );
}

/**
 * Memoized Timeline component to prevent unnecessary re-renders
 * during parent component updates.
 */
export const Timeline = memo(TimelineComponent);
