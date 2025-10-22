/**
 * Resolution validation utilities
 *
 * Provides validation functions for event completion and encounter resolution,
 * ensuring that entities can only be resolved when all preconditions are met.
 */

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  /** Whether the validation passed (no errors present) */
  isValid: boolean;
  /** Critical errors that block resolution */
  errors: string[];
  /** Non-critical warnings that don't block resolution */
  warnings: string[];
}

/**
 * Event entity interface for validation
 */
export interface Event {
  id: string;
  name: string;
  eventType: string;
  scheduledAt?: string | null;
  occurredAt?: string | null;
  isCompleted: boolean;
  variables: Record<string, unknown>;
}

/**
 * Encounter entity interface for validation
 */
export interface Encounter {
  id: string;
  name: string;
  difficulty?: number | null;
  scheduledAt?: string | null;
  isResolved: boolean;
  resolvedAt?: string | null;
  variables: Record<string, unknown>;
}

/**
 * Validates whether an event can be completed.
 *
 * Checks for:
 * - Event is not already completed (ERROR)
 * - Event has a valid name (ERROR)
 * - Event has occurred (WARNING)
 *
 * @param event - The event to validate
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```typescript
 * const result = validateEventResolution(event);
 * if (!result.isValid) {
 *   console.error('Cannot complete event:', result.errors);
 * }
 * if (result.warnings.length > 0) {
 *   console.warn('Resolution warnings:', result.warnings);
 * }
 * ```
 */
export function validateEventResolution(event: Event): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if event is already completed (CRITICAL ERROR)
  const isAlreadyCompleted = event.isCompleted;
  if (isAlreadyCompleted) {
    errors.push('Event has already been completed');
  }

  // Check if event has a valid name (CRITICAL ERROR)
  if (!event.name || event.name.trim().length === 0) {
    errors.push('Event must have a valid name');
  }

  // Only check warnings if entity is not already in final state
  // Warnings are irrelevant when entity is already completed
  if (!isAlreadyCompleted) {
    // Check if event has occurred (WARNING)
    // This is a warning because GMs might want to complete future events
    // or retroactively complete past events
    if (!event.occurredAt) {
      warnings.push('Event has not yet occurred (occurredAt is not set)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates whether an encounter can be resolved.
 *
 * Checks for:
 * - Encounter is not already resolved (ERROR)
 * - Encounter has a valid name (ERROR)
 * - Encounter has a difficulty rating (WARNING)
 * - Encounter is scheduled (WARNING)
 *
 * @param encounter - The encounter to validate
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```typescript
 * const result = validateEncounterResolution(encounter);
 * if (!result.isValid) {
 *   console.error('Cannot resolve encounter:', result.errors);
 * }
 * if (result.warnings.length > 0) {
 *   console.warn('Resolution warnings:', result.warnings);
 * }
 * ```
 */
export function validateEncounterResolution(encounter: Encounter): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if encounter is already resolved (CRITICAL ERROR)
  const isAlreadyResolved = encounter.isResolved;
  if (isAlreadyResolved) {
    errors.push('Encounter has already been resolved');
  }

  // Check if encounter has a valid name (CRITICAL ERROR)
  if (!encounter.name || encounter.name.trim().length === 0) {
    errors.push('Encounter must have a valid name');
  }

  // Only check warnings if entity is not already in final state
  // Warnings are irrelevant when entity is already resolved
  if (!isAlreadyResolved) {
    // Check if encounter has a difficulty rating (WARNING)
    // This is a warning because difficulty might be optional for some encounter types
    if (encounter.difficulty === null || encounter.difficulty === undefined) {
      warnings.push('Encounter does not have a difficulty rating set');
    }

    // Check if encounter has been scheduled (WARNING)
    // This is a warning because unscheduled encounters might be spontaneous/random
    if (!encounter.scheduledAt) {
      warnings.push('Encounter has not been scheduled (scheduledAt is not set)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates resolution for either an event or encounter entity.
 *
 * This is a convenience function that automatically determines the entity type
 * and calls the appropriate validation function.
 *
 * @param entity - The entity to validate (Event or Encounter)
 * @param entityType - The type of entity ('event' or 'encounter')
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```typescript
 * const result = validateResolution(entity, 'event');
 * if (!result.isValid) {
 *   console.error('Validation failed:', result.errors);
 * }
 * ```
 */
export function validateResolution(
  entity: Event | Encounter,
  entityType: 'event' | 'encounter'
): ValidationResult {
  if (entityType === 'event') {
    return validateEventResolution(entity as Event);
  } else {
    return validateEncounterResolution(entity as Encounter);
  }
}
