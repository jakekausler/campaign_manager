/**
 * Name of the main scheduler queue.
 * All jobs are added to this single queue.
 */
export const SCHEDULER_QUEUE = 'scheduler';

/**
 * Name of the dead-letter queue for failed jobs.
 * Jobs that fail all retry attempts are moved here.
 */
export const DEAD_LETTER_QUEUE = 'scheduler-failed';

/**
 * Default retry configuration for jobs.
 */
export const DEFAULT_RETRY_CONFIG = {
  /** Maximum number of retry attempts */
  attempts: 3,

  /** Backoff type for retry delays */
  backoffType: 'exponential' as const,

  /** Initial backoff delay in milliseconds */
  backoffDelay: 5000,
};

/**
 * Default job options applied to all jobs unless overridden.
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: DEFAULT_RETRY_CONFIG.attempts,
  backoff: {
    type: DEFAULT_RETRY_CONFIG.backoffType,
    delay: DEFAULT_RETRY_CONFIG.backoffDelay,
  },
  removeOnComplete: true, // Clean up completed jobs
  removeOnFail: false, // Keep failed jobs for debugging
};
