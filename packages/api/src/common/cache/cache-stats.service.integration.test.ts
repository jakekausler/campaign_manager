import { Test, TestingModule } from '@nestjs/testing';
import { Redis } from 'ioredis';

import { REDIS_CACHE } from '../../graphql/cache/redis-cache.provider';

import { CacheStatsService } from './cache-stats.service';
import { CacheService } from './cache.service';

/**
 * Integration tests for CacheStatsService with real Redis and CacheService
 *
 * These tests verify that statistics persist across cache operations and
 * that the CacheStatsService correctly tracks all operations from CacheService.
 *
 * These tests are skipped by default because they require:
 * 1. Docker and docker-compose installed
 * 2. Redis service running (docker-compose up -d redis)
 *
 * To run these tests locally:
 * 1. Start Redis: docker-compose up -d redis
 * 2. Remove .skip from describe.skip below
 * 3. Run tests: pnpm --filter @campaign/api test cache-stats.service.integration
 * 4. Cleanup: docker-compose down
 */
describe.skip('CacheStatsService - Redis Integration', () => {
  let cacheService: CacheService;
  let cacheStatsService: CacheStatsService;
  let redisClient: Redis;
  let testRedis: Redis;

  // Read from environment (for docker-compose networking)
  const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

  beforeAll(async () => {
    // Set environment variables for CacheService and CacheStatsService
    process.env.CACHE_DEFAULT_TTL = '300';
    process.env.CACHE_METRICS_ENABLED = 'true';
    process.env.CACHE_STATS_TRACKING_ENABLED = 'true'; // Enable stats tracking
    process.env.CACHE_STATS_RESET_PERIOD_MS = '0'; // Disable auto-reset for tests
    process.env.CACHE_LOGGING_ENABLED = 'false';

    // Create REAL Redis connection (used by CacheService and CacheStatsService)
    redisClient = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      db: 1, // Use DB 1 for cache (DB 0 for pub/sub)
      retryStrategy: (times) => {
        if (times > 3) {
          return null; // Stop retrying after 3 attempts
        }
        return Math.min(times * 50, 2000);
      },
    });

    // Create separate Redis client for test assertions
    testRedis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      db: 1,
    });

    // Create test module with real Redis client and BOTH services
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: REDIS_CACHE,
          useValue: redisClient,
        },
        CacheService,
        CacheStatsService,
      ],
    }).compile();

    cacheService = module.get<CacheService>(CacheService);
    cacheStatsService = module.get<CacheStatsService>(CacheStatsService);

    // Wait for Redis to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Clean up all test data
    await testRedis.flushdb();

    // Disconnect both clients
    await redisClient.quit();
    await testRedis.quit();
  });

  beforeEach(async () => {
    // Clear database before each test for isolation
    await testRedis.flushdb();

    // Reset both stats systems
    cacheService.resetStats();
    cacheStatsService.resetStats();
  });

  describe('Stats Persistence Across Operations', () => {
    it('should track stats across multiple set operations', async () => {
      // Perform multiple set operations
      await cacheService.set('computed-fields:settlement:1:main', { id: 1 });
      await cacheService.set('computed-fields:settlement:2:main', { id: 2 });
      await cacheService.set('settlements:kingdom:1:main', { list: [1, 2] });

      // Verify stats accumulated correctly
      const stats = cacheStatsService.getStats();

      expect(stats.totalSets).toBe(3);
      expect(stats.enabled).toBe(true);

      // Verify per-type breakdown
      expect(stats.byType['computed-fields']).toBeDefined();
      expect(stats.byType['computed-fields'].sets).toBe(2);
      expect(stats.byType['settlements']).toBeDefined();
      expect(stats.byType['settlements'].sets).toBe(1);
    });

    it('should track stats across mixed get operations (hits and misses)', async () => {
      // Set up some cached data
      await cacheService.set('computed-fields:settlement:1:main', { id: 1 });
      await cacheService.set('settlements:kingdom:1:main', { list: [1, 2] });

      // Cache hits
      await cacheService.get('computed-fields:settlement:1:main');
      await cacheService.get('settlements:kingdom:1:main');
      await cacheService.get('computed-fields:settlement:1:main'); // Hit same key again

      // Cache misses
      await cacheService.get('computed-fields:settlement:999:main'); // Non-existent
      await cacheService.get('structures:settlement:1:main'); // Non-existent

      // Verify stats accumulated correctly
      const stats = cacheStatsService.getStats();

      expect(stats.totalHits).toBe(3);
      expect(stats.totalMisses).toBe(2);
      expect(stats.hitRate).toBe(0.6); // 3 hits / 5 total operations

      // Verify per-type breakdown
      expect(stats.byType['computed-fields'].hits).toBe(2);
      expect(stats.byType['computed-fields'].misses).toBe(1);
      expect(stats.byType['settlements'].hits).toBe(1);
      expect(stats.byType['settlements'].misses).toBe(0);
      expect(stats.byType['structures'].hits).toBe(0);
      expect(stats.byType['structures'].misses).toBe(1);
    });

    it('should track stats across delete operations', async () => {
      // Set up cached data
      await cacheService.set('computed-fields:settlement:1:main', { id: 1 });
      await cacheService.set('computed-fields:settlement:2:main', { id: 2 });
      await cacheService.set('settlements:kingdom:1:main', { list: [1, 2] });

      // Delete individual keys
      await cacheService.del('computed-fields:settlement:1:main');
      await cacheService.del('settlements:kingdom:1:main');

      // Verify stats accumulated correctly
      const stats = cacheStatsService.getStats();

      expect(stats.totalInvalidations).toBe(2);

      // Verify per-type breakdown
      expect(stats.byType['computed-fields'].invalidations).toBe(1);
      expect(stats.byType['settlements'].invalidations).toBe(1);
    });

    it('should track cascade invalidations with correct key counts', async () => {
      // Set up multiple keys with same prefix
      await cacheService.set('computed-fields:settlement:1:main', { id: 1 });
      await cacheService.set('computed-fields:settlement:2:main', { id: 2 });
      await cacheService.set('computed-fields:settlement:3:main', { id: 3 });
      await cacheService.set('settlements:kingdom:1:main', { list: [1, 2, 3] });

      // Cascade invalidation (pattern delete)
      const result1 = await cacheService.delPattern('computed-fields:*');
      expect(result1.keysDeleted).toBe(3);

      const result2 = await cacheService.delPattern('settlements:*');
      expect(result2.keysDeleted).toBe(1);

      // Verify stats tracked cascade invalidations
      const stats = cacheStatsService.getStats();

      expect(stats.totalCascadeInvalidations).toBe(4); // 3 + 1

      // Verify per-type breakdown tracks actual keys deleted
      expect(stats.byType['computed-fields'].cascadeInvalidations).toBe(3);
      expect(stats.byType['settlements'].cascadeInvalidations).toBe(1);
    });

    it('should accumulate stats across complete cache workflow', async () => {
      // Complex workflow: sets, gets (hits/misses), deletes, pattern deletes

      // Phase 1: Set up initial cache
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

      // Phase 4: Single-key invalidation
      await cacheService.del('settlements:kingdom:1:main');

      // Phase 5: Re-cache deleted key
      await cacheService.set('settlements:kingdom:1:main', { list: [1, 2] });

      // Phase 6: More hits
      await cacheService.get('computed-fields:settlement:1:main');
      await cacheService.get('settlements:kingdom:1:main');

      // Phase 7: Cascade invalidation
      await cacheService.delPattern('computed-fields:*');

      // Verify all stats accumulated correctly
      const stats = cacheStatsService.getStats();

      // Aggregate stats
      expect(stats.totalSets).toBe(4); // 3 initial + 1 re-cache
      expect(stats.totalHits).toBe(5); // 3 in phase 2 + 2 in phase 6
      expect(stats.totalMisses).toBe(2); // 2 in phase 3
      expect(stats.totalInvalidations).toBe(1); // 1 in phase 4
      expect(stats.totalCascadeInvalidations).toBe(2); // 2 keys in phase 7
      expect(stats.hitRate).toBeCloseTo(0.714, 2); // 5 hits / 7 total (hits + misses)

      // Per-type stats
      expect(stats.byType['computed-fields'].sets).toBe(2);
      expect(stats.byType['computed-fields'].hits).toBe(3);
      expect(stats.byType['computed-fields'].misses).toBe(1);
      expect(stats.byType['computed-fields'].cascadeInvalidations).toBe(2);

      expect(stats.byType['settlements'].sets).toBe(2);
      expect(stats.byType['settlements'].hits).toBe(2);
      expect(stats.byType['settlements'].misses).toBe(0);
      expect(stats.byType['settlements'].invalidations).toBe(1);

      expect(stats.byType['structures'].hits).toBe(0);
      expect(stats.byType['structures'].misses).toBe(1);
    });
  });

  describe('Stats Persistence with Multiple Cache Types', () => {
    it('should track all four cache types independently', async () => {
      // Set up data for all four cache types
      await cacheService.set('computed-fields:settlement:1:main', { cf: true });
      await cacheService.set('settlements:kingdom:1:main', { settlements: true });
      await cacheService.set('structures:settlement:1:main', { structures: true });
      await cacheService.set('spatial:region:1:main', { spatial: true });

      // Mix of hits and misses for each type
      await cacheService.get('computed-fields:settlement:1:main'); // hit
      await cacheService.get('computed-fields:settlement:2:main'); // miss

      await cacheService.get('settlements:kingdom:1:main'); // hit
      await cacheService.get('settlements:kingdom:2:main'); // miss

      await cacheService.get('structures:settlement:1:main'); // hit
      await cacheService.get('structures:settlement:2:main'); // miss

      await cacheService.get('spatial:region:1:main'); // hit
      await cacheService.get('spatial:region:2:main'); // miss

      // Verify stats for all types
      const stats = cacheStatsService.getStats();

      expect(stats.totalSets).toBe(4);
      expect(stats.totalHits).toBe(4);
      expect(stats.totalMisses).toBe(4);
      expect(stats.hitRate).toBe(0.5);

      // Each type should have 1 hit and 1 miss
      ['computed-fields', 'settlements', 'structures', 'spatial'].forEach((type) => {
        expect(stats.byType[type].sets).toBe(1);
        expect(stats.byType[type].hits).toBe(1);
        expect(stats.byType[type].misses).toBe(1);
        expect(stats.byType[type].hitRate).toBe(0.5);
      });
    });

    it('should handle different hit rates per cache type', async () => {
      // computed-fields: 100% hit rate
      await cacheService.set('computed-fields:settlement:1:main', { id: 1 });
      await cacheService.get('computed-fields:settlement:1:main');
      await cacheService.get('computed-fields:settlement:1:main');

      // settlements: 50% hit rate
      await cacheService.set('settlements:kingdom:1:main', { id: 1 });
      await cacheService.get('settlements:kingdom:1:main'); // hit
      await cacheService.get('settlements:kingdom:2:main'); // miss

      // structures: 0% hit rate (all misses)
      await cacheService.get('structures:settlement:1:main'); // miss
      await cacheService.get('structures:settlement:2:main'); // miss

      const stats = cacheStatsService.getStats();

      // Per-type hit rates
      expect(stats.byType['computed-fields'].hitRate).toBe(1.0); // 2/2
      expect(stats.byType['settlements'].hitRate).toBe(0.5); // 1/2
      expect(stats.byType['structures'].hitRate).toBe(0.0); // 0/2

      // Overall hit rate (weighted by operations)
      expect(stats.totalHits).toBe(3); // 2 + 1 + 0
      expect(stats.totalMisses).toBe(3); // 0 + 1 + 2
      expect(stats.hitRate).toBe(0.5); // 3/6
    });
  });

  describe('Stats Persistence After Reset', () => {
    it('should clear stats on reset but continue tracking new operations', async () => {
      // Initial operations
      await cacheService.set('computed-fields:settlement:1:main', { id: 1 });
      await cacheService.get('computed-fields:settlement:1:main');
      await cacheService.del('computed-fields:settlement:1:main');

      let stats = cacheStatsService.getStats();
      expect(stats.totalSets).toBe(1);
      expect(stats.totalHits).toBe(1);
      expect(stats.totalInvalidations).toBe(1);

      // Reset stats
      cacheStatsService.resetStats();

      stats = cacheStatsService.getStats();
      expect(stats.totalSets).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.totalInvalidations).toBe(0);

      // New operations after reset
      await cacheService.set('settlements:kingdom:1:main', { id: 1 });
      await cacheService.get('settlements:kingdom:1:main');

      stats = cacheStatsService.getStats();
      expect(stats.totalSets).toBe(1);
      expect(stats.totalHits).toBe(1);
      expect(stats.byType['settlements'].sets).toBe(1);
      expect(stats.byType['settlements'].hits).toBe(1);

      // Old type should not exist
      expect(stats.byType['computed-fields']).toBeUndefined();
    });
  });

  describe('Stats with Concurrent Operations', () => {
    it('should accurately track stats with concurrent cache operations', async () => {
      // Set up keys concurrently
      const setPromises = [];
      for (let i = 1; i <= 10; i++) {
        setPromises.push(cacheService.set(`computed-fields:settlement:${i}:main`, { id: i }));
      }
      await Promise.all(setPromises);

      // Get keys concurrently (all hits)
      const getPromises = [];
      for (let i = 1; i <= 10; i++) {
        getPromises.push(cacheService.get(`computed-fields:settlement:${i}:main`));
      }
      await Promise.all(getPromises);

      // Verify stats
      const stats = cacheStatsService.getStats();
      expect(stats.totalSets).toBe(10);
      expect(stats.totalHits).toBe(10);
      expect(stats.totalMisses).toBe(0);
      expect(stats.hitRate).toBe(1.0);
    });
  });

  describe('Real-World Scenario: Cache Warming and Usage', () => {
    it('should track stats through complete cache lifecycle', async () => {
      // Scenario: Application starts, cache is cold

      // Initial request - cache miss
      let result = await cacheService.get('computed-fields:settlement:1:main');
      expect(result).toBeNull();

      let stats = cacheStatsService.getStats();
      expect(stats.totalMisses).toBe(1);
      expect(stats.totalHits).toBe(0);

      // Fetch from DB and cache (cache warming)
      await cacheService.set('computed-fields:settlement:1:main', {
        id: 1,
        name: 'Test Settlement',
      });

      stats = cacheStatsService.getStats();
      expect(stats.totalSets).toBe(1);

      // Subsequent requests - cache hits
      for (let i = 0; i < 5; i++) {
        result = await cacheService.get('computed-fields:settlement:1:main');
        expect(result).toEqual({ id: 1, name: 'Test Settlement' });
      }

      stats = cacheStatsService.getStats();
      expect(stats.totalHits).toBe(5);
      expect(stats.totalMisses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.833, 2); // 5/6

      // Entity update - invalidate cache
      await cacheService.del('computed-fields:settlement:1:main');

      stats = cacheStatsService.getStats();
      expect(stats.totalInvalidations).toBe(1);

      // Next request - cache miss again
      result = await cacheService.get('computed-fields:settlement:1:main');
      expect(result).toBeNull();

      stats = cacheStatsService.getStats();
      expect(stats.totalMisses).toBe(2);
      expect(stats.totalHits).toBe(5);
      expect(stats.hitRate).toBeCloseTo(0.714, 2); // 5/7

      // Re-cache updated data
      await cacheService.set('computed-fields:settlement:1:main', {
        id: 1,
        name: 'Updated Settlement',
      });

      stats = cacheStatsService.getStats();
      expect(stats.totalSets).toBe(2);

      // More hits with updated data
      for (let i = 0; i < 3; i++) {
        result = await cacheService.get('computed-fields:settlement:1:main');
        expect(result).toEqual({ id: 1, name: 'Updated Settlement' });
      }

      // Final stats verification
      stats = cacheStatsService.getStats();
      expect(stats.totalSets).toBe(2); // Initial + re-cache
      expect(stats.totalHits).toBe(8); // 5 + 3
      expect(stats.totalMisses).toBe(2); // Initial + post-invalidation
      expect(stats.totalInvalidations).toBe(1);
      expect(stats.hitRate).toBe(0.8); // 8/10
    });
  });
});
