/**
 * Cache service type definitions
 *
 * Provides TypeScript interfaces for Redis-based caching operations
 * including configuration, key generation, and statistics tracking.
 */

/**
 * Cache configuration options
 *
 * Configures cache behavior including TTL policies and error handling.
 * All properties are optional with sensible defaults applied by the service.
 */
export interface CacheOptions {
  /**
   * Time-to-live for cache entries in seconds
   * Default: 300 (5 minutes)
   * Set to 0 for no expiration
   */
  ttl?: number;

  /**
   * Whether to track cache hit/miss metrics
   * Default: true
   * Disable for high-volume operations where metrics add overhead
   */
  trackMetrics?: boolean;

  /**
   * Whether to log cache operations (for debugging)
   * Default: false
   * Enable for troubleshooting cache invalidation issues
   */
  enableLogging?: boolean;
}

/**
 * Parameters for hierarchical cache key generation
 *
 * Encapsulates all data needed to create a unique, predictable cache key
 * following the pattern: {prefix}:{entityType}:{entityId}:{branchId}
 *
 * @example
 * ```typescript
 * const params: CacheKeyParams = {
 *   prefix: 'computed-fields',
 *   entityType: 'settlement',
 *   entityId: '123',
 *   branchId: 'main'
 * };
 * // Generates: 'computed-fields:settlement:123:main'
 * ```
 */
export interface CacheKeyParams {
  /**
   * Cache namespace prefix (e.g., 'computed-fields', 'settlements', 'spatial')
   * Used for targeted invalidation by prefix pattern
   */
  prefix: string;

  /**
   * Entity type being cached (e.g., 'settlement', 'structure', 'kingdom')
   * Part of the hierarchical key structure
   */
  entityType?: string;

  /**
   * Entity identifier (e.g., settlement ID, kingdom ID)
   * Can be omitted for list-level caches
   */
  entityId?: string;

  /**
   * Branch identifier for timeline branching support
   * Default: 'main'
   * All cache keys must be branch-aware to prevent cross-branch data leaks
   */
  branchId: string;

  /**
   * Additional key segments for complex cache keys
   * Useful for spatial queries or multi-parameter caches
   * @example ['settlements-in-region', '789'] for spatial query cache
   */
  additionalSegments?: string[];
}

/**
 * Cache statistics for monitoring and debugging
 *
 * Provides insights into cache performance, hit rates, and usage patterns.
 * Metrics are tracked in-memory and reset on service restart.
 */
export interface CacheStats {
  /**
   * Total number of cache hit operations (successful retrievals)
   */
  hits: number;

  /**
   * Total number of cache miss operations (retrievals that weren't cached)
   */
  misses: number;

  /**
   * Cache hit rate as a decimal (0.0 to 1.0)
   * Calculated as: hits / (hits + misses)
   * Returns 0 if no operations have occurred
   */
  hitRate: number;

  /**
   * Total number of cache set operations
   */
  sets: number;

  /**
   * Total number of cache delete operations (individual keys)
   */
  deletes: number;

  /**
   * Total number of pattern-based deletions (invalidations)
   */
  patternDeletes: number;

  /**
   * Timestamp when stats tracking began (milliseconds since epoch)
   * Useful for calculating rates over time
   */
  startTime: number;

  /**
   * Whether metrics tracking is currently enabled
   */
  enabled: boolean;
}

/**
 * Result of a pattern-based cache deletion operation
 *
 * Returned by delPattern() to indicate success and number of keys affected.
 */
export interface CacheDeleteResult {
  /**
   * Whether the deletion operation succeeded
   * False if Redis operation failed (graceful degradation)
   */
  success: boolean;

  /**
   * Number of keys deleted by the pattern
   * May be 0 if no keys matched or operation failed
   */
  keysDeleted: number;

  /**
   * Error message if operation failed
   * Undefined if successful
   */
  error?: string;
}
