import { JobType } from './job-types.enum';

// Re-export JobType for convenience
export { JobType };

/**
 * Priority levels for jobs in the queue (0-10, higher = more urgent).
 * These determine the order in which jobs are processed.
 */
export enum JobPriority {
  /** Low priority - background tasks, non-urgent operations */
  LOW = 1,
  /** Normal priority - standard scheduled tasks */
  NORMAL = 5,
  /** High priority - time-sensitive operations */
  HIGH = 8,
  /** Critical priority - urgent operations that should run immediately */
  CRITICAL = 10,
}

/**
 * Base interface for all jobs in the scheduler queue.
 * Each job must have a type, campaignId, and optional priority.
 */
export interface BaseJobData {
  /** The type of job to process */
  type: JobType;

  /** The campaign this job belongs to */
  campaignId: string;

  /** Priority for job execution (0-10, higher = more urgent) */
  priority?: JobPriority;
}

/**
 * Job data for executing a deferred effect.
 */
export interface DeferredEffectJobData extends BaseJobData {
  type: JobType.DEFERRED_EFFECT;

  /** The effect ID to execute */
  effectId: string;

  /** When the effect should execute (ISO 8601 timestamp) */
  executeAt: string;
}

/**
 * Job data for processing settlement growth.
 */
export interface SettlementGrowthJobData extends BaseJobData {
  type: JobType.SETTLEMENT_GROWTH;

  /** The settlement ID to process */
  settlementId: string;

  /** The type of growth event (e.g., POPULATION_GROWTH, RESOURCE_GENERATION, LEVEL_UP_CHECK) */
  eventType: string;

  /** Parameters for the growth event (growth rates, thresholds, etc.) */
  parameters: Record<string, unknown>;
}

/**
 * Job data for processing structure maintenance.
 */
export interface StructureMaintenanceJobData extends BaseJobData {
  type: JobType.STRUCTURE_MAINTENANCE;

  /** The structure ID to process */
  structureId: string;

  /** The type of maintenance event (e.g., CONSTRUCTION_COMPLETE, MAINTENANCE_DUE) */
  maintenanceType: string;

  /** Parameters for the maintenance event (construction duration, health, etc.) */
  parameters?: Record<string, unknown>;
}

/**
 * Job data for checking event expiration.
 */
export interface EventExpirationJobData extends BaseJobData {
  type: JobType.EVENT_EXPIRATION;

  /** Optional specific event ID to check (if not provided, checks all events) */
  eventId?: string;
}

/**
 * Union type of all possible job data types.
 */
export type JobData =
  | DeferredEffectJobData
  | SettlementGrowthJobData
  | StructureMaintenanceJobData
  | EventExpirationJobData;

/**
 * Options for adding a job to the queue.
 */
export interface JobOptions {
  /** Priority for job execution (0-10, higher = more urgent) */
  priority?: JobPriority;

  /** Delay in milliseconds before the job can be processed */
  delay?: number;

  /** Number of times to retry the job if it fails */
  attempts?: number;

  /** Backoff settings for retries */
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };

  /** Remove the job from the queue when it completes */
  removeOnComplete?: boolean;

  /** Remove the job from the queue when it fails (after all retries) */
  removeOnFail?: boolean;
}
