/**
 * TimeScrubber Component
 *
 * A timeline slider control for viewing historical states of the game world.
 * Allows users to scrub through time to see entities as they existed at different points.
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Props for TimeScrubber component
 */
export interface TimeScrubberProps {
  /**
   * The current world time (present moment)
   */
  currentTime: Date | null;

  /**
   * The currently selected time (what the map is showing)
   */
  selectedTime: Date | null;

  /**
   * Callback when the selected time changes
   */
  onTimeChange: (time: Date) => void;

  /**
   * Optional minimum time (defaults to 1 year before current)
   */
  minTime?: Date;

  /**
   * Loading state while fetching current time
   */
  loading?: boolean;

  /**
   * Optional CSS class name
   */
  className?: string;
}

/**
 * Format date for display in a compact format
 */
function formatDisplayDate(date: Date | null): string {
  if (!date) return 'N/A';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * TimeScrubber component
 *
 * Provides a slider control for scrubbing through world time.
 * Shows current selected time and allows resetting to present.
 *
 * Memoized to prevent unnecessary re-renders when parent Map component updates.
 *
 * @example
 * ```tsx
 * <TimeScrubber
 *   currentTime={currentWorldTime}
 *   selectedTime={selectedTime}
 *   onTimeChange={setSelectedTime}
 *   loading={loading}
 * />
 * ```
 */
export const TimeScrubber = memo(function TimeScrubber({
  currentTime,
  selectedTime,
  onTimeChange,
  minTime,
  loading = false,
  className = '',
}: TimeScrubberProps) {
  // Calculate min/max time range for slider
  const calculatedMinTime = useMemo(
    () =>
      minTime ||
      (currentTime ? new Date(currentTime.getTime() - 365 * 24 * 60 * 60 * 1000) : new Date(0)),
    [minTime, currentTime]
  );
  const maxTime = useMemo(() => currentTime || new Date(), [currentTime]);

  // Slider value (0-100 representing position in time range)
  const [sliderValue, setSliderValue] = useState(100);

  // Update slider value when selectedTime changes externally
  useEffect(() => {
    if (!selectedTime || !currentTime) {
      setSliderValue(100);
      return;
    }

    const range = maxTime.getTime() - calculatedMinTime.getTime();
    const position = selectedTime.getTime() - calculatedMinTime.getTime();
    const percentage = range > 0 ? (position / range) * 100 : 100;
    setSliderValue(Math.max(0, Math.min(100, percentage)));
  }, [selectedTime, currentTime, calculatedMinTime, maxTime]);

  // Handle slider change
  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newSliderValue = Number(e.target.value);
      setSliderValue(newSliderValue);

      // Convert slider value to timestamp
      const range = maxTime.getTime() - calculatedMinTime.getTime();
      const timestamp = calculatedMinTime.getTime() + (newSliderValue / 100) * range;
      const newTime = new Date(timestamp);

      onTimeChange(newTime);
    },
    [calculatedMinTime, maxTime, onTimeChange]
  );

  // Reset to current time
  const handleReset = useCallback(() => {
    if (currentTime) {
      onTimeChange(currentTime);
      setSliderValue(100);
    }
  }, [currentTime, onTimeChange]);

  // Is the slider at current time (within 1 second tolerance)
  const isAtCurrentTime = Boolean(
    selectedTime && currentTime && Math.abs(selectedTime.getTime() - currentTime.getTime()) < 1000
  );

  if (loading) {
    return (
      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg p-4 ${className}`}
      >
        <div className="text-sm text-gray-600">Loading world time...</div>
      </div>
    );
  }

  if (!currentTime) {
    return null; // Don't render if we don't have current time
  }

  return (
    <div
      className={`absolute bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg p-4 min-w-[400px] ${className}`}
      data-testid="time-scrubber"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-gray-900">Time View</div>
        <button
          onClick={handleReset}
          disabled={isAtCurrentTime}
          className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          aria-label="Reset to current time"
        >
          Current
        </button>
      </div>

      {/* Slider */}
      <div className="mb-2">
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={sliderValue}
          onChange={handleSliderChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb"
          aria-label="Time scrubber slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={sliderValue}
        />
      </div>

      {/* Time Display */}
      <div className="flex items-center justify-between text-xs text-gray-600">
        <div className="flex flex-col">
          <span className="text-gray-500">Viewing:</span>
          <span className="font-medium text-gray-900">{formatDisplayDate(selectedTime)}</span>
        </div>
        {!isAtCurrentTime && (
          <div className="flex flex-col items-end">
            <span className="text-gray-500">Current:</span>
            <span className="font-medium text-gray-700">{formatDisplayDate(currentTime)}</span>
          </div>
        )}
      </div>

      {/* Historical indicator */}
      {!isAtCurrentTime && (
        <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
          Viewing historical state
        </div>
      )}

      {/* Slider custom styles */}
      <style>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
        }
        .slider-thumb::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
});
