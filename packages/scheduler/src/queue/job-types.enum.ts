/**
 * Defines all job types that can be queued in the scheduler service.
 * Each job type has a corresponding processor that handles its execution.
 */
export enum JobType {
  /**
   * Execute a deferred effect at a specified time.
   * Used when effects need to run after a delay or at a future world time.
   */
  DEFERRED_EFFECT = 'DEFERRED_EFFECT',

  /**
   * Process settlement growth events (population, resources, level progression).
   * Executed periodically based on settlement level and custom growth rates.
   */
  SETTLEMENT_GROWTH = 'SETTLEMENT_GROWTH',

  /**
   * Process structure maintenance, construction completion, and upgrades.
   * Handles scheduled structure lifecycle events.
   */
  STRUCTURE_MAINTENANCE = 'STRUCTURE_MAINTENANCE',

  /**
   * Check for and mark overdue events as expired.
   * Runs periodically to find events where scheduledAt < currentWorldTime.
   */
  EVENT_EXPIRATION = 'EVENT_EXPIRATION',
}
