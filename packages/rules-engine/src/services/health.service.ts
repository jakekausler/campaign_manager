/**
 * Health Check Service
 * Provides health status for the Rules Engine Worker
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { CacheService } from './cache.service';
import { DependencyGraphService } from './dependency-graph.service';
import { RedisService } from './redis.service';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: HealthCheckResult;
    redis: HealthCheckResult;
    cache: HealthCheckResult;
    dependencyGraph: HealthCheckResult;
  };
}

export interface HealthCheckResult {
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  responseTime?: number;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime: number;
  private prisma: PrismaClient;

  constructor(
    private readonly cacheService: CacheService,
    private readonly dependencyGraphService: DependencyGraphService,
    private readonly redisService: RedisService
  ) {
    this.startTime = Date.now();
    this.prisma = new PrismaClient();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  /**
   * Liveness probe - basic application health
   * Returns 200 if the application is alive
   */
  async checkLiveness(): Promise<{ status: string }> {
    return { status: 'alive' };
  }

  /**
   * Readiness probe - checks if the service is ready to serve traffic
   * Returns 200 if all dependencies are healthy
   */
  async checkReadiness(): Promise<HealthStatus> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkCache(),
      this.checkDependencyGraph(),
    ]);

    const [database, redis, cache, dependencyGraph] = checks;

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // If database fails, service is unhealthy (critical dependency)
    if (database.status === 'fail') {
      status = 'unhealthy';
    }
    // If any non-critical component has warning or failure, service is degraded but operational
    else if (
      redis.status === 'warn' ||
      redis.status === 'fail' ||
      cache.status === 'warn' ||
      cache.status === 'fail' ||
      dependencyGraph.status === 'warn' ||
      dependencyGraph.status === 'fail'
    ) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks: {
        database,
        redis,
        cache,
        dependencyGraph,
      },
    };
  }

  /**
   * Full health check with detailed information
   */
  async checkHealth(): Promise<HealthStatus> {
    return this.checkReadiness();
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Simple query to verify database connection
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'pass',
        message: 'Database connection successful',
        responseTime: Date.now() - start,
      };
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Database connection failed',
        responseTime: Date.now() - start,
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const isConnected = this.redisService.isConnected();

      if (!isConnected) {
        return {
          status: 'warn',
          message: 'Redis not connected (service will continue with limited functionality)',
          responseTime: Date.now() - start,
        };
      }

      return {
        status: 'pass',
        message: 'Redis connection active',
        responseTime: Date.now() - start,
      };
    } catch (error) {
      this.logger.error('Redis health check failed', error);
      return {
        status: 'warn',
        message: error instanceof Error ? error.message : 'Redis check failed',
        responseTime: Date.now() - start,
      };
    }
  }

  /**
   * Check cache service
   */
  private async checkCache(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Get cache statistics to verify it's operational
      const stats = this.cacheService.getStats();

      return {
        status: 'pass',
        message: `Cache operational (${stats.keys} keys, ${(stats.hitRate * 100).toFixed(1)}% hit rate)`,
        responseTime: Date.now() - start,
      };
    } catch (error) {
      this.logger.error('Cache health check failed', error);
      return {
        status: 'warn',
        message: error instanceof Error ? error.message : 'Cache check failed',
        responseTime: Date.now() - start,
      };
    }
  }

  /**
   * Check dependency graph service
   */
  private async checkDependencyGraph(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Get cache statistics to verify service is operational
      const stats = this.dependencyGraphService.getCacheStats();

      return {
        status: 'pass',
        message: `Dependency graph service operational (${stats.cachedGraphs} graphs cached)`,
        responseTime: Date.now() - start,
      };
    } catch (error) {
      this.logger.error('Dependency graph health check failed', error);
      return {
        status: 'warn',
        message: error instanceof Error ? error.message : 'Dependency graph check failed',
        responseTime: Date.now() - start,
      };
    }
  }
}
