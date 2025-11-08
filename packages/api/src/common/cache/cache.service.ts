import { Injectable, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

import { REDIS_CACHE } from '../../graphql/cache/redis-cache.provider';

import { CacheStatsService } from './cache-stats.service';
import { CacheOptions, CacheStats, CacheDeleteResult } from './cache.types';

/**
 * Core cache service providing unified interface for Redis operations.
 *
 * Features:
 * - Get/set/delete operations with TTL support
 * - Pattern-based deletion for cascading invalidation
 * - Metrics tracking (hits, misses, operations)
 * - Graceful degradation (cache failures don't break functionality)
 * - Configurable TTL with environment variable defaults
 *
 * Usage:
 * ```typescript
 * constructor(private readonly cache: CacheService) {}
 *
 * // Get cached value
 * const value = await this.cache.get<Settlement>('computed-fields:settlement:123:main');
 *
 * // Set with custom TTL
 * await this.cache.set('computed-fields:settlement:123:main', data, { ttl: 300 });
 *
 * // Delete by pattern
 * await this.cache.delPattern('computed-fields:*');
 * ```
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTtl: number;
  private readonly metricsEnabled: boolean;
  private readonly loggingEnabled: boolean;

  // Stats tracking
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    sets: 0,
    deletes: 0,
    patternDeletes: 0,
    startTime: Date.now(),
    enabled: false,
  };

  constructor(
    @Inject(REDIS_CACHE) private readonly redis: Redis,
    private readonly cacheStatsService: CacheStatsService
  ) {
    // Load configuration from environment variables
    this.defaultTtl = parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10);
    this.metricsEnabled = process.env.CACHE_METRICS_ENABLED !== 'false';
    this.loggingEnabled = process.env.CACHE_LOGGING_ENABLED === 'true';

    this.stats.enabled = this.metricsEnabled;

    this.logger.log(
      `CacheService initialized (TTL: ${this.defaultTtl}s, Metrics: ${this.metricsEnabled}, Logging: ${this.loggingEnabled})`
    );
  }

  /**
   * Retrieve a value from cache.
   *
   * Returns null if:
   * - Key doesn't exist
   * - Cache operation fails (graceful degradation)
   * - Value cannot be parsed
   *
   * @param key - Cache key
   * @param options - Cache options (trackMetrics)
   * @returns Parsed value or null
   *
   * @example
   * ```typescript
   * const settlement = await cache.get<Settlement>('computed-fields:settlement:123:main');
   * if (settlement) {
   *   // Use cached value
   * } else {
   *   // Fetch from database
   * }
   *
   * // Exclude from metrics (e.g., health checks)
   * const ping = await cache.get<string>('health-check:ping', { trackMetrics: false });
   * ```
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const trackMetrics = options.trackMetrics !== false; // Default true
    try {
      const value = await this.redis.get(key);

      if (value === null) {
        if (trackMetrics) {
          this.incrementMisses(key);
        }
        if (this.loggingEnabled) {
          this.logger.debug(`Cache MISS: ${key}`);
        }
        return null;
      }

      if (trackMetrics) {
        this.incrementHits(key);
      }
      if (this.loggingEnabled) {
        this.logger.debug(`Cache HIT: ${key}`);
      }

      return JSON.parse(value) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cache get failed for key "${key}": ${message}`);
      if (trackMetrics) {
        this.incrementMisses(key); // Count as miss for accurate hit rate
      }
      return null;
    }
  }

  /**
   * Store a value in cache with optional TTL.
   *
   * Uses graceful degradation - failures are logged but don't throw.
   * Values are JSON-serialized before storage.
   *
   * @param key - Cache key
   * @param value - Value to cache (will be JSON-serialized)
   * @param options - Cache options (ttl, trackMetrics, enableLogging)
   *
   * @example
   * ```typescript
   * // Use default TTL
   * await cache.set('computed-fields:settlement:123:main', settlement);
   *
   * // Custom TTL (5 minutes)
   * await cache.set('settlements:kingdom:456:main', settlements, { ttl: 300 });
   * ```
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const trackMetrics = options.trackMetrics !== false; // Default true

    try {
      const ttl = options.ttl ?? this.defaultTtl;
      const serialized = JSON.stringify(value);

      await this.redis.setex(key, ttl, serialized);

      if (this.metricsEnabled && trackMetrics) {
        this.stats.sets++;
        const cacheType = this.extractCacheType(key);
        this.cacheStatsService.recordSet(cacheType);
      }

      if (this.loggingEnabled || options.enableLogging) {
        this.logger.debug(`Cache SET: ${key} (TTL: ${ttl}s, Size: ${serialized.length} bytes)`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cache set failed for key "${key}": ${message}`);
      // Graceful degradation - don't throw
    }
  }

  /**
   * Delete a single key from cache.
   *
   * Uses graceful degradation - failures are logged but don't throw.
   *
   * @param key - Cache key to delete
   * @param options - Cache options (trackMetrics)
   * @returns Number of keys deleted (0 or 1)
   *
   * @example
   * ```typescript
   * await cache.del('computed-fields:settlement:123:main');
   *
   * // Exclude from metrics (e.g., health checks)
   * await cache.del('health-check:ping', { trackMetrics: false });
   * ```
   */
  async del(key: string, options: CacheOptions = {}): Promise<number> {
    const trackMetrics = options.trackMetrics !== false; // Default true

    try {
      const count = await this.redis.del(key);

      if (this.metricsEnabled && trackMetrics) {
        this.stats.deletes++;
        const cacheType = this.extractCacheType(key);
        this.cacheStatsService.recordInvalidation(cacheType);
      }

      if (this.loggingEnabled) {
        this.logger.debug(`Cache DEL: ${key} (deleted: ${count})`);
      }

      return count;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cache del failed for key "${key}": ${message}`);
      return 0;
    }
  }

  /**
   * Delete all keys matching a pattern.
   *
   * Critical for cascading invalidation:
   * - 'computed-fields:*' - Invalidate all computed fields
   * - '*:settlement:123:main' - Invalidate all caches for settlement 123
   * - '*:main' - Invalidate all caches in main branch
   *
   * Uses SCAN for safe iteration (doesn't block Redis).
   * Uses graceful degradation - returns success=false on errors.
   *
   * Note: The pattern is automatically prefixed with 'cache:' to match
   * the keyPrefix configuration in Redis. Keys returned by SCAN include
   * this prefix, so they must be stripped before calling del().
   *
   * @param pattern - Redis pattern with wildcards (* and ?) - do NOT include 'cache:' prefix
   * @returns Result with success status, keys deleted count, and optional error
   *
   * @example
   * ```typescript
   * // Invalidate all computed fields
   * const result = await cache.delPattern('computed-fields:*');
   * console.log(`Deleted ${result.keysDeleted} keys`);
   *
   * // Invalidate all caches for an entity
   * await cache.delPattern('*:settlement:123:main');
   * ```
   */
  async delPattern(pattern: string): Promise<CacheDeleteResult> {
    try {
      let keysDeleted = 0;
      let cursor = '0';

      // Get the keyPrefix from Redis client options (e.g., 'cache:')
      // SCAN's MATCH parameter doesn't use keyPrefix automatically, so we add it manually
      const keyPrefix = this.redis.options.keyPrefix || '';
      const prefixedPattern = keyPrefix ? `${keyPrefix}${pattern}` : pattern;

      // Use SCAN to iterate without blocking Redis
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          prefixedPattern,
          'COUNT',
          100
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          // Keys returned by SCAN include the keyPrefix, but redis.del() will add it again
          // So strip the prefix before calling del()
          const keysWithoutPrefix = keyPrefix
            ? keys.map((key) => key.replace(new RegExp(`^${keyPrefix}`), ''))
            : keys;
          const deleted = await this.redis.del(...keysWithoutPrefix);
          keysDeleted += deleted;
        }
      } while (cursor !== '0');

      if (this.metricsEnabled) {
        this.stats.patternDeletes++;
        const cacheType = this.extractCacheType(pattern);
        this.cacheStatsService.recordCascadeInvalidation(cacheType, keysDeleted);
      }

      if (this.loggingEnabled) {
        this.logger.debug(`Cache DEL PATTERN: ${pattern} (deleted: ${keysDeleted} keys)`);
      }

      return {
        success: true,
        keysDeleted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cache delPattern failed for pattern "${pattern}": ${message}`);
      return {
        success: false,
        keysDeleted: 0,
        error: message,
      };
    }
  }

  /**
   * Invalidate all cache entries matching a pattern.
   *
   * This is a semantic alias for delPattern() with enhanced logging
   * specifically for cascading invalidation operations. Use this method
   * when implementing cascading cache invalidation logic.
   *
   * Logs at INFO level (vs DEBUG) to track cascade operations in production.
   *
   * Common patterns:
   * - 'computed-fields:*:{branchId}' - All computed fields in a branch
   * - 'computed-fields:settlement:*:{branchId}' - All settlement computed fields
   * - '*:settlement:{id}:{branchId}' - All caches for a specific settlement
   *
   * @param pattern - Redis pattern with wildcards (* and ?)
   * @param reason - Optional reason for invalidation (logged at INFO level)
   * @returns Result with success status, keys deleted count, and optional error
   *
   * @example
   * ```typescript
   * // Invalidate all computed fields in campaign
   * await cache.invalidatePattern(
   *   'computed-fields:*:main',
   *   'FieldCondition updated'
   * );
   *
   * // Invalidate all caches for a settlement
   * await cache.invalidatePattern(
   *   '*:settlement:123:main',
   *   'Settlement cascade invalidation'
   * );
   * ```
   */
  async invalidatePattern(pattern: string, reason?: string): Promise<CacheDeleteResult> {
    const result = await this.delPattern(pattern);

    // Log cascade operations at INFO level for production monitoring
    if (result.success && result.keysDeleted > 0) {
      const reasonMsg = reason ? ` (${reason})` : '';
      this.logger.log(
        `Cache cascade invalidation: pattern="${pattern}", deleted=${result.keysDeleted} keys${reasonMsg}`
      );
    }

    return result;
  }

  /**
   * Cascade invalidation for a settlement and all related caches.
   *
   * Invalidates:
   * 1. Settlement's computed fields cache
   * 2. Settlement's structures list cache
   * 3. All structure computed fields within the settlement (pattern-based)
   * 4. Spatial query caches (settlements-in-region)
   *
   * This ensures complete cache consistency when a settlement changes.
   * Uses pattern-based deletion for child structures to avoid N+1 queries.
   *
   * @param settlementId - Settlement identifier
   * @param branchId - Branch identifier
   * @returns Combined result with total keys deleted
   *
   * @example
   * ```typescript
   * // Called when settlement is updated or deleted
   * await cache.invalidateSettlementCascade('settlement-123', 'main');
   * ```
   */
  async invalidateSettlementCascade(
    settlementId: string,
    branchId: string
  ): Promise<CacheDeleteResult> {
    try {
      let totalKeysDeleted = 0;

      // 1. Invalidate settlement's computed fields
      const settlementComputedKey = `computed-fields:settlement:${settlementId}:${branchId}`;
      const deletedComputed = await this.del(settlementComputedKey);
      totalKeysDeleted += deletedComputed;

      // 2. Invalidate settlement's structures list cache
      const structuresListKey = `structures:settlement:${settlementId}:${branchId}`;
      const deletedList = await this.del(structuresListKey);
      totalKeysDeleted += deletedList;

      // 3. Invalidate ALL structure computed fields in this settlement (pattern-based)
      // Pattern matches: computed-fields:structure:*:branchId where structure.settlementId = settlementId
      // Note: This may over-invalidate (deletes ALL structure computed fields in branch)
      // but ensures correctness. Structure-specific invalidation requires database query.
      // For precise invalidation, use invalidateStructureCascade() per structure.
      const structureComputedPattern = `computed-fields:structure:*:${branchId}`;
      const structureResult = await this.delPattern(structureComputedPattern);
      totalKeysDeleted += structureResult.keysDeleted;

      // 4. Invalidate spatial query caches (settlement location affects spatial results)
      const spatialPattern = `spatial:settlements-in-region:*:${branchId}`;
      const spatialResult = await this.delPattern(spatialPattern);
      totalKeysDeleted += spatialResult.keysDeleted;

      this.logger.log(
        `Settlement cascade invalidation: settlement=${settlementId}, branch=${branchId}, deleted=${totalKeysDeleted} keys`
      );

      return {
        success: true,
        keysDeleted: totalKeysDeleted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Settlement cascade invalidation failed for settlement=${settlementId}, branch=${branchId}: ${message}`
      );
      return {
        success: false,
        keysDeleted: 0,
        error: message,
      };
    }
  }

  /**
   * Cascade invalidation for a structure and its parent settlement.
   *
   * Invalidates:
   * 1. Structure's computed fields cache
   * 2. Parent settlement's computed fields cache (may reference child structures)
   * 3. Parent settlement's structures list cache
   *
   * This ensures complete cache consistency when a structure changes.
   * Does NOT invalidate spatial caches since structure changes don't affect
   * settlement location-based queries.
   *
   * @param structureId - Structure identifier
   * @param settlementId - Parent settlement identifier
   * @param branchId - Branch identifier
   * @returns Combined result with total keys deleted
   *
   * @example
   * ```typescript
   * // Called when structure is updated or deleted
   * await cache.invalidateStructureCascade('structure-456', 'settlement-123', 'main');
   * ```
   */
  async invalidateStructureCascade(
    structureId: string,
    settlementId: string,
    branchId: string
  ): Promise<CacheDeleteResult> {
    try {
      let totalKeysDeleted = 0;

      // 1. Invalidate structure's computed fields
      const structureComputedKey = `computed-fields:structure:${structureId}:${branchId}`;
      const deletedStructureComputed = await this.del(structureComputedKey);
      totalKeysDeleted += deletedStructureComputed;

      // 2. Invalidate parent settlement's computed fields
      // Settlement may have computed fields that reference child structures
      const settlementComputedKey = `computed-fields:settlement:${settlementId}:${branchId}`;
      const deletedSettlementComputed = await this.del(settlementComputedKey);
      totalKeysDeleted += deletedSettlementComputed;

      // 3. Invalidate parent settlement's structures list cache
      const structuresListKey = `structures:settlement:${settlementId}:${branchId}`;
      const deletedList = await this.del(structuresListKey);
      totalKeysDeleted += deletedList;

      this.logger.log(
        `Structure cascade invalidation: structure=${structureId}, settlement=${settlementId}, branch=${branchId}, deleted=${totalKeysDeleted} keys`
      );

      return {
        success: true,
        keysDeleted: totalKeysDeleted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Structure cascade invalidation failed for structure=${structureId}, settlement=${settlementId}, branch=${branchId}: ${message}`
      );
      return {
        success: false,
        keysDeleted: 0,
        error: message,
      };
    }
  }

  /**
   * Invalidate all computed fields caches in a campaign.
   *
   * Called when FieldConditions are created, updated, or deleted, since
   * FieldConditions define the logic for computed fields. Any change to
   * a FieldCondition affects ALL entities in the campaign.
   *
   * Invalidates:
   * 1. All settlement computed fields in the branch
   * 2. All structure computed fields in the branch
   *
   * Uses pattern-based deletion to avoid querying for all entity IDs.
   * This is a broad invalidation but necessary for correctness.
   *
   * @param campaignId - Campaign identifier (used for logging)
   * @param branchId - Branch identifier
   * @returns Combined result with total keys deleted
   *
   * @example
   * ```typescript
   * // Called when FieldCondition is created/updated/deleted
   * await cache.invalidateCampaignComputedFields('campaign-789', 'main');
   * ```
   */
  async invalidateCampaignComputedFields(
    campaignId: string,
    branchId: string
  ): Promise<CacheDeleteResult> {
    try {
      let totalKeysDeleted = 0;

      // 1. Invalidate ALL settlement computed fields in the branch
      const settlementPattern = `computed-fields:settlement:*:${branchId}`;
      const settlementResult = await this.delPattern(settlementPattern);
      totalKeysDeleted += settlementResult.keysDeleted;

      // 2. Invalidate ALL structure computed fields in the branch
      const structurePattern = `computed-fields:structure:*:${branchId}`;
      const structureResult = await this.delPattern(structurePattern);
      totalKeysDeleted += structureResult.keysDeleted;

      this.logger.log(
        `Campaign computed fields invalidation: campaign=${campaignId}, branch=${branchId}, deleted=${totalKeysDeleted} keys`
      );

      return {
        success: true,
        keysDeleted: totalKeysDeleted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Campaign computed fields invalidation failed for campaign=${campaignId}, branch=${branchId}: ${message}`
      );
      return {
        success: false,
        keysDeleted: 0,
        error: message,
      };
    }
  }

  /**
   * Get cache statistics.
   *
   * Returns current stats including:
   * - Hit/miss counts and calculated hit rate
   * - Operation counts (sets, deletes, pattern deletes)
   * - Start time for rate calculations
   * - Enabled flag
   *
   * @returns Current cache statistics
   *
   * @example
   * ```typescript
   * const stats = cache.getStats();
   * console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
   * console.log(`Total operations: ${stats.hits + stats.misses + stats.sets}`);
   * ```
   */
  getStats(): CacheStats {
    // Calculate current hit rate
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      ...this.stats,
      hitRate,
    };
  }

  /**
   * Reset cache statistics.
   *
   * Useful for testing or periodic metric collection.
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      sets: 0,
      deletes: 0,
      patternDeletes: 0,
      startTime: Date.now(),
      enabled: this.metricsEnabled,
    };

    if (this.loggingEnabled) {
      this.logger.debug('Cache stats reset');
    }
  }

  /**
   * Extract cache type from cache key.
   * Cache keys follow the pattern: {prefix}:{entityType}:{entityId}:{branchId}
   * The prefix is the cache type (e.g., 'computed-fields', 'settlements', 'spatial')
   * @private
   */
  private extractCacheType(key: string): string {
    const firstColonIndex = key.indexOf(':');
    if (firstColonIndex === -1) {
      return 'unknown';
    }
    return key.substring(0, firstColonIndex);
  }

  /**
   * Increment hit counter and update hit rate.
   * @private
   */
  private incrementHits(key: string): void {
    if (this.metricsEnabled) {
      this.stats.hits++;
      const cacheType = this.extractCacheType(key);
      this.cacheStatsService.recordHit(cacheType);
    }
  }

  /**
   * Increment miss counter and update hit rate.
   * @private
   */
  private incrementMisses(key: string): void {
    if (this.metricsEnabled) {
      this.stats.misses++;
      const cacheType = this.extractCacheType(key);
      this.cacheStatsService.recordMiss(cacheType);
    }
  }
}
