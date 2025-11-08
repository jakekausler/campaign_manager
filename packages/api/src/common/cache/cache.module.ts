import { Module } from '@nestjs/common';

import { createRedisCache, REDIS_CACHE } from '../../graphql/cache/redis-cache.provider';

import { CacheService } from './cache.service';

// Re-export REDIS_CACHE token for external use (e.g., integration tests)
export { REDIS_CACHE };

/**
 * Cache Module
 *
 * Provides a unified caching layer using Redis for:
 * - Computed fields caching (Tier 1 - highest priority)
 * - Entity list caching (Tier 2)
 * - Spatial query caching (Tier 3)
 * - Rules Engine expression caching (Tier 4)
 *
 * Features:
 * - Hierarchical key structure with branch awareness
 * - Pattern-based cascading invalidation
 * - Configurable TTL with environment variables
 * - Graceful degradation (cache failures don't break functionality)
 * - Comprehensive metrics tracking (hits, misses, operations)
 *
 * Configuration (Environment Variables):
 * - CACHE_DEFAULT_TTL: Default TTL in seconds (default: 300)
 * - CACHE_METRICS_ENABLED: Enable statistics tracking (default: true)
 * - CACHE_LOGGING_ENABLED: Enable debug logging (default: false)
 * - REDIS_HOST: Redis server host (default: localhost)
 * - REDIS_PORT: Redis server port (default: 6379)
 * - REDIS_PASSWORD: Redis password (optional)
 * - REDIS_CACHE_DB: Redis database number for cache (default: 1)
 *
 * Usage:
 * ```typescript
 * // Import globally in app.module.ts
 * @Module({
 *   imports: [CacheModule],
 * })
 *
 * // Use in services
 * constructor(private readonly cache: CacheService) {}
 *
 * async getSettlement(id: string, branchId: string) {
 *   const key = buildComputedFieldsKey('settlement', id, branchId);
 *   const cached = await this.cache.get<Settlement>(key);
 *   if (cached) return cached;
 *
 *   const settlement = await this.fetchFromDatabase(id, branchId);
 *   await this.cache.set(key, settlement);
 *   return settlement;
 * }
 * ```
 */
@Module({
  providers: [
    // Redis client provider
    {
      provide: REDIS_CACHE,
      useFactory: createRedisCache,
    },
    // Cache service
    CacheService,
  ],
  exports: [
    // Export CacheService for use by other modules
    CacheService,
    // Export REDIS_CACHE token for tests that need direct Redis access
    REDIS_CACHE,
  ],
})
export class CacheModule {}
