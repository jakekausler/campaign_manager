import { memo, RefObject, useCallback, useEffect } from 'react';

import { Button } from '@/components/ui/button';

import type { TimelineHandle } from './Timeline';

/**
 * Props for the TimelineControls component
 */
export interface TimelineControlsProps {
  /**
   * Ref to the Timeline component to control
   */
  timelineRef: RefObject<TimelineHandle>;

  /**
   * Optional current world time to enable "Jump to Current Time" button
   */
  currentTime?: Date | null;

  /**
   * Optional class name for styling
   */
  className?: string;
}

/**
 * TimelineControls - Control panel for timeline navigation
 *
 * Provides buttons for:
 * - Zoom in/out (10% increments)
 * - Fit all items in view
 * - Jump to current world time marker
 *
 * Also supports keyboard shortcuts:
 * - '+' or '=' : Zoom in
 * - '-' or '_' : Zoom out
 * - '0' : Fit view
 * - 'T' : Jump to current time
 *
 * Memoized to prevent unnecessary re-renders.
 *
 * Part of TICKET-022 Stage 7 implementation.
 *
 * @example
 * ```tsx
 * const timelineRef = useRef<TimelineHandle>(null);
 * const currentTime = new Date('2024-01-15T12:00:00Z');
 *
 * <TimelineControls
 *   timelineRef={timelineRef}
 *   currentTime={currentTime}
 * />
 * ```
 */
function TimelineControlsComponent({
  timelineRef,
  currentTime,
  className = '',
}: TimelineControlsProps) {
  /**
   * Zoom in by 10%
   */
  const handleZoomIn = useCallback(() => {
    timelineRef.current?.zoomIn();
  }, [timelineRef]);

  /**
   * Zoom out by 10%
   */
  const handleZoomOut = useCallback(() => {
    timelineRef.current?.zoomOut();
  }, [timelineRef]);

  /**
   * Fit all timeline items in view
   */
  const handleFit = useCallback(() => {
    timelineRef.current?.fit();
  }, [timelineRef]);

  /**
   * Jump to current world time marker
   */
  const handleJumpToCurrent = useCallback(() => {
    if (currentTime) {
      timelineRef.current?.moveTo(currentTime);
    }
  }, [timelineRef, currentTime]);

  /**
   * Keyboard shortcut handler
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore shortcuts if user is typing in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key) {
        case '+':
        case '=':
          event.preventDefault();
          handleZoomIn();
          break;
        case '-':
        case '_':
          event.preventDefault();
          handleZoomOut();
          break;
        case '0':
          event.preventDefault();
          handleFit();
          break;
        case 't':
        case 'T':
          if (currentTime) {
            event.preventDefault();
            handleJumpToCurrent();
          }
          break;
      }
    },
    [handleZoomIn, handleZoomOut, handleFit, handleJumpToCurrent, currentTime]
  );

  /**
   * Register keyboard shortcuts on mount
   */
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className={
        className ? `timeline-controls ${className}` : 'flex gap-2 items-center justify-start'
      }
    >
      <Button
        variant="outline"
        size="sm"
        onClick={handleZoomIn}
        title="Zoom in (+)"
        aria-label="Zoom in"
      >
        Zoom In
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleZoomOut}
        title="Zoom out (-)"
        aria-label="Zoom out"
      >
        Zoom Out
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleFit}
        title="Fit all items (0)"
        aria-label="Fit all items in view"
      >
        Fit View
      </Button>

      {currentTime && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleJumpToCurrent}
          title="Jump to current time (T)"
          aria-label="Jump to current world time"
        >
          Jump to Now
        </Button>
      )}

      <div className="text-xs text-muted-foreground ml-2">
        <span className="hidden sm:inline">Shortcuts: +/- zoom, 0 fit</span>
        {currentTime && <span className="hidden sm:inline">, T current time</span>}
      </div>
    </div>
  );
}

/**
 * Memoized TimelineControls to prevent unnecessary re-renders.
 */
export const TimelineControls = memo(TimelineControlsComponent);

TimelineControls.displayName = 'TimelineControls';
