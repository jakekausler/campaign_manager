import { Test, TestingModule } from '@nestjs/testing';
import { Redis } from 'ioredis';

import { CacheStatsService } from './cache-stats.service';
import { CacheModule } from './cache.module';
import { CacheService } from './cache.service';

describe('CacheStatsService E2E - Stats Accuracy Over Multiple Operations', () => {
  let cacheService: CacheService;
  let cacheStatsService: CacheStatsService;
  let redisClient: Redis;

  beforeAll(async () => {
    // Set environment variables for services
    process.env.CACHE_METRICS_ENABLED = 'true';
    process.env.CACHE_LOGGING_ENABLED = 'false';
    process.env.CACHE_STATS_TRACKING_ENABLED = 'true';
    process.env.CACHE_STATS_RESET_PERIOD_MS = '0'; // Disable auto-reset for tests

    // Create Redis client for testing
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

    redisClient = new Redis({
      host: redisHost,
      port: redisPort,
      db: 1, // Use DB 1 for cache (DB 0 is for pub/sub)
      retryStrategy: (times) => {
        if (times > 3) {
          return null; // Stop retrying after 3 attempts
        }
        return Math.min(times * 100, 2000);
      },
    });

    // Create test module
    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule],
    }).compile();

    cacheService = module.get<CacheService>(CacheService);
    cacheStatsService = module.get<CacheStatsService>(CacheStatsService);
  });

  beforeEach(async () => {
    // Clear Redis database before each test
    await redisClient.flushdb();
    // Reset statistics for clean state
    cacheStatsService.resetStats();
  });

  afterAll(async () => {
    // Clean up Redis connection
    await redisClient.quit();
  });

  describe('Complete Application Lifecycle E2E', () => {
    it('should accurately track stats through complete application lifecycle', async () => {
      // PHASE 1: Cold Start - Initial Cache Misses
      // ==========================================
      const miss1 = await cacheService.get('computed-fields:settlement:1:main');
      const miss2 = await cacheService.get('computed-fields:settlement:2:main');
      const miss3 = await cacheService.get('settlements:kingdom:1:main');

      expect(miss1).toBeNull();
      expect(miss2).toBeNull();
      expect(miss3).toBeNull();

      let stats = cacheStatsService.getStats();
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(3);
      expect(stats.totalSets).toBe(0);
      expect(stats.hitRate).toBe(0);

      // PHASE 2: Cache Warming - Populate Cache
      // ========================================
      await cacheService.set(
        'computed-fields:settlement:1:main',
        { level: 5, population: 1000 },
        { ttl: 300 }
      );
      await cacheService.set(
        'computed-fields:settlement:2:main',
        { level: 3, population: 500 },
        { ttl: 300 }
      );
      await cacheService.set('computed-fields:structure:1:main', { power: 100 }, { ttl: 300 });
      await cacheService.set('settlements:kingdom:1:main', ['s1', 's2', 's3'], { ttl: 600 });
      await cacheService.set('structures:settlement:1:main', ['st1', 'st2'], { ttl: 600 });
      await cacheService.set('spatial:nearby:coords:main', [{ id: 1 }, { id: 2 }], { ttl: 300 });

      stats = cacheStatsService.getStats();
      expect(stats.totalSets).toBe(6);
      expect(stats.totalMisses).toBe(3);
      expect(stats.totalHits).toBe(0);

      // PHASE 3: High-Traffic Period - Mostly Cache Hits
      // =================================================
      // Simulate 100 requests with 85% hit rate (realistic production scenario)

      // 85 cache hits
      for (let i = 0; i < 30; i++) {
        await cacheService.get('computed-fields:settlement:1:main');
      }
      for (let i = 0; i < 25; i++) {
        await cacheService.get('computed-fields:settlement:2:main');
      }
      for (let i = 0; i < 15; i++) {
        await cacheService.get('settlements:kingdom:1:main');
      }
      for (let i = 0; i < 10; i++) {
        await cacheService.get('spatial:nearby:coords:main');
      }
      for (let i = 0; i < 5; i++) {
        await cacheService.get('structures:settlement:1:main');
      }

      // 15 cache misses
      for (let i = 3; i <= 17; i++) {
        await cacheService.get(`computed-fields:settlement:${i}:main`);
      }

      stats = cacheStatsService.getStats();
      expect(stats.totalHits).toBe(85);
      expect(stats.totalMisses).toBe(3 + 15); // 3 from phase 1 + 15 new misses
      expect(stats.totalSets).toBe(6);
      expect(stats.hitRate).toBeCloseTo(0.825, 2); // 85 / (85 + 18) = 0.8252...

      // Verify per-type breakdown
      expect(stats.byType['computed-fields'].hits).toBe(55); // 30 + 25
      expect(stats.byType['computed-fields'].misses).toBe(17); // 2 + 15 (initial misses for settlements 1,2 + new misses 3-17)
      expect(stats.byType['settlements'].hits).toBe(15);
      expect(stats.byType['settlements'].misses).toBe(1); // Initial miss
      expect(stats.byType['spatial'].hits).toBe(10);
      expect(stats.byType['structures'].hits).toBe(5);

      // PHASE 4: Data Invalidation - Entity Updates
      // ============================================
      await cacheService.del('computed-fields:settlement:1:main');
      await cacheService.del('computed-fields:settlement:2:main');

      stats = cacheStatsService.getStats();
      expect(stats.totalInvalidations).toBe(2);
      expect(stats.byType['computed-fields'].invalidations).toBe(2);

      // Verify keys actually deleted
      const deleted1 = await cacheService.get('computed-fields:settlement:1:main');
      const deleted2 = await cacheService.get('computed-fields:settlement:2:main');
      expect(deleted1).toBeNull();
      expect(deleted2).toBeNull();

      stats = cacheStatsService.getStats();
      expect(stats.totalMisses).toBe(20); // 18 + 2 new misses from deleted keys

      // PHASE 5: Cascade Invalidation - Bulk Clearing
      // ==============================================
      // Simulate a kingdom-level change that invalidates all related caches
      await cacheService.delPattern('settlements:*');

      stats = cacheStatsService.getStats();
      expect(stats.totalCascadeInvalidations).toBeGreaterThanOrEqual(1); // At least 1 key deleted
      expect(stats.byType['settlements'].cascadeInvalidations).toBeGreaterThanOrEqual(1);

      // PHASE 6: Re-cache After Invalidation
      // =====================================
      await cacheService.set(
        'computed-fields:settlement:1:main',
        { level: 6, population: 1200 },
        { ttl: 300 }
      );
      await cacheService.set(
        'computed-fields:settlement:2:main',
        { level: 4, population: 600 },
        { ttl: 300 }
      );
      await cacheService.set('settlements:kingdom:1:main', ['s1', 's2', 's3', 's4'], { ttl: 600 });

      stats = cacheStatsService.getStats();
      expect(stats.totalSets).toBe(9); // 6 initial + 3 new

      // PHASE 7: Continued Traffic - Verify Stats Still Accurate
      // =========================================================
      for (let i = 0; i < 20; i++) {
        await cacheService.get('computed-fields:settlement:1:main');
      }
      for (let i = 0; i < 10; i++) {
        await cacheService.get('settlements:kingdom:1:main');
      }

      stats = cacheStatsService.getStats();
      expect(stats.totalHits).toBe(115); // 85 + 20 + 10
      expect(stats.totalMisses).toBe(20); // No new misses
      expect(stats.totalSets).toBe(9);
      expect(stats.totalInvalidations).toBe(2);
      expect(stats.totalCascadeInvalidations).toBeGreaterThanOrEqual(1);
      expect(stats.hitRate).toBeCloseTo(0.852, 2); // 115 / (115 + 20)

      // PHASE 8: Final Verification - Complete Stats Accuracy
      // ======================================================
      const finalStats = cacheStatsService.getStats();

      // Verify all counters are non-negative
      expect(finalStats.totalHits).toBeGreaterThanOrEqual(0);
      expect(finalStats.totalMisses).toBeGreaterThanOrEqual(0);
      expect(finalStats.totalSets).toBeGreaterThanOrEqual(0);
      expect(finalStats.totalInvalidations).toBeGreaterThanOrEqual(0);
      expect(finalStats.totalCascadeInvalidations).toBeGreaterThanOrEqual(0);

      // Verify hit rate is in valid range
      expect(finalStats.hitRate).toBeGreaterThanOrEqual(0);
      expect(finalStats.hitRate).toBeLessThanOrEqual(1);

      // Verify per-type stats aggregate correctly
      let totalHitsFromTypes = 0;
      let totalMissesFromTypes = 0;
      let totalSetsFromTypes = 0;
      let totalInvalidationsFromTypes = 0;
      let totalCascadeInvalidationsFromTypes = 0;

      Object.values(finalStats.byType).forEach((typeStats) => {
        totalHitsFromTypes += typeStats.hits;
        totalMissesFromTypes += typeStats.misses;
        totalSetsFromTypes += typeStats.sets;
        totalInvalidationsFromTypes += typeStats.invalidations;
        totalCascadeInvalidationsFromTypes += typeStats.cascadeInvalidations;
      });

      expect(totalHitsFromTypes).toBe(finalStats.totalHits);
      expect(totalMissesFromTypes).toBe(finalStats.totalMisses);
      expect(totalSetsFromTypes).toBe(finalStats.totalSets);
      expect(totalInvalidationsFromTypes).toBe(finalStats.totalInvalidations);
      expect(totalCascadeInvalidationsFromTypes).toBe(finalStats.totalCascadeInvalidations);

      // Verify time saved estimation
      const timeSaved = cacheStatsService.estimateTimeSaved();
      expect(timeSaved).toBeGreaterThan(0);

      // Verify computed-fields time saved (should be highest due to 300ms per hit)
      const computedFieldsTimeSaved = cacheStatsService.estimateTimeSaved('computed-fields');
      expect(computedFieldsTimeSaved).toBeGreaterThan(0);
      expect(computedFieldsTimeSaved).toBe(finalStats.byType['computed-fields'].hits * 300);
    });
  });

  describe('Multi-Phase Cache Operations with Stats Reset', () => {
    it('should maintain accuracy across stats reset', async () => {
      // PHASE 1: Pre-reset operations
      await cacheService.set('test:key1', { data: 'value1' }, { ttl: 300 });
      await cacheService.set('test:key2', { data: 'value2' }, { ttl: 300 });
      await cacheService.get('test:key1'); // Hit
      await cacheService.get('test:key1'); // Hit
      await cacheService.get('test:missing'); // Miss

      let stats = cacheStatsService.getStats();
      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(1);
      expect(stats.totalSets).toBe(2);

      // Record start time before reset
      const startTimeBefore = stats.startTime;

      // PHASE 2: Reset stats
      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
      cacheStatsService.resetStats();

      // PHASE 3: Post-reset operations
      await cacheService.get('test:key1'); // Hit (key still in Redis)
      await cacheService.set('test:key3', { data: 'value3' }, { ttl: 300 });
      await cacheService.get('test:key3'); // Hit
      await cacheService.get('test:missing2'); // Miss

      stats = cacheStatsService.getStats();
      expect(stats.totalHits).toBe(2); // Only post-reset hits
      expect(stats.totalMisses).toBe(1); // Only post-reset misses
      expect(stats.totalSets).toBe(1); // Only post-reset sets
      expect(stats.totalInvalidations).toBe(0); // No invalidations post-reset
      expect(stats.hitRate).toBeCloseTo(0.667, 2); // 2 / (2 + 1)
      expect(stats.startTime).toBeGreaterThan(startTimeBefore);
    });
  });

  describe('Concurrent Operations Accuracy', () => {
    it('should accurately track stats under concurrent load', async () => {
      // PHASE 1: Concurrent cache warming
      const setPromises = [];
      for (let i = 0; i < 50; i++) {
        setPromises.push(
          cacheService.set(
            `computed-fields:entity:${i}:main`,
            { id: i, data: `value${i}` },
            { ttl: 300 }
          )
        );
      }
      await Promise.all(setPromises);

      let stats = cacheStatsService.getStats();
      expect(stats.totalSets).toBe(50);

      // PHASE 2: Concurrent cache hits
      const getPromises = [];
      for (let i = 0; i < 50; i++) {
        getPromises.push(cacheService.get(`computed-fields:entity:${i}:main`));
      }
      const results = await Promise.all(getPromises);

      // Verify all results returned (all hits)
      expect(results.every((r) => r !== null)).toBe(true);

      stats = cacheStatsService.getStats();
      expect(stats.totalHits).toBe(50);
      expect(stats.totalMisses).toBe(0);
      expect(stats.hitRate).toBe(1.0); // Perfect hit rate

      // PHASE 3: Concurrent mixed operations (hits and misses)
      const mixedPromises = [];
      for (let i = 0; i < 25; i++) {
        mixedPromises.push(cacheService.get(`computed-fields:entity:${i}:main`)); // Hits
        mixedPromises.push(cacheService.get(`computed-fields:missing:${i}:main`)); // Misses
      }
      await Promise.all(mixedPromises);

      stats = cacheStatsService.getStats();
      expect(stats.totalHits).toBe(75); // 50 + 25
      expect(stats.totalMisses).toBe(25);
      expect(stats.hitRate).toBe(0.75); // 75 / (75 + 25)

      // PHASE 4: Concurrent invalidations
      const delPromises = [];
      for (let i = 0; i < 10; i++) {
        delPromises.push(cacheService.del(`computed-fields:entity:${i}:main`));
      }
      await Promise.all(delPromises);

      stats = cacheStatsService.getStats();
      expect(stats.totalInvalidations).toBe(10);

      // Verify counters remain consistent
      expect(stats.totalHits + stats.totalMisses).toBe(100);
    });
  });

  describe('All Cache Types E2E', () => {
    it('should accurately track stats across all four cache types', async () => {
      // Test each cache type independently with multiple operations

      // COMPUTED-FIELDS (expensive operations, 300ms saved per hit)
      await cacheService.set('computed-fields:settlement:1:main', { level: 5 }, { ttl: 300 });
      await cacheService.set('computed-fields:structure:1:main', { power: 100 }, { ttl: 300 });
      for (let i = 0; i < 10; i++) {
        await cacheService.get('computed-fields:settlement:1:main');
      }
      await cacheService.get('computed-fields:settlement:2:main'); // Miss
      await cacheService.del('computed-fields:structure:1:main');

      // SETTLEMENTS (list queries, 25ms saved per hit)
      await cacheService.set('settlements:kingdom:1:main', ['s1', 's2'], { ttl: 600 });
      for (let i = 0; i < 5; i++) {
        await cacheService.get('settlements:kingdom:1:main');
      }
      await cacheService.get('settlements:kingdom:2:main'); // Miss

      // STRUCTURES (list queries, 25ms saved per hit)
      await cacheService.set('structures:settlement:1:main', ['st1', 'st2'], { ttl: 600 });
      for (let i = 0; i < 3; i++) {
        await cacheService.get('structures:settlement:1:main');
      }
      await cacheService.get('structures:settlement:2:main'); // Miss

      // SPATIAL (PostGIS queries, 100ms saved per hit)
      await cacheService.set('spatial:nearby:coords:main', [{ id: 1 }], { ttl: 300 });
      await cacheService.set('spatial:region:bounds:main', [{ id: 2 }], { ttl: 300 });
      for (let i = 0; i < 7; i++) {
        await cacheService.get('spatial:nearby:coords:main');
      }
      await cacheService.get('spatial:missing:coords:main'); // Miss

      // Verify per-type stats
      const stats = cacheStatsService.getStats();

      expect(stats.byType['computed-fields'].hits).toBe(10);
      expect(stats.byType['computed-fields'].misses).toBe(1);
      expect(stats.byType['computed-fields'].sets).toBe(2);
      expect(stats.byType['computed-fields'].invalidations).toBe(1);

      expect(stats.byType['settlements'].hits).toBe(5);
      expect(stats.byType['settlements'].misses).toBe(1);
      expect(stats.byType['settlements'].sets).toBe(1);

      expect(stats.byType['structures'].hits).toBe(3);
      expect(stats.byType['structures'].misses).toBe(1);
      expect(stats.byType['structures'].sets).toBe(1);

      expect(stats.byType['spatial'].hits).toBe(7);
      expect(stats.byType['spatial'].misses).toBe(1);
      expect(stats.byType['spatial'].sets).toBe(2);

      // Verify aggregates
      expect(stats.totalHits).toBe(25); // 10 + 5 + 3 + 7
      expect(stats.totalMisses).toBe(4); // 1 + 1 + 1 + 1
      expect(stats.totalSets).toBe(6); // 2 + 1 + 1 + 2
      expect(stats.totalInvalidations).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.862, 2); // 25 / 29

      // Verify time saved calculations
      const computedFieldsTime = cacheStatsService.estimateTimeSaved('computed-fields');
      const settlementsTime = cacheStatsService.estimateTimeSaved('settlements');
      const structuresTime = cacheStatsService.estimateTimeSaved('structures');
      const spatialTime = cacheStatsService.estimateTimeSaved('spatial');

      expect(computedFieldsTime).toBe(10 * 300); // 3000ms
      expect(settlementsTime).toBe(5 * 25); // 125ms
      expect(structuresTime).toBe(3 * 25); // 75ms
      expect(spatialTime).toBe(7 * 100); // 700ms

      const totalTimeSaved = cacheStatsService.estimateTimeSaved();
      expect(totalTimeSaved).toBe(
        computedFieldsTime + settlementsTime + structuresTime + spatialTime
      );
      expect(totalTimeSaved).toBe(3900); // 3000 + 125 + 75 + 700
    });
  });

  describe('Pattern-Based Invalidation Accuracy', () => {
    it('should accurately track cascade invalidations with pattern matching', async () => {
      // Set up multiple keys with different patterns
      await cacheService.set('computed-fields:settlement:1:main', { data: 'v1' }, { ttl: 300 });
      await cacheService.set('computed-fields:settlement:2:main', { data: 'v2' }, { ttl: 300 });
      await cacheService.set('computed-fields:settlement:3:main', { data: 'v3' }, { ttl: 300 });
      await cacheService.set('computed-fields:structure:1:main', { data: 'v4' }, { ttl: 300 });
      await cacheService.set('settlements:kingdom:1:main', { data: 'v5' }, { ttl: 600 });
      await cacheService.set('spatial:nearby:coords:main', { data: 'v6' }, { ttl: 300 });

      let stats = cacheStatsService.getStats();
      expect(stats.totalSets).toBe(6);

      // Pattern delete all settlement computed fields
      const result1 = await cacheService.delPattern('computed-fields:settlement:*');
      expect(result1.keysDeleted).toBe(3);

      stats = cacheStatsService.getStats();
      expect(stats.totalCascadeInvalidations).toBe(3);
      expect(stats.byType['computed-fields'].cascadeInvalidations).toBe(3);

      // Pattern delete all spatial queries
      const result2 = await cacheService.delPattern('spatial:*');
      expect(result2.keysDeleted).toBe(1);

      stats = cacheStatsService.getStats();
      expect(stats.totalCascadeInvalidations).toBe(4); // 3 + 1
      expect(stats.byType['spatial'].cascadeInvalidations).toBe(1);

      // Pattern delete non-existent keys
      const result3 = await cacheService.delPattern('nonexistent:*');
      expect(result3.keysDeleted).toBe(0);

      stats = cacheStatsService.getStats();
      expect(stats.totalCascadeInvalidations).toBe(4); // No change

      // Verify remaining keys
      const remaining1 = await cacheService.get('computed-fields:structure:1:main');
      const remaining2 = await cacheService.get('settlements:kingdom:1:main');
      expect(remaining1).not.toBeNull();
      expect(remaining2).not.toBeNull();

      stats = cacheStatsService.getStats();
      expect(stats.totalHits).toBe(2);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle zero operations gracefully', async () => {
      const stats = cacheStatsService.getStats();

      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
      expect(stats.totalSets).toBe(0);
      expect(stats.totalInvalidations).toBe(0);
      expect(stats.totalCascadeInvalidations).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(Object.keys(stats.byType)).toHaveLength(0);
    });

    it('should handle extremely high operation counts', async () => {
      // Simulate 1000 operations
      await cacheService.set('test:key', { data: 'value' }, { ttl: 300 });

      for (let i = 0; i < 500; i++) {
        await cacheService.get('test:key'); // Hit
      }
      for (let i = 0; i < 499; i++) {
        await cacheService.get(`test:missing${i}`); // Miss
      }

      const stats = cacheStatsService.getStats();
      expect(stats.totalHits).toBe(500);
      expect(stats.totalMisses).toBe(499);
      expect(stats.totalSets).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.5005, 4); // 500 / 999
    });

    it('should handle rapid sequential operations on same key', async () => {
      await cacheService.set('test:rapid', { data: 'value' }, { ttl: 300 });

      // 100 rapid gets on same key
      for (let i = 0; i < 100; i++) {
        const result = await cacheService.get('test:rapid');
        expect(result).not.toBeNull();
      }

      const stats = cacheStatsService.getStats();
      expect(stats.totalHits).toBe(100);
      expect(stats.totalMisses).toBe(0);
      expect(stats.hitRate).toBe(1.0);
    });

    it('should handle alternating hit/miss pattern', async () => {
      await cacheService.set('test:exists', { data: 'value' }, { ttl: 300 });

      for (let i = 0; i < 50; i++) {
        await cacheService.get('test:exists'); // Hit
        await cacheService.get(`test:missing${i}`); // Miss
      }

      const stats = cacheStatsService.getStats();
      expect(stats.totalHits).toBe(50);
      expect(stats.totalMisses).toBe(50);
      expect(stats.hitRate).toBe(0.5);
    });
  });
});
