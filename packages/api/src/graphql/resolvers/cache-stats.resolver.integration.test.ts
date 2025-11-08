import { ForbiddenException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Redis } from 'ioredis';

import { CacheStatsService } from '../../common/cache/cache-stats.service';
import { CacheService } from '../../common/cache/cache.service';
import { REDIS_CACHE } from '../cache/redis-cache.provider';
import type { AuthenticatedUser } from '../context/graphql-context';

import { CacheStatsResolver } from './cache-stats.resolver';

/**
 * Integration tests for CacheStatsResolver
 *
 * Tests the getCacheStats GraphQL query with admin authentication.
 * Verifies:
 * - Admin users can access cache statistics
 * - Non-admin users are denied access (ForbiddenException)
 * - Response structure matches CacheStats GraphQL type
 * - Statistics values are valid and in expected ranges
 */
describe('CacheStatsResolver Integration Tests', () => {
  let app: INestApplication;
  let resolver: CacheStatsResolver;
  let cacheService: CacheService;
  let cacheStatsService: CacheStatsService;
  let redisClient: Redis;

  // Mock authenticated users with different roles
  let adminUser: AuthenticatedUser;
  let gmUser: AuthenticatedUser;
  let playerUser: AuthenticatedUser;

  // Read from environment (for docker-compose networking)
  const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

  beforeAll(async () => {
    // Set up test users with different roles
    adminUser = {
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin', // Required role for getCacheStats
    };

    gmUser = {
      id: 'gm-1',
      email: 'gm@example.com',
      role: 'gm', // Different role to test denial
    };

    playerUser = {
      id: 'player-1',
      email: 'player@example.com',
      role: 'player', // Different role to test denial
    };

    // Set environment variables for services
    process.env.CACHE_DEFAULT_TTL = '300';
    process.env.CACHE_METRICS_ENABLED = 'true';
    process.env.CACHE_STATS_TRACKING_ENABLED = 'true';
    process.env.CACHE_STATS_RESET_PERIOD_MS = '0'; // Disable auto-reset
    process.env.CACHE_LOGGING_ENABLED = 'false';

    // Create REAL Redis connection for integration testing
    redisClient = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      db: 1, // Use DB 1 for cache
      retryStrategy: (times) => {
        if (times > 3) {
          return null;
        }
        return Math.min(times * 50, 2000);
      },
    });

    // Create test module with all required providers
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CacheStatsResolver,
        CacheService,
        CacheStatsService,
        {
          provide: REDIS_CACHE,
          useValue: redisClient,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    resolver = moduleRef.get<CacheStatsResolver>(CacheStatsResolver);
    cacheService = moduleRef.get<CacheService>(CacheService);
    cacheStatsService = moduleRef.get<CacheStatsService>(CacheStatsService);

    // Wait for Redis to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Clean up Redis
    await redisClient.flushdb();
    await redisClient.quit();
    await app.close();
  });

  beforeEach(async () => {
    // Clear Redis and reset stats before each test
    await redisClient.flushdb();
    cacheService.resetStats();
    cacheStatsService.resetStats();
  });

  describe('Authorization', () => {
    it('should return cache stats for admin user', async () => {
      const result = await resolver.getCacheStats(adminUser);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('totalHits');
      expect(result).toHaveProperty('totalMisses');
      expect(result).toHaveProperty('hitRate');
    });

    it('should throw ForbiddenException for GM role', async () => {
      await expect(resolver.getCacheStats(gmUser)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for player role', async () => {
      await expect(resolver.getCacheStats(playerUser)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for non-admin user', async () => {
      const regularUser: AuthenticatedUser = {
        id: 'user-1',
        email: 'user@example.com',
        role: 'user',
      };

      await expect(resolver.getCacheStats(regularUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Response Structure', () => {
    it('should return valid cache statistics structure', async () => {
      const result = await resolver.getCacheStats(adminUser);

      // Required fields
      expect(result).toEqual(
        expect.objectContaining({
          totalHits: expect.any(Number),
          totalMisses: expect.any(Number),
          hitRate: expect.any(Number),
          totalSets: expect.any(Number),
          totalInvalidations: expect.any(Number),
          totalCascadeInvalidations: expect.any(Number),
          enabled: expect.any(Boolean),
          startTime: expect.any(Date),
          estimatedTimeSavedMs: expect.any(Number),
        })
      );
    });

    it('should return enabled=true when tracking is enabled', async () => {
      const result = await resolver.getCacheStats(adminUser);

      expect(result.enabled).toBe(true);
    });

    it('should include memoryInfo when Redis INFO is available', async () => {
      const result = await resolver.getCacheStats(adminUser);

      // memoryInfo is optional but should be present with real Redis
      if (result.memoryInfo) {
        expect(result.memoryInfo).toEqual(
          expect.objectContaining({
            usedMemory: expect.any(Number),
            usedMemoryHuman: expect.any(String),
            usedMemoryPeak: expect.any(Number),
            usedMemoryPeakHuman: expect.any(String),
            dbKeys: expect.any(Number),
            dbExpires: expect.any(Number),
          })
        );
      }
    });
  });

  describe('Statistics Validation', () => {
    it('should return non-negative statistics', async () => {
      const result = await resolver.getCacheStats(adminUser);

      expect(result.totalHits).toBeGreaterThanOrEqual(0);
      expect(result.totalMisses).toBeGreaterThanOrEqual(0);
      expect(result.totalSets).toBeGreaterThanOrEqual(0);
      expect(result.totalInvalidations).toBeGreaterThanOrEqual(0);
      expect(result.totalCascadeInvalidations).toBeGreaterThanOrEqual(0);
      expect(result.estimatedTimeSavedMs).toBeGreaterThanOrEqual(0);
    });

    it('should return hit rate in valid range (0.0 to 1.0)', async () => {
      const result = await resolver.getCacheStats(adminUser);

      expect(result.hitRate).toBeGreaterThanOrEqual(0);
      expect(result.hitRate).toBeLessThanOrEqual(1);
    });

    it('should return zero stats when no cache operations have occurred', async () => {
      const result = await resolver.getCacheStats(adminUser);

      expect(result.totalHits).toBe(0);
      expect(result.totalMisses).toBe(0);
      expect(result.totalSets).toBe(0);
      expect(result.totalInvalidations).toBe(0);
      expect(result.totalCascadeInvalidations).toBe(0);
      expect(result.hitRate).toBe(0);
      expect(result.estimatedTimeSavedMs).toBe(0);
    });

    it('should return accurate stats after cache operations', async () => {
      // Perform cache operations
      await cacheService.set('computed-fields:settlement:1:main', { id: 1 });
      await cacheService.set('settlements:kingdom:1:main', { list: [1, 2] });

      await cacheService.get('computed-fields:settlement:1:main'); // hit
      await cacheService.get('settlements:kingdom:1:main'); // hit
      await cacheService.get('computed-fields:settlement:999:main'); // miss

      await cacheService.del('settlements:kingdom:1:main'); // invalidation

      // Get stats via GraphQL resolver
      const result = await resolver.getCacheStats(adminUser);

      expect(result.totalSets).toBe(2);
      expect(result.totalHits).toBe(2);
      expect(result.totalMisses).toBe(1);
      expect(result.totalInvalidations).toBe(1);
      expect(result.hitRate).toBeCloseTo(0.667, 2); // 2 hits / 3 total (hits + misses)
    });
  });

  describe('Per-Type Statistics', () => {
    it('should include per-type stats when cache operations exist', async () => {
      // Set up data for computed-fields cache type
      await cacheService.set('computed-fields:settlement:1:main', { id: 1 });
      await cacheService.get('computed-fields:settlement:1:main');

      const result = await resolver.getCacheStats(adminUser);

      // Per-type stats are optional but should be present when operations exist
      if (result.computedFields) {
        expect(result.computedFields).toEqual(
          expect.objectContaining({
            hits: expect.any(Number),
            misses: expect.any(Number),
            sets: expect.any(Number),
            invalidations: expect.any(Number),
            cascadeInvalidations: expect.any(Number),
            hitRate: expect.any(Number),
          })
        );

        expect(result.computedFields.sets).toBe(1);
        expect(result.computedFields.hits).toBe(1);
        expect(result.computedFields.hitRate).toBe(1.0);
      }
    });

    it('should track multiple cache types independently', async () => {
      // Set up data for all cache types
      await cacheService.set('computed-fields:settlement:1:main', { cf: true });
      await cacheService.set('settlements:kingdom:1:main', { settlements: true });
      await cacheService.set('structures:settlement:1:main', { structures: true });
      await cacheService.set('spatial:region:1:main', { spatial: true });

      // Mix of hits and misses for each type
      await cacheService.get('computed-fields:settlement:1:main'); // hit
      await cacheService.get('settlements:kingdom:1:main'); // hit
      await cacheService.get('structures:settlement:1:main'); // hit
      await cacheService.get('spatial:region:1:main'); // hit

      const result = await resolver.getCacheStats(adminUser);

      // Each type should have 1 set and 1 hit
      if (result.computedFields) {
        expect(result.computedFields.sets).toBe(1);
        expect(result.computedFields.hits).toBe(1);
      }
      if (result.settlements) {
        expect(result.settlements.sets).toBe(1);
        expect(result.settlements.hits).toBe(1);
      }
      if (result.structures) {
        expect(result.structures.sets).toBe(1);
        expect(result.structures.hits).toBe(1);
      }
      if (result.spatial) {
        expect(result.spatial.sets).toBe(1);
        expect(result.spatial.hits).toBe(1);
      }
    });
  });

  describe('Estimated Time Saved', () => {
    it('should calculate time saved based on cache hits', async () => {
      // Set up and hit computed-fields cache (300ms per hit estimate)
      await cacheService.set('computed-fields:settlement:1:main', { id: 1 });
      await cacheService.get('computed-fields:settlement:1:main'); // hit
      await cacheService.get('computed-fields:settlement:1:main'); // hit

      const result = await resolver.getCacheStats(adminUser);

      // 2 hits * 300ms = 600ms estimated time saved
      expect(result.estimatedTimeSavedMs).toBe(600);
    });

    it('should aggregate time saved across different cache types', async () => {
      // computed-fields: 300ms per hit
      await cacheService.set('computed-fields:settlement:1:main', { id: 1 });
      await cacheService.get('computed-fields:settlement:1:main'); // 1 hit = 300ms

      // settlements: 25ms per hit
      await cacheService.set('settlements:kingdom:1:main', { list: [1, 2] });
      await cacheService.get('settlements:kingdom:1:main'); // 1 hit = 25ms

      const result = await resolver.getCacheStats(adminUser);

      // Total: 300 + 25 = 325ms
      expect(result.estimatedTimeSavedMs).toBe(325);
    });
  });

  describe('Real-World Usage Scenario', () => {
    it('should return comprehensive stats after typical cache usage', async () => {
      // Simulate typical application cache usage

      // Phase 1: Cache warming (sets)
      await cacheService.set('computed-fields:settlement:1:main', { id: 1 });
      await cacheService.set('computed-fields:settlement:2:main', { id: 2 });
      await cacheService.set('settlements:kingdom:1:main', { list: [1, 2] });

      // Phase 2: Cache hits
      await cacheService.get('computed-fields:settlement:1:main');
      await cacheService.get('computed-fields:settlement:2:main');
      await cacheService.get('settlements:kingdom:1:main');

      // Phase 3: Cache misses
      await cacheService.get('computed-fields:settlement:999:main');
      await cacheService.get('structures:settlement:1:main');

      // Phase 4: Invalidations
      await cacheService.del('settlements:kingdom:1:main');

      // Phase 5: Pattern deletion (cascade invalidation)
      await cacheService.delPattern('computed-fields:*'); // Deletes 2 keys

      // Get stats
      const result = await resolver.getCacheStats(adminUser);

      // Verify aggregate stats
      expect(result.totalSets).toBe(3);
      expect(result.totalHits).toBe(3);
      expect(result.totalMisses).toBe(2);
      expect(result.totalInvalidations).toBe(1);
      expect(result.totalCascadeInvalidations).toBe(2);
      expect(result.hitRate).toBe(0.6); // 3 hits / 5 total (hits + misses)

      // Verify time saved (3 hits: 2 computed-fields @ 300ms + 1 settlements @ 25ms)
      expect(result.estimatedTimeSavedMs).toBe(625);

      // Verify enabled flag
      expect(result.enabled).toBe(true);

      // Verify start time is recent
      const now = Date.now();
      const startTime = new Date(result.startTime).getTime();
      expect(now - startTime).toBeLessThan(60000); // Within last minute
    });
  });
});
