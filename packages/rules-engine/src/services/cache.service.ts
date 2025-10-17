import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import NodeCache from 'node-cache';

/**
 * Cache key components for structured key generation
 */
interface CacheKeyComponents {
  campaignId: string;
  branchId: string;
  nodeId: string;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  ksize: number;
  vsize: number;
  hitRate: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  ttl: number; // Time to live in seconds
  checkperiod: number; // Period for automatic delete check in seconds
  maxKeys: number; // Maximum number of keys
  useClones: boolean; // Whether to clone data on get/set
}

/**
 * CacheService provides in-memory caching with TTL and invalidation support.
 *
 * Features:
 * - TTL-based expiration with configurable default
 * - Maximum key limit to prevent unbounded growth
 * - Structured key generation (campaign:branch:nodeId)
 * - Statistics and monitoring (hits, misses, hit rate)
 * - Wildcard invalidation by prefix pattern
 * - Graceful cleanup on shutdown
 *
 * Cache Key Format:
 * - Full key: "campaign:{campaignId}:branch:{branchId}:node:{nodeId}"
 * - Campaign prefix: "campaign:{campaignId}"
 * - Branch prefix: "campaign:{campaignId}:branch:{branchId}"
 *
 * Performance Characteristics:
 * - Get: O(1)
 * - Set: O(1)
 * - Delete: O(1)
 * - Clear by prefix: O(n) where n = total keys
 *
 * Known Limitations:
 * - In-memory only (lost on restart)
 * - Single-node (not distributed)
 * - Wildcard invalidation is O(n) operation
 * - No persistence or durability guarantees
 *
 * @example
 * ```typescript
 * const cacheService = new CacheService();
 * cacheService.set({ campaignId: 'c1', branchId: 'main', nodeId: 'cond-123' }, { result: true });
 * const cached = cacheService.get({ campaignId: 'c1', branchId: 'main', nodeId: 'cond-123' });
 * cacheService.invalidate({ campaignId: 'c1', branchId: 'main', nodeId: 'cond-123' });
 * ```
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly cache: NodeCache;
  private readonly config: CacheConfig;

  constructor() {
    // Load and validate configuration from environment variables with defaults
    this.config = {
      ttl: this.validateNumericEnv(
        'CACHE_TTL_SECONDS',
        300, // 5 minutes default
        1, // min: 1 second
        86400 // max: 24 hours
      ),
      checkperiod: this.validateNumericEnv(
        'CACHE_CHECK_PERIOD_SECONDS',
        60, // 1 minute default
        10, // min: 10 seconds
        3600 // max: 1 hour
      ),
      maxKeys: this.validateNumericEnv(
        'CACHE_MAX_KEYS',
        10000, // 10k keys default
        100, // min: 100 keys
        1000000 // max: 1 million keys
      ),
      useClones: false, // Don't clone for performance (data is immutable)
    };

    this.cache = new NodeCache({
      stdTTL: this.config.ttl,
      checkperiod: this.config.checkperiod,
      useClones: this.config.useClones,
      maxKeys: this.config.maxKeys,
    });

    // Log when keys expire (useful for debugging)
    this.cache.on('expired', (key: string) => {
      this.logger.debug(`Cache key expired: ${key}`);
    });

    // Log when cache is full (should trigger monitoring alert)
    this.cache.on('set', () => {
      const stats = this.cache.getStats();
      if (stats.keys >= this.config.maxKeys * 0.9) {
        this.logger.warn(
          `Cache is ${Math.round((stats.keys / this.config.maxKeys) * 100)}% full (${stats.keys}/${this.config.maxKeys} keys)`
        );
      }
    });

    this.logger.log(
      `CacheService initialized with TTL=${this.config.ttl}s, maxKeys=${this.config.maxKeys}, checkPeriod=${this.config.checkperiod}s`
    );
  }

  /**
   * Validate and constrain numeric environment variable.
   *
   * @param name - Environment variable name
   * @param defaultValue - Default value if not set or invalid
   * @param min - Minimum allowed value
   * @param max - Maximum allowed value
   * @returns Validated numeric value within bounds
   */
  private validateNumericEnv(name: string, defaultValue: number, min: number, max: number): number {
    const rawValue = process.env[name];

    if (!rawValue) {
      return defaultValue;
    }

    const parsed = parseInt(rawValue, 10);

    // Check for invalid parse (NaN)
    if (isNaN(parsed)) {
      this.logger.warn(
        `Invalid ${name}="${rawValue}" (not a number), using default ${defaultValue}`
      );
      return defaultValue;
    }

    // Check bounds
    if (parsed < min) {
      this.logger.warn(`${name}=${parsed} is below minimum ${min}, clamping to minimum`);
      return min;
    }

    if (parsed > max) {
      this.logger.warn(`${name}=${parsed} is above maximum ${max}, clamping to maximum`);
      return max;
    }

    return parsed;
  }

  /**
   * Sanitize cache key component by escaping delimiter characters.
   *
   * Prevents key collisions by escaping colons in component values.
   * For example, "campaign:123" becomes "campaign\:123" so it won't
   * be confused with the delimiter structure.
   *
   * @param component - Raw component string
   * @returns Sanitized component string
   */
  private sanitizeKeyComponent(component: string): string {
    return component.replace(/:/g, '\\:');
  }

  /**
   * Generate a structured cache key from components.
   *
   * Format: "campaign:{campaignId}:branch:{branchId}:node:{nodeId}"
   *
   * This format enables:
   * - Exact key lookups for get/set/delete
   * - Prefix-based invalidation (e.g., all keys for a campaign)
   * - Easy debugging (human-readable keys)
   *
   * Components are sanitized to prevent key collisions from embedded colons.
   *
   * @param components - Cache key components
   * @returns Formatted cache key string
   */
  private generateKey(components: CacheKeyComponents): string {
    const sanitizedCampaignId = this.sanitizeKeyComponent(components.campaignId);
    const sanitizedBranchId = this.sanitizeKeyComponent(components.branchId);
    const sanitizedNodeId = this.sanitizeKeyComponent(components.nodeId);

    return `campaign:${sanitizedCampaignId}:branch:${sanitizedBranchId}:node:${sanitizedNodeId}`;
  }

  /**
   * Generate a prefix for wildcard operations.
   *
   * Examples:
   * - Campaign prefix: "campaign:{campaignId}"
   * - Branch prefix: "campaign:{campaignId}:branch:{branchId}"
   *
   * Components are sanitized to prevent prefix matching issues from embedded colons.
   *
   * @param campaignId - Campaign identifier
   * @param branchId - Optional branch identifier
   * @returns Prefix string for pattern matching
   */
  private generatePrefix(campaignId: string, branchId?: string): string {
    const sanitizedCampaignId = this.sanitizeKeyComponent(campaignId);

    if (branchId) {
      const sanitizedBranchId = this.sanitizeKeyComponent(branchId);
      return `campaign:${sanitizedCampaignId}:branch:${sanitizedBranchId}`;
    }

    return `campaign:${sanitizedCampaignId}`;
  }

  /**
   * Get a value from the cache.
   *
   * @param components - Cache key components
   * @returns Cached value or undefined if not found or expired
   */
  get<T>(components: CacheKeyComponents): T | undefined {
    const key = this.generateKey(components);
    const value = this.cache.get<T>(key);

    if (value === undefined) {
      this.logger.debug(`Cache MISS: ${key}`);
    } else {
      this.logger.debug(`Cache HIT: ${key}`);
    }

    return value;
  }

  /**
   * Set a value in the cache with optional custom TTL.
   *
   * @param components - Cache key components
   * @param value - Value to cache
   * @param ttl - Optional TTL in seconds (overrides default)
   * @returns True if successful, false otherwise
   */
  set<T>(components: CacheKeyComponents, value: T, ttl?: number): boolean {
    const key = this.generateKey(components);

    const success =
      ttl !== undefined ? this.cache.set(key, value, ttl) : this.cache.set(key, value);

    if (success) {
      this.logger.debug(`Cache SET: ${key} (TTL=${ttl ?? this.config.ttl}s)`);
    } else {
      this.logger.warn(`Cache SET failed: ${key}`);
    }

    return success;
  }

  /**
   * Invalidate (delete) a specific cache entry.
   *
   * @param components - Cache key components
   * @returns Number of deleted entries (0 or 1)
   */
  invalidate(components: CacheKeyComponents): number {
    const key = this.generateKey(components);
    const deleted = this.cache.del(key);

    if (deleted > 0) {
      this.logger.debug(`Cache INVALIDATE: ${key}`);
    }

    return deleted;
  }

  /**
   * Invalidate all cache entries for a campaign or branch.
   *
   * This is an O(n) operation where n = total cache keys.
   * Use judiciously.
   *
   * @param campaignId - Campaign identifier
   * @param branchId - Optional branch identifier (if omitted, clears entire campaign)
   * @returns Number of deleted entries
   */
  invalidateByPrefix(campaignId: string, branchId?: string): number {
    const prefix = this.generatePrefix(campaignId, branchId);
    const allKeys = this.cache.keys();
    const matchingKeys = allKeys.filter((key) => key.startsWith(prefix));

    const deleted = this.cache.del(matchingKeys);

    this.logger.log(`Cache INVALIDATE by prefix: ${prefix} (deleted ${deleted} keys)`);

    return deleted;
  }

  /**
   * Clear all cache entries.
   *
   * Use with caution - typically only needed for testing or emergency scenarios.
   */
  clear(): void {
    this.cache.flushAll();
    this.logger.log('Cache CLEARED: all entries deleted');
  }

  /**
   * Get cache statistics for monitoring.
   *
   * @returns Cache statistics including hit rate
   */
  getStats(): CacheStats {
    const stats = this.cache.getStats();

    return {
      hits: stats.hits,
      misses: stats.misses,
      keys: stats.keys,
      ksize: stats.ksize,
      vsize: stats.vsize,
      hitRate: stats.hits + stats.misses > 0 ? stats.hits / (stats.hits + stats.misses) : 0,
    };
  }

  /**
   * Get current cache configuration.
   *
   * @returns Current cache configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Check if a key exists in the cache without counting as a hit.
   *
   * @param components - Cache key components
   * @returns True if key exists and not expired
   */
  has(components: CacheKeyComponents): boolean {
    const key = this.generateKey(components);
    return this.cache.has(key);
  }

  /**
   * Get all cache keys (for debugging/testing).
   *
   * @returns Array of all cache keys
   */
  keys(): string[] {
    return this.cache.keys();
  }

  /**
   * Get keys matching a prefix.
   *
   * @param campaignId - Campaign identifier
   * @param branchId - Optional branch identifier
   * @returns Array of matching keys
   */
  keysByPrefix(campaignId: string, branchId?: string): string[] {
    const prefix = this.generatePrefix(campaignId, branchId);
    return this.cache.keys().filter((key) => key.startsWith(prefix));
  }

  /**
   * Cleanup on module destroy.
   */
  onModuleDestroy() {
    this.logger.log('CacheService shutting down, clearing cache');
    this.cache.flushAll();
    this.cache.close();
  }
}
