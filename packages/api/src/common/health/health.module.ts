import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { CacheModule } from '../cache/cache.module';

import { CacheHealthIndicator } from './cache-health.indicator';

/**
 * Health module for NestJS Terminus health checks.
 *
 * Provides health indicators for monitoring system components:
 * - CacheHealthIndicator: Redis cache system health
 *
 * This module can be imported by other modules that need to expose
 * health check endpoints (e.g., via controllers).
 */
@Module({
  imports: [
    TerminusModule, // NestJS Terminus for standardized health checks
    CacheModule, // Required for CacheService and CacheStatsService
  ],
  providers: [CacheHealthIndicator],
  exports: [CacheHealthIndicator], // Export for use in health check controllers
})
export class HealthModule {}
