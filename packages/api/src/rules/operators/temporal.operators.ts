/**
 * Temporal Operators
 * Custom operators for time-based queries (daysSince, etc.)
 */

import type { CustomOperator } from '../types/expression.types';

/**
 * Interface for temporal query services
 * This will be implemented by the actual TemporalService in future tickets
 */
export interface ITemporalService {
  /**
   * Calculate the number of days since an event occurred
   * @param eventPath - Path to the event in the data context
   * @returns Number of days since the event, or null if event doesn't exist
   */
  daysSince(eventPath: string): number | null;
}

/**
 * Create the 'daysSince' operator for temporal queries
 *
 * Usage in JSONLogic:
 * { "daysSince": "lastVisit" }
 *
 * @param temporalService - The temporal service to use for queries
 * @returns CustomOperator for 'daysSince'
 */
export function createDaysSinceOperator(temporalService: ITemporalService): CustomOperator {
  return {
    name: 'daysSince',
    description: 'Calculate the number of days since an event occurred',
    implementation: (eventPath: unknown): number | null => {
      // Validate arguments
      if (typeof eventPath !== 'string') {
        return null;
      }

      return temporalService.daysSince(eventPath);
    },
  };
}
