import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { DataSet } from 'vis-data';
import { Timeline as VisTimeline } from 'vis-timeline/standalone';
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
 * Timeline ref handle exposing imperative methods for controls
 */
export interface TimelineHandle {
  /**
   * Zoom in by 10%
   */
  zoomIn: () => void;

  /**
   * Zoom out by 10%
   */
  zoomOut: () => void;

  /**
   * Fit all items in the timeline window
   */
  fit: () => void;

  /**
   * Move to a specific date and center it
   * @param date - The date to move to
   */
  moveTo: (date: Date) => void;
}

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
 * - Zoom and pan controls (via exposed ref methods)
 * - Lane grouping (by type, location, etc.)
 * - Current world time marker (red vertical line)
 *
 * Uses vis-timeline library wrapped in React component.
 * Memoized to prevent unnecessary re-renders.
 *
 * Part of TICKET-022 Stage 1, Stage 6, and Stage 7 implementation.
 *
 * @example
 * ```tsx
 * const timelineRef = useRef<TimelineHandle>(null);
 * const items = [
 *   { id: '1', content: 'Event Name', start: new Date(), type: 'box' },
 * ];
 * const currentTime = new Date('2024-01-15T12:00:00Z');
 *
 * // Use ref to control timeline programmatically
 * const handleZoomIn = () => timelineRef.current?.zoomIn();
 *
 * <Timeline
 *   ref={timelineRef}
 *   items={items}
 *   currentTime={currentTime}
 *   onItemMove={handleMove}
 * />
 * ```
 */
const TimelineComponent = forwardRef<TimelineHandle, TimelineProps>(function TimelineComponent(
  { items, groups, options = {}, currentTime, onItemMove, onSelect, className = '' },
  ref
) {
  // Ref to the DOM container element
  const containerRef = useRef<HTMLDivElement>(null);
  // Ref to the vis-timeline instance
  const timelineRef = useRef<VisTimeline | null>(null);
  // Ref to the items DataSet
  const itemsDataSetRef = useRef<DataSet<TimelineItem> | null>(null);
  // Ref to the groups DataSet
  const groupsDataSetRef = useRef<DataSet<TimelineGroup> | null>(null);
  // Refs to callback props to avoid stale closures in event listeners
  const onItemMoveRef = useRef(onItemMove);
  const onSelectRef = useRef(onSelect);

  // Memoize merged options to prevent unnecessary re-renders
  const mergedOptions = useMemo<TimelineOptions>(
    () => ({
      ...DEFAULT_OPTIONS,
      ...options,
    }),
    [options]
  );

  // Keep callback refs in sync with props to avoid stale closures
  useEffect(() => {
    onItemMoveRef.current = onItemMove;
  }, [onItemMove]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Initialize timeline instance
  useEffect(() => {
    if (!containerRef.current) return;

    // Create DataSets for items and groups
    itemsDataSetRef.current = new DataSet(items);
    groupsDataSetRef.current = groups ? new DataSet(groups) : new DataSet([]);

    // Create timeline instance
    // Note: Type casting required due to vis-timeline/vis-data type incompatibility
    timelineRef.current = new VisTimeline(
      containerRef.current,
      itemsDataSetRef.current as any,
      groupsDataSetRef.current as any,
      mergedOptions
    );

    // Add current world time marker if provided
    if (currentTime) {
      timelineRef.current.addCustomTime(currentTime, 'current-world-time');
    }

    // Attach event listeners (use refs to avoid stale closures)
    timelineRef.current.on('timechange', (properties: { id: string; time: Date }) => {
      const item = itemsDataSetRef.current?.get(properties.id);
      if (item && onItemMoveRef.current) {
        const updatedItem = { ...item, start: properties.time };
        onItemMoveRef.current(updatedItem, (result) => {
          if (result === null) {
            // Revert the change
            itemsDataSetRef.current?.update(item);
          } else {
            // Accept the change
            itemsDataSetRef.current?.update(result);
          }
        });
      }
    });

    timelineRef.current.on('select', (properties: { items: string[]; event: Event }) => {
      if (onSelectRef.current) {
        onSelectRef.current(properties);
      }
    });

    // Cleanup on unmount
    return () => {
      if (timelineRef.current) {
        timelineRef.current.destroy();
        timelineRef.current = null;
      }
      itemsDataSetRef.current = null;
      groupsDataSetRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only initialize once. Subsequent updates handled by separate useEffects.

  // Update items when they change
  useEffect(() => {
    if (itemsDataSetRef.current) {
      itemsDataSetRef.current.clear();
      itemsDataSetRef.current.add(items);
    }
  }, [items]);

  // Update groups when they change
  useEffect(() => {
    if (groupsDataSetRef.current) {
      groupsDataSetRef.current.clear();
      if (groups) {
        groupsDataSetRef.current.add(groups);
      }
    }
  }, [groups]);

  // Update options when they change
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.setOptions(mergedOptions);
    }
  }, [mergedOptions]);

  // Update current time marker when it changes
  useEffect(() => {
    if (timelineRef.current) {
      if (currentTime) {
        try {
          // Try to update existing custom time
          timelineRef.current.setCustomTime(currentTime, 'current-world-time');
        } catch {
          // If it doesn't exist, add it
          timelineRef.current.addCustomTime(currentTime, 'current-world-time');
        }
      } else {
        try {
          // Remove custom time if currentTime is null/undefined
          timelineRef.current.removeCustomTime('current-world-time');
        } catch {
          // Ignore error if custom time doesn't exist
        }
      }
    }
  }, [currentTime]);

  // Expose imperative methods via ref for zoom and pan controls
  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => {
        if (timelineRef.current) {
          timelineRef.current.zoomIn(0.1); // Zoom in by 10%
        }
      },
      zoomOut: () => {
        if (timelineRef.current) {
          timelineRef.current.zoomOut(0.1); // Zoom out by 10%
        }
      },
      fit: () => {
        if (timelineRef.current) {
          timelineRef.current.fit();
        }
      },
      moveTo: (date: Date) => {
        if (timelineRef.current) {
          timelineRef.current.moveTo(date);
        }
      },
    }),
    []
  );

  return (
    <div className={className ? `timeline-container ${className}` : 'timeline-container'}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
});

/**
 * Memoized Timeline component to prevent unnecessary re-renders
 * during parent component updates.
 */
export const Timeline = memo(TimelineComponent);
