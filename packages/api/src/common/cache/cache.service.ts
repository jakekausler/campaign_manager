import { Injectable, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

import { REDIS_CACHE } from '../../graphql/cache/redis-cache.provider';

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

  constructor(@Inject(REDIS_CACHE) private readonly redis: Redis) {
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
   * ```
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);

      if (value === null) {
        this.incrementMisses();
        if (this.loggingEnabled) {
          this.logger.debug(`Cache MISS: ${key}`);
        }
        return null;
      }

      this.incrementHits();
      if (this.loggingEnabled) {
        this.logger.debug(`Cache HIT: ${key}`);
      }

      return JSON.parse(value) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cache get failed for key "${key}": ${message}`);
      this.incrementMisses(); // Count as miss for accurate hit rate
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
    try {
      const ttl = options.ttl ?? this.defaultTtl;
      const serialized = JSON.stringify(value);

      await this.redis.setex(key, ttl, serialized);

      if (this.metricsEnabled) {
        this.stats.sets++;
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
   * @returns Number of keys deleted (0 or 1)
   *
   * @example
   * ```typescript
   * await cache.del('computed-fields:settlement:123:main');
   * ```
   */
  async del(key: string): Promise<number> {
    try {
      const count = await this.redis.del(key);

      if (this.metricsEnabled) {
        this.stats.deletes++;
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
   * @param pattern - Redis pattern with wildcards (* and ?)
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

      // Use SCAN to iterate without blocking Redis
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        if (keys.length > 0) {
          const deleted = await this.redis.del(...keys);
          keysDeleted += deleted;
        }
      } while (cursor !== '0');

      if (this.metricsEnabled) {
        this.stats.patternDeletes++;
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
   * Increment hit counter and update hit rate.
   * @private
   */
  private incrementHits(): void {
    if (this.metricsEnabled) {
      this.stats.hits++;
    }
  }

  /**
   * Increment miss counter and update hit rate.
   * @private
   */
  private incrementMisses(): void {
    if (this.metricsEnabled) {
      this.stats.misses++;
    }
  }
}
