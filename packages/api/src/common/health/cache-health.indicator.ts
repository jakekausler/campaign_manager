import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicator, type HealthIndicatorResult } from '@nestjs/terminus';

import { CacheStatsService } from '../cache/cache-stats.service';
import { CacheService } from '../cache/cache.service';

/**
 * Health indicator for the Redis cache system.
 *
 * Checks:
 * - Redis connection status (critical)
 * - Cache hit rate (performance metric)
 * - Redis memory usage (resource monitoring)
 * - Key count by cache type (capacity monitoring)
 *
 * Status levels:
 * - healthy: Redis connected, normal operation
 * - degraded: Redis connected but low hit rate or high memory usage
 * - unhealthy: Redis disconnected or unavailable
 */
@Injectable()
export class CacheHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(CacheHealthIndicator.name);

  // Health thresholds
  private readonly MIN_HEALTHY_HIT_RATE = 0.5; // 50% hit rate minimum for healthy status
  private readonly MAX_MEMORY_WARNING_MB = 512; // Warn if cache uses > 512MB

  constructor(
    private readonly cacheService: CacheService,
    private readonly cacheStatsService: CacheStatsService
  ) {
    super();
  }

  /**
   * Performs comprehensive health check of the cache system.
   *
   * @param key - Unique identifier for this health check in the response
   * @returns HealthIndicatorResult with status and detailed metrics
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    let status: 'up' | 'degraded' | 'down' = 'up';

    try {
      // Check 1: Redis connection (critical)
      const redisConnected = await this.checkRedisConnection();
      if (!redisConnected) {
        status = 'down';
        issues.push('Redis connection failed');
        this.logger.error('Cache health check: Redis is not connected');

        return this.getStatus(key, false, {
          status: 'down',
          message: 'Redis unavailable',
          responseTime: Date.now() - startTime,
          issues,
        });
      }

      // Check 2: Cache statistics (performance metrics)
      const stats = this.cacheStatsService.getStats();
      const hitRate = stats.hitRate;

      // Check 3: Memory usage (resource monitoring)
      const memoryInfo = await this.cacheStatsService.getRedisMemoryInfo();
      const memoryUsedMB = memoryInfo ? Math.round(memoryInfo.usedMemory / (1024 * 1024)) : 0;

      // Check 4: Key counts (capacity monitoring)
      const keyCounts = await this.cacheStatsService.getKeyCountByType();
      const totalKeys = keyCounts
        ? Object.values(keyCounts).reduce((sum, count) => sum + count, 0)
        : 0;

      // Evaluate degradation conditions
      if (
        stats.enabled &&
        hitRate < this.MIN_HEALTHY_HIT_RATE &&
        stats.totalHits + stats.totalMisses > 100
      ) {
        // Only consider hit rate if we have significant traffic (>100 operations)
        status = 'degraded';
        issues.push(`Low hit rate: ${(hitRate * 100).toFixed(1)}%`);
        this.logger.warn(
          `Cache health degraded: hit rate ${(hitRate * 100).toFixed(1)}% is below threshold ${this.MIN_HEALTHY_HIT_RATE * 100}%`
        );
      }

      if (memoryUsedMB > this.MAX_MEMORY_WARNING_MB) {
        status = 'degraded';
        issues.push(`High memory usage: ${memoryUsedMB}MB`);
        this.logger.warn(
          `Cache health degraded: memory usage ${memoryUsedMB}MB exceeds warning threshold ${this.MAX_MEMORY_WARNING_MB}MB`
        );
      }

      const responseTime = Date.now() - startTime;

      // Build health check result
      const result = {
        status,
        message:
          status === 'up' ? 'Cache operating normally' : `Cache degraded: ${issues.join(', ')}`,
        responseTime,
        metrics: {
          hitRate: stats.enabled ? parseFloat((hitRate * 100).toFixed(1)) : null,
          totalHits: stats.totalHits,
          totalMisses: stats.totalMisses,
          totalKeys,
          memoryUsedMB,
          statsEnabled: stats.enabled,
        },
        issues: issues.length > 0 ? issues : undefined,
      };

      // Return healthy status (even if degraded - degraded still serves traffic)
      return this.getStatus(key, true, result);
    } catch (error) {
      this.logger.error(
        `Cache health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      return this.getStatus(key, false, {
        status: 'down',
        message: 'Health check failed',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Checks if Redis connection is active.
   *
   * @returns true if Redis is connected, false otherwise
   */
  private async checkRedisConnection(): Promise<boolean> {
    try {
      // Attempt to ping Redis via cache service
      // Use trackMetrics: false to exclude health checks from stats
      const testKey = 'health-check:ping';
      await this.cacheService.set(testKey, 'pong', { ttl: 10, trackMetrics: false });
      const result = await this.cacheService.get<string>(testKey, { trackMetrics: false });
      await this.cacheService.del(testKey, { trackMetrics: false }); // Clean up

      return result === 'pong';
    } catch (error) {
      this.logger.error(
        `Redis connection check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return false;
    }
  }
}
