/**
 * Timeline validation utilities
 *
 * Provides validation functions for timeline operations like rescheduling,
 * ensuring that timeline items can only be moved to valid dates/times.
 */

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Extended timeline item with metadata for validation
 */
export interface RescheduleableItem {
  /** Unique identifier */
  id: string;
  /** Display content */
  content: string;
  /** Start time */
  start: Date;
  /** Whether the item is editable */
  editable?: boolean;
  /** Item type (event or encounter) */
  type?: 'event' | 'encounter';
  /** Whether an event is completed */
  isCompleted?: boolean;
  /** Whether an encounter is resolved */
  isResolved?: boolean;
}

/**
 * Result of checking if an item can be rescheduled
 */
export interface CanRescheduleResult {
  /** Whether the item can be rescheduled */
  canReschedule: boolean;
  /** Reason why the item cannot be rescheduled */
  reason?: string;
}

/**
 * Validates that a scheduled time is not in the past relative to current world time
 *
 * @param scheduledTime - The time to validate
 * @param currentWorldTime - The current world time (optional)
 * @returns Validation result with error message if invalid
 *
 * @example
 * ```typescript
 * const result = validateScheduledTime(
 *   new Date('2024-07-01'),
 *   new Date('2024-06-15')
 * );
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateScheduledTime(
  scheduledTime: Date,
  currentWorldTime?: Date
): ValidationResult {
  // If no current world time is provided, any time is valid
  if (!currentWorldTime) {
    return { valid: true };
  }

  // Check if scheduled time is before current world time
  if (scheduledTime < currentWorldTime) {
    return {
      valid: false,
      error: 'Cannot schedule in the past',
    };
  }

  return { valid: true };
}

/**
 * Checks if a timeline item can be rescheduled based on its properties
 *
 * Items cannot be rescheduled if:
 * - They are marked as not editable
 * - They are completed events
 * - They are resolved encounters
 *
 * @param item - The timeline item to check
 * @returns Result indicating if rescheduling is allowed and why
 *
 * @example
 * ```typescript
 * const result = canRescheduleItem(timelineItem);
 * if (!result.canReschedule) {
 *   console.warn(result.reason);
 * }
 * ```
 */
export function canRescheduleItem(item: RescheduleableItem): CanRescheduleResult {
  // Check if item is explicitly marked as not editable
  if (item.editable === false) {
    // Provide specific reason if we know the type
    if (item.type === 'event' && item.isCompleted) {
      return {
        canReschedule: false,
        reason: 'Cannot reschedule completed events',
      };
    }
    if (item.type === 'encounter' && item.isResolved) {
      return {
        canReschedule: false,
        reason: 'Cannot reschedule resolved encounters',
      };
    }
    return {
      canReschedule: false,
      reason: 'This item cannot be rescheduled',
    };
  }

  // Item is editable
  return { canReschedule: true };
}
