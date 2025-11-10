/**
 * @fileoverview Cache Statistics Service
 *
 * Provides comprehensive cache performance monitoring and metrics tracking.
 * Tracks hits, misses, sets, invalidations, and cascade invalidations per cache type.
 *
 * **Key Features:**
 * - Per-type statistics tracking (computed-fields, settlements, structures, spatial)
 * - Hit rate calculation and performance metrics
 * - Time-saved estimation based on operation costs
 * - Redis memory usage monitoring
 * - Auto-reset capability for periodic reporting
 * - Thread-safe in-memory counters
 *
 * **Environment Configuration:**
 * - `CACHE_STATS_TRACKING_ENABLED` - Enable/disable tracking (default: true)
 * - `CACHE_STATS_RESET_PERIOD_MS` - Auto-reset interval in ms (0 = disabled)
 *
 * @module common/cache
 */

import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

import { REDIS_CACHE } from '../../graphql/cache/redis-cache.provider';

/**
 * Statistics for a specific cache type
 */
export interface CacheTypeStats {
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Total cache sets */
  sets: number;
  /** Total single-key invalidations */
  invalidations: number;
  /** Total pattern-based cascade invalidations */
  cascadeInvalidations: number;
}

/**
 * Statistics for a specific cache type with calculated hit rate
 */
export interface CacheTypeStatsWithRate extends CacheTypeStats {
  /** Cache hit rate (0.0 to 1.0) */
  hitRate: number;
}

/**
 * Aggregated statistics across all cache types
 */
export interface AggregatedCacheStats {
  /** Stats per cache type with calculated hit rates */
  byType: Record<string, CacheTypeStatsWithRate>;
  /** Total hits across all types */
  totalHits: number;
  /** Total misses across all types */
  totalMisses: number;
  /** Overall hit rate (0.0 to 1.0) */
  hitRate: number;
  /** Total sets across all types */
  totalSets: number;
  /** Total invalidations across all types */
  totalInvalidations: number;
  /** Total cascade invalidations across all types */
  totalCascadeInvalidations: number;
  /** Timestamp when tracking started */
  startTime: number;
  /** Whether tracking is enabled */
  enabled: boolean;
}

/**
 * Redis memory usage information from INFO command
 */
export interface RedisMemoryInfo {
  /** Total memory used by Redis in bytes */
  usedMemory: number;
  /** Human-readable used memory (e.g., "15.2M") */
  usedMemoryHuman: string;
  /** Peak memory used by Redis in bytes */
  usedMemoryPeak: number;
  /** Human-readable peak memory (e.g., "20.5M") */
  usedMemoryPeakHuman: string;
  /** Memory used by dataset in bytes */
  usedMemoryDataset: number;
  /** Memory used by Lua engine in bytes */
  usedMemoryLua: number;
  /** Number of keys in the database */
  dbKeys: number;
  /** Number of keys with expiration set */
  dbExpires: number;
}

/**
 * Service for tracking and reporting cache statistics
 *
 * Maintains in-memory counters for various cache operations, categorized
 * by cache type (computed-fields, settlements, structures, spatial).
 * Provides thread-safe increment operations and aggregate reporting.
 *
 * **Statistics Tracked:**
 * - Hits: Successful cache retrievals
 * - Misses: Cache lookups that require computation/DB query
 * - Sets: Cache write operations
 * - Invalidations: Single-key cache deletions
 * - Cascade invalidations: Pattern-based bulk deletions
 *
 * **Usage Example:**
 * ```typescript
 * // Record cache operations
 * cacheStatsService.recordHit('computed-fields');
 * cacheStatsService.recordMiss('settlements');
 * cacheStatsService.recordSet('spatial');
 *
 * // Get aggregated statistics
 * const stats = cacheStatsService.getStats();
 * console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
 * console.log(`Time saved: ${cacheStatsService.estimateTimeSaved()}ms`);
 *
 * // Monitor Redis memory
 * const memInfo = await cacheStatsService.getRedisMemoryInfo();
 * console.log(`Memory used: ${memInfo.usedMemoryHuman}`);
 * ```
 *
 * Stats are reset on service restart or when resetStats() is called.
 *
 * @see CacheService for the primary caching implementation
 */
