import { useState, useCallback, useMemo } from 'react';

import { useUpdateEncounter } from '@/services/api/mutations/encounters';
import { useUpdateEvent } from '@/services/api/mutations/events';
import {
  validateScheduledTime,
  canRescheduleItem,
  type RescheduleableItem,
} from '@/utils/timeline-validation';

/**
 * Options for the useTimelineReschedule hook
 */
export interface UseTimelineRescheduleOptions {
  /** Current world time for validating past dates */
  currentWorldTime?: Date;
  /** Callback when reschedule succeeds */
  onSuccess?: (itemId: string, newDate: Date) => void;
  /** Callback when reschedule fails */
  onError?: (itemId: string, error: string) => void;
}

/**
 * Result from a reschedule operation
 */
export interface RescheduleResult {
  /** Whether the reschedule succeeded */
  success: boolean;
  /** Error message if the reschedule failed */
  error?: string;
}

/**
 * Hook for rescheduling timeline items (events and encounters).
 *
 * Provides validation, mutation handling, and error management for
 * drag-to-reschedule operations on the timeline.
 *
 * @param options - Configuration options
 * @returns Object with reschedule function, loading state, and error state
 *
 * @example
 * ```tsx
 * function Timeline() {
 *   const currentTime = useCurrentWorldTime();
 *   const { reschedule, loading } = useTimelineReschedule({
 *     currentWorldTime: currentTime,
 *     onSuccess: (id, date) => console.log(`Rescheduled ${id} to ${date}`),
 *     onError: (id, error) => console.error(`Failed to reschedule ${id}: ${error}`),
 *   });
 *
 *   const handleItemMove = async (item, newDate) => {
 *     const result = await reschedule(item, newDate);
 *     if (!result.success) {
 *       alert(result.error);
 *     }
 *   };
 *
 *   return <VisTimeline onMove={handleItemMove} />;
 * }
 * ```
 */
export function useTimelineReschedule(options: UseTimelineRescheduleOptions = {}) {
  const { currentWorldTime, onSuccess, onError } = options;

  // Mutation hooks
  const { updateEvent, loading: eventLoading, error: eventError } = useUpdateEvent();
  const {
    updateEncounter,
    loading: encounterLoading,
    error: encounterError,
  } = useUpdateEncounter();

  // Local loading state for the reschedule operation
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Combined loading state
  const loading = eventLoading || encounterLoading || isRescheduling;

  // Combined error state
  const error = eventError || encounterError;

  /**
   * Reschedules a timeline item to a new date/time.
   *
   * Validates the item can be rescheduled and the new date is valid,
   * then calls the appropriate mutation (updateEvent or updateEncounter).
   *
   * @param item - The timeline item to reschedule
   * @param newDate - The new scheduled date/time
   * @returns Promise resolving to the reschedule result
   */
  const reschedule = useCallback(
    async (item: RescheduleableItem, newDate: Date): Promise<RescheduleResult> => {
      // Validate item can be rescheduled
      const canReschedule = canRescheduleItem(item);
      if (!canReschedule.canReschedule) {
        const errorMessage = canReschedule.reason || 'Cannot reschedule this item';
        onError?.(item.id, errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      }

      // Validate new date is not in the past
      const validation = validateScheduledTime(newDate, currentWorldTime);
      if (!validation.valid) {
        const errorMessage = validation.error || 'Invalid date';
        onError?.(item.id, errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      }

      // Execute the appropriate mutation based on item type
      setIsRescheduling(true);
      try {
        const scheduledAtISO = newDate.toISOString();

        if (item.type === 'event') {
          await updateEvent(item.id, { scheduledAt: scheduledAtISO });
        } else if (item.type === 'encounter') {
          await updateEncounter(item.id, { scheduledAt: scheduledAtISO });
        } else {
          // Unknown type - try event mutation as fallback
          await updateEvent(item.id, { scheduledAt: scheduledAtISO });
        }

        onSuccess?.(item.id, newDate);
        return { success: true };
      } catch (err) {
        const baseErrorMessage = err instanceof Error ? err.message : 'Unknown error';
        const errorMessage = `Failed to reschedule: ${baseErrorMessage}`;
        onError?.(item.id, errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setIsRescheduling(false);
      }
    },
    [updateEvent, updateEncounter, currentWorldTime, onSuccess, onError]
  );

  // Return memoized result
  return useMemo(
    () => ({
      reschedule,
      loading,
      error,
    }),
    [reschedule, loading, error]
  );
}
