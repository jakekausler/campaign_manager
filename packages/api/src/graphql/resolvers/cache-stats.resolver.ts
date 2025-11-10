import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CacheStatsService } from '../../common/cache/cache-stats.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CacheStats } from '../types/cache-stats.type';

@Resolver(() => CacheStats)
export class CacheStatsResolver {
  constructor(private readonly cacheStatsService: CacheStatsService) {}

  /**
   * Retrieves comprehensive cache performance statistics.
   *
   * Provides Redis cache metrics including hit/miss rates, memory usage,
   * time saved estimates, and per-type breakdowns (computed fields, settlements,
   * structures, spatial). This endpoint is restricted to admin users only for
   * security and performance monitoring purposes.
   *
   * **Authorization:** Admin role required (enforced by both decorator and explicit check)
   *
   * **Side Effects:**
   * - Queries Redis for memory info (INFO MEMORY command)
   * - Scans Redis keys to count by type (SCAN command)
   *
   * @param user - The authenticated admin user
   * @returns Aggregated cache statistics with performance metrics
   *
   * @throws {ForbiddenException} If user is not an admin
   *
   * @see {@link CacheStatsService.getStats} for in-memory stats aggregation
   * @see {@link CacheStatsService.getRedisMemoryInfo} for Redis memory details
   * @see {@link CacheStatsService.estimateTimeSaved} for performance calculations
   *
   * @example
   * ```graphql
   * query {
   *   getCacheStats {
   *     totalHits
   *     totalMisses
   *     hitRate
   *     estimatedTimeSavedMs
   *     computedFields { hits misses hitRate }
   *     memoryInfo { usedMemoryMb peakMemoryMb }
   *   }
   * }
   * ```
   */
  @Query(() => CacheStats, {
    description:
      'Get cache statistics including hit/miss rates, memory usage, and performance metrics (admin-only)',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getCacheStats(@CurrentUser() user: AuthenticatedUser): Promise<CacheStats> {
    // Explicit role check for integration tests + runtime enforcement
    if (user.role !== 'admin') {
      throw new ForbiddenException('Only admin users can access cache statistics');
    }

    // Get aggregated stats from the service
    const stats = this.cacheStatsService.getStats();

    // Get Redis memory info
    const memoryInfo = await this.cacheStatsService.getRedisMemoryInfo();

    // Get key counts per cache type
    const keyCounts = await this.cacheStatsService.getKeyCountByType();

    // Calculate estimated time saved (in milliseconds)
    const estimatedTimeSavedMs = this.cacheStatsService.estimateTimeSaved();

    // Build the CacheStats response
    const response: CacheStats = {
      // Totals
      totalHits: stats.totalHits,
      totalMisses: stats.totalMisses,
      totalSets: stats.totalSets,
      totalInvalidations: stats.totalInvalidations,
      totalCascadeInvalidations: stats.totalCascadeInvalidations,

      // Calculated metrics
      hitRate: stats.hitRate,
      estimatedTimeSavedMs,

      // Metadata
      startTime: new Date(stats.startTime),
      enabled: stats.enabled,

      // Per-type breakdown
      computedFields: stats.byType['computed-fields'] || undefined,
      settlements: stats.byType['settlements'] || undefined,
      structures: stats.byType['structures'] || undefined,
      spatial: stats.byType['spatial'] || undefined,

      // Memory info
      memoryInfo: memoryInfo || undefined,

      // Key counts
      computedFieldsKeyCount: keyCounts?.['computed-fields'] || undefined,
      settlementsKeyCount: keyCounts?.['settlements'] || undefined,
      structuresKeyCount: keyCounts?.['structures'] || undefined,
      spatialKeyCount: keyCounts?.['spatial'] || undefined,
    };

    return response;
  }
}