@Injectable()
export class CacheStatsService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheStatsService.name);
  private readonly trackingEnabled: boolean;
  private readonly resetPeriodMs: number;
  private resetTimer?: NodeJS.Timeout;

  /**
   * Stats storage by cache type
   * Key is the cache prefix (e.g., 'computed-fields', 'settlements')
   */
  private stats: Map<string, CacheTypeStats> = new Map();

  /**
   * Timestamp when stats tracking began
   */
  private startTime: number = Date.now();

  /**
   * Creates an instance of CacheStatsService
   *
   * Initializes statistics tracking with configuration from environment variables:
   * - `CACHE_STATS_TRACKING_ENABLED`: Enable/disable tracking (default: true)
   * - `CACHE_STATS_RESET_PERIOD_MS`: Auto-reset interval in milliseconds (0 = disabled)
   *
   * If auto-reset is configured, sets up an interval timer to periodically
   * reset statistics for time-windowed reporting.
   *
   * @param redis - Redis client instance for memory monitoring
   */
  constructor(@Inject(REDIS_CACHE) private readonly redis: Redis) {
    // Check environment variable to enable/disable tracking
    this.trackingEnabled = process.env.CACHE_STATS_TRACKING_ENABLED !== 'false';

    // Read reset period from environment (0 = disabled)
    this.resetPeriodMs = parseInt(process.env.CACHE_STATS_RESET_PERIOD_MS || '0', 10);

    // Set up auto-reset timer if period > 0
    if (this.trackingEnabled && this.resetPeriodMs > 0) {
      this.resetTimer = setInterval(() => {
        this.logger.log(`Auto-resetting cache statistics (period: ${this.resetPeriodMs}ms)`);
        this.resetStats();
      }, this.resetPeriodMs);

      this.logger.log(
        `CacheStatsService initialized (Tracking: enabled, Auto-reset: every ${this.resetPeriodMs}ms)`
      );
    } else {
      this.logger.log(
        `CacheStatsService initialized (Tracking: ${this.trackingEnabled}, Auto-reset: disabled)`
      );
    }
  }

  /**
   * Record a cache hit for a specific cache type
   *
   * @param cacheType - Cache type prefix (e.g., 'computed-fields', 'settlements')
   */
  recordHit(cacheType: string): void {
    if (!this.trackingEnabled) return;

    const stats = this.getOrCreateStats(cacheType);
    stats.hits++;
  }

  /**
   * Record a cache miss for a specific cache type
   *
   * @param cacheType - Cache type prefix
   */
  recordMiss(cacheType: string): void {
    if (!this.trackingEnabled) return;

    const stats = this.getOrCreateStats(cacheType);
    stats.misses++;
  }

  /**
   * Record a cache set operation for a specific cache type
   *
   * @param cacheType - Cache type prefix
   */
  recordSet(cacheType: string): void {
    if (!this.trackingEnabled) return;

    const stats = this.getOrCreateStats(cacheType);
    stats.sets++;
  }

  /**
   * Record a single-key invalidation for a specific cache type
   *
   * @param cacheType - Cache type prefix
   */
  recordInvalidation(cacheType: string): void {
    if (!this.trackingEnabled) return;

    const stats = this.getOrCreateStats(cacheType);
    stats.invalidations++;
  }

  /**
   * Record a cascade invalidation for a specific cache type
   *
   * Cascade invalidations are pattern-based deletions that affect
   * multiple keys (e.g., invalidating all settlements in a kingdom).
   *
   * @param cacheType - Cache type prefix
   * @param keysDeleted - Number of keys deleted in the cascade
   */
  recordCascadeInvalidation(cacheType: string, keysDeleted: number): void {
    if (!this.trackingEnabled) return;

    const stats = this.getOrCreateStats(cacheType);
    stats.cascadeInvalidations += keysDeleted;
  }

  /**
   * Calculate hit rate percentage for a specific cache type
   *
   * @param cacheType - Cache type prefix (e.g., 'computed-fields', 'settlements')
   * @returns Hit rate as a decimal (0.0 to 1.0), or 0 if no operations have occurred
   */
  getHitRateForType(cacheType: string): number {
    const stats = this.stats.get(cacheType);
    if (!stats) {
      return 0;
    }

    const total = stats.hits + stats.misses;
    return total > 0 ? stats.hits / total : 0;
  }

  /**
   * Estimate time saved by cache hits in milliseconds
   *
   * Calculates the estimated time saved by cache hits based on typical
   * operation times for each cache type when data must be computed/fetched
   * from the database without caching.
   *
   * Estimated operation times without cache:
   * - computed-fields: 300ms (Rules Engine evaluation + DB queries)
   * - spatial: 100ms (PostGIS spatial queries)
   * - settlements: 25ms (DB queries)
   * - structures: 25ms (DB queries)
   * - default: 50ms (generic estimate)
   *
   * @param cacheType - Optional cache type to calculate for a specific type.
   *                    If not provided, calculates total across all types.
   * @returns Estimated time saved in milliseconds
   */
  estimateTimeSaved(cacheType?: string): number {
    // Average operation time estimates per cache type (in milliseconds)
    const operationTimes: Record<string, number> = {
      'computed-fields': 300, // Rules Engine evaluation (100-500ms, average 300ms)
      spatial: 100, // PostGIS spatial queries (50-200ms, average 100ms)
      settlements: 25, // DB list queries (10-50ms, average 25ms)
      structures: 25, // DB list queries (10-50ms, average 25ms)
    };
    const defaultOperationTime = 50; // Default estimate for unknown cache types

    if (cacheType) {
      // Calculate for specific cache type
      const stats = this.stats.get(cacheType);
      if (!stats) {
        return 0;
      }

      const avgTime = operationTimes[cacheType] ?? defaultOperationTime;
      return stats.hits * avgTime;
    }

    // Calculate total across all cache types
    let totalTimeSaved = 0;
    for (const [type, stats] of this.stats.entries()) {
      const avgTime = operationTimes[type] ?? defaultOperationTime;
      totalTimeSaved += stats.hits * avgTime;
    }

    return totalTimeSaved;
  }

  /**
   * Query Redis INFO command for memory usage statistics
   *
   * Retrieves memory and key count information from Redis server.
   * Parses the INFO memory and INFO keyspace responses to extract:
   * - Used memory (bytes and human-readable)
   * - Peak memory (bytes and human-readable)
   * - Dataset memory
   * - Lua memory
   * - Database key counts
   *
   * @returns Redis memory information, or null if query fails
   */
  async getRedisMemoryInfo(): Promise<RedisMemoryInfo | null> {
    try {
      // Query Redis INFO command for memory section
      const memoryInfo = await this.redis.info('memory');
      const keyspaceInfo = await this.redis.info('keyspace');

      // Parse memory info (format: "key:value\r\n")
      const memoryLines = memoryInfo.split('\r\n');
      const memoryData: Record<string, string> = {};
      for (const line of memoryLines) {
        const [key, value] = line.split(':');
        if (key && value) {
          memoryData[key] = value;
        }
      }

      // Parse keyspace info to get total key count
      // Format: "db1:keys=100,expires=50,avg_ttl=300000"
      let totalKeys = 0;
      let totalExpires = 0;
      const keyspaceLines = keyspaceInfo.split('\r\n');
      for (const line of keyspaceLines) {
        if (line.startsWith('db')) {
          const match = line.match(/keys=(\d+),expires=(\d+)/);
          if (match) {
            totalKeys += parseInt(match[1], 10);
            totalExpires += parseInt(match[2], 10);
          }
        }
      }

      return {
        usedMemory: parseInt(memoryData['used_memory'] || '0', 10),
        usedMemoryHuman: memoryData['used_memory_human'] || '0B',
        usedMemoryPeak: parseInt(memoryData['used_memory_peak'] || '0', 10),
        usedMemoryPeakHuman: memoryData['used_memory_peak_human'] || '0B',
        usedMemoryDataset: parseInt(memoryData['used_memory_dataset'] || '0', 10),
        usedMemoryLua: parseInt(memoryData['used_memory_lua'] || '0', 10),
        dbKeys: totalKeys,
        dbExpires: totalExpires,
      };
    } catch (error) {
      this.logger.error('Failed to query Redis INFO for memory usage', error);
      return null;
    }
  }

  /**
   * Count keys per cache type using Redis SCAN
   *
   * Uses the SCAN command to iterate through keys matching each cache type pattern.
   * SCAN is preferred over KEYS because it doesn't block the Redis server.
   *
   * Note: This accounts for the 'cache:' prefix added by ioredis keyPrefix option.
   * When using SCAN with ioredis, the keyPrefix is NOT automatically added to MATCH patterns,
   * so we must include it explicitly.
   *
   * Cache type patterns (with cache: prefix):
   * - cache:computed-fields:* - Computed field cache entries
   * - cache:settlements:* - Settlement list cache entries
   * - cache:structures:* - Structure list cache entries
   * - cache:spatial:* - Spatial query cache entries
   *
   * @returns Record of cache type to key count, or null if query fails
   */
  async getKeyCountByType(): Promise<Record<string, number> | null> {
    try {
      // Define cache type patterns to scan for
      // NOTE: Include 'cache:' prefix because ioredis SCAN doesn't auto-add keyPrefix
      const cacheTypePatterns = [
        'cache:computed-fields:*',
        'cache:settlements:*',
        'cache:structures:*',
        'cache:spatial:*',
      ];

      const keyCounts: Record<string, number> = {};

      // Scan for each cache type pattern
      for (const pattern of cacheTypePatterns) {
        let cursor = '0';
        let count = 0;

        // SCAN iterates in batches until cursor returns to '0'
        do {
          // SCAN returns [cursor, keys[]]
          const result = await this.redis.scan(
            cursor,
            'MATCH',
            pattern,
            'COUNT',
            100 // Batch size hint (Redis may return more or fewer)
          );

          cursor = result[0]; // Next cursor position
          const keys = result[1]; // Keys in this batch
          count += keys.length;
        } while (cursor !== '0');

        // Extract cache type from pattern (remove 'cache:' prefix and ':*' suffix)
        const cacheType = pattern.replace('cache:', '').replace(':*', '');
        keyCounts[cacheType] = count;
      }

      return keyCounts;
    } catch (error) {
      this.logger.error('Failed to count keys per cache type using SCAN', error);
      return null;
    }
  }

  /**
   * Get aggregated statistics across all cache types
   *
   * Returns comprehensive statistics including:
   * - Per-type stats with calculated hit rates
   * - Total hits/misses/sets/invalidations across all types
   * - Overall hit rate
   * - Tracking start time
   * - Tracking enabled status
   *
   * This method is the primary interface for monitoring cache performance.
   * Used by the cache-stats GraphQL resolver to expose metrics to clients.
   *
   * @returns Aggregated stats with calculated hit rates per type
   *
   * @example
   * ```typescript
   * const stats = cacheStatsService.getStats();
   * console.log(`Total hits: ${stats.totalHits}`);
   * console.log(`Total misses: ${stats.totalMisses}`);
   * console.log(`Overall hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
   *
   * for (const [type, typeStats] of Object.entries(stats.byType)) {
   *   console.log(`${type}: ${(typeStats.hitRate * 100).toFixed(2)}% hit rate`);
   * }
   * ```
   */
  getStats(): AggregatedCacheStats {
    const byType: Record<string, CacheTypeStatsWithRate> = {};
    let totalHits = 0;
    let totalMisses = 0;
    let totalSets = 0;
    let totalInvalidations = 0;
    let totalCascadeInvalidations = 0;

    // Aggregate stats from all cache types and calculate hit rates
    for (const [cacheType, stats] of this.stats.entries()) {
      const hitRate = this.getHitRateForType(cacheType);
      byType[cacheType] = { ...stats, hitRate };
      totalHits += stats.hits;
      totalMisses += stats.misses;
      totalSets += stats.sets;
      totalInvalidations += stats.invalidations;
      totalCascadeInvalidations += stats.cascadeInvalidations;
    }

    // Calculate overall hit rate
    const total = totalHits + totalMisses;
    const hitRate = total > 0 ? totalHits / total : 0;

    return {
      byType,
      totalHits,
      totalMisses,
      hitRate,
      totalSets,
      totalInvalidations,
      totalCascadeInvalidations,
      startTime: this.startTime,
      enabled: this.trackingEnabled,
    };
  }

  /**
   * Reset all statistics counters
   *
   * Clears all per-type statistics and resets the tracking start time.
   * This is useful for:
   * - Periodic reporting (time-windowed statistics)
   * - Testing scenarios requiring fresh stats
   * - Clearing stale data after system changes
   *
   * If auto-reset is enabled via `CACHE_STATS_RESET_PERIOD_MS`,
   * this method is called automatically at the configured interval.
   *
   * @example
   * ```typescript
   * // Manual reset for hourly reporting
   * const stats = cacheStatsService.getStats();
   * console.log('Hourly stats:', stats);
   * cacheStatsService.resetStats();
   * ```
   */
  resetStats(): void {
    this.stats.clear();
    this.startTime = Date.now();
    this.logger.log('Cache statistics reset');
  }

  /**
   * Clean up resources when module is destroyed
   *
   * Lifecycle hook called by NestJS when the module is being destroyed.
   * Clears the auto-reset interval timer if it was configured to prevent
   * memory leaks.
   *
   * This is automatically called during application shutdown or
   * hot module replacement in development.
   */
  onModuleDestroy(): void {
    if (this.resetTimer) {
      clearInterval(this.resetTimer);
      this.logger.log('Cache statistics auto-reset timer cleared');
    }
  }

  /**
   * Get or create stats object for a cache type
   *
   * Thread-safe lazy initialization of stats objects. If a stats object
   * doesn't exist for the given cache type, creates a new one with zeroed counters.
   *
   * This allows stats to be tracked dynamically for any cache type without
   * pre-registration, supporting extensibility as new cache types are added.
   *
   * @param cacheType - Cache type prefix (e.g., 'computed-fields', 'settlements')
   * @returns Stats object for the cache type (existing or newly created)
   */
  private getOrCreateStats(cacheType: string): CacheTypeStats {
    let stats = this.stats.get(cacheType);
    if (!stats) {
      stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        invalidations: 0,
        cascadeInvalidations: 0,
      };
      this.stats.set(cacheType, stats);
    }
    return stats;
  }
}
