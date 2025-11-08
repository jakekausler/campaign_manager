import { Test, TestingModule } from '@nestjs/testing';

import { REDIS_CACHE } from '../../graphql/cache/redis-cache.provider';

import { CacheStatsService } from './cache-stats.service';

describe('CacheStatsService', () => {
  let service: CacheStatsService;

  beforeEach(async () => {
    // Set environment variables for testing
    process.env.CACHE_STATS_TRACKING_ENABLED = 'true';
    process.env.CACHE_STATS_RESET_PERIOD_MS = '0'; // Disable auto-reset for tests

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheStatsService,
        {
          provide: REDIS_CACHE,
          useValue: {
            info: jest.fn(),
            scan: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CacheStatsService>(CacheStatsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recordHit', () => {
    it('should increment hit counter for specific cache type', () => {
      // Record hits for computed-fields cache type
      service.recordHit('computed-fields');
      service.recordHit('computed-fields');

      const stats = service.getStats();

      expect(stats.totalHits).toBe(2);
      expect(stats.byType['computed-fields'].hits).toBe(2);
      expect(stats.byType['computed-fields'].misses).toBe(0);
    });

    it('should track hits separately for different cache types', () => {
      service.recordHit('computed-fields');
      service.recordHit('computed-fields');
      service.recordHit('settlements');
      service.recordHit('structures');

      const stats = service.getStats();

      expect(stats.totalHits).toBe(4);
      expect(stats.byType['computed-fields'].hits).toBe(2);
      expect(stats.byType['settlements'].hits).toBe(1);
      expect(stats.byType['structures'].hits).toBe(1);
    });

    it('should not track hits when tracking is disabled', async () => {
      // Create a new service instance with tracking disabled
      process.env.CACHE_STATS_TRACKING_ENABLED = 'false';

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CacheStatsService,
          {
            provide: REDIS_CACHE,
            useValue: {
              info: jest.fn(),
              scan: jest.fn(),
            },
          },
        ],
      }).compile();

      const disabledService = module.get<CacheStatsService>(CacheStatsService);

      disabledService.recordHit('computed-fields');

      const stats = disabledService.getStats();

      expect(stats.totalHits).toBe(0);
      expect(stats.enabled).toBe(false);
    });

    it('should handle multiple hit recordings in succession', () => {
      for (let i = 0; i < 100; i++) {
        service.recordHit('spatial');
      }

      const stats = service.getStats();

      expect(stats.totalHits).toBe(100);
      expect(stats.byType['spatial'].hits).toBe(100);
    });
  });

  describe('recordMiss', () => {
    it('should increment miss counter for specific cache type', () => {
      // Record misses for computed-fields cache type
      service.recordMiss('computed-fields');
      service.recordMiss('computed-fields');

      const stats = service.getStats();

      expect(stats.totalMisses).toBe(2);
      expect(stats.byType['computed-fields'].misses).toBe(2);
      expect(stats.byType['computed-fields'].hits).toBe(0);
    });

    it('should track misses separately for different cache types', () => {
      service.recordMiss('computed-fields');
      service.recordMiss('computed-fields');
      service.recordMiss('settlements');
      service.recordMiss('spatial');

      const stats = service.getStats();

      expect(stats.totalMisses).toBe(4);
      expect(stats.byType['computed-fields'].misses).toBe(2);
      expect(stats.byType['settlements'].misses).toBe(1);
      expect(stats.byType['spatial'].misses).toBe(1);
    });

    it('should not track misses when tracking is disabled', async () => {
      // Create a new service instance with tracking disabled
      process.env.CACHE_STATS_TRACKING_ENABLED = 'false';

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CacheStatsService,
          {
            provide: REDIS_CACHE,
            useValue: {
              info: jest.fn(),
              scan: jest.fn(),
            },
          },
        ],
      }).compile();

      const disabledService = module.get<CacheStatsService>(CacheStatsService);

      disabledService.recordMiss('computed-fields');

      const stats = disabledService.getStats();

      expect(stats.totalMisses).toBe(0);
      expect(stats.enabled).toBe(false);
    });

    it('should handle multiple miss recordings in succession', () => {
      for (let i = 0; i < 100; i++) {
        service.recordMiss('structures');
      }

      const stats = service.getStats();

      expect(stats.totalMisses).toBe(100);
      expect(stats.byType['structures'].misses).toBe(100);
    });

    it('should track hits and misses independently', () => {
      service.recordHit('computed-fields');
      service.recordMiss('computed-fields');
      service.recordHit('computed-fields');
      service.recordMiss('computed-fields');
      service.recordMiss('computed-fields');

      const stats = service.getStats();

      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(3);
      expect(stats.byType['computed-fields'].hits).toBe(2);
      expect(stats.byType['computed-fields'].misses).toBe(3);
    });
  });

  describe('recordInvalidation', () => {
    it('should increment invalidation counter for specific cache type', () => {
      // Record invalidations for computed-fields cache type
      service.recordInvalidation('computed-fields');
      service.recordInvalidation('computed-fields');

      const stats = service.getStats();

      expect(stats.totalInvalidations).toBe(2);
      expect(stats.byType['computed-fields'].invalidations).toBe(2);
    });

    it('should track invalidations separately for different cache types', () => {
      service.recordInvalidation('computed-fields');
      service.recordInvalidation('settlements');
      service.recordInvalidation('structures');
      service.recordInvalidation('spatial');

      const stats = service.getStats();

      expect(stats.totalInvalidations).toBe(4);
      expect(stats.byType['computed-fields'].invalidations).toBe(1);
      expect(stats.byType['settlements'].invalidations).toBe(1);
      expect(stats.byType['structures'].invalidations).toBe(1);
      expect(stats.byType['spatial'].invalidations).toBe(1);
    });

    it('should not track invalidations when tracking is disabled', async () => {
      // Create a new service instance with tracking disabled
      process.env.CACHE_STATS_TRACKING_ENABLED = 'false';

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CacheStatsService,
          {
            provide: REDIS_CACHE,
            useValue: {
              info: jest.fn(),
              scan: jest.fn(),
            },
          },
        ],
      }).compile();

      const disabledService = module.get<CacheStatsService>(CacheStatsService);

      disabledService.recordInvalidation('computed-fields');

      const stats = disabledService.getStats();

      expect(stats.totalInvalidations).toBe(0);
      expect(stats.enabled).toBe(false);
    });
  });

  describe('recordCascadeInvalidation', () => {
    it('should increment cascade invalidation counter with key count', () => {
      // Record cascade invalidation that deleted 5 keys
      service.recordCascadeInvalidation('computed-fields', 5);

      const stats = service.getStats();

      expect(stats.totalCascadeInvalidations).toBe(5);
      expect(stats.byType['computed-fields'].cascadeInvalidations).toBe(5);
    });

    it('should accumulate multiple cascade invalidations', () => {
      service.recordCascadeInvalidation('computed-fields', 3);
      service.recordCascadeInvalidation('computed-fields', 7);
      service.recordCascadeInvalidation('settlements', 2);

      const stats = service.getStats();

      expect(stats.totalCascadeInvalidations).toBe(12);
      expect(stats.byType['computed-fields'].cascadeInvalidations).toBe(10);
      expect(stats.byType['settlements'].cascadeInvalidations).toBe(2);
    });

    it('should handle zero-key cascade invalidations', () => {
      // Pattern matched no keys to delete
      service.recordCascadeInvalidation('spatial', 0);

      const stats = service.getStats();

      expect(stats.totalCascadeInvalidations).toBe(0);
      expect(stats.byType['spatial'].cascadeInvalidations).toBe(0);
    });

    it('should not track cascade invalidations when tracking is disabled', async () => {
      // Create a new service instance with tracking disabled
      process.env.CACHE_STATS_TRACKING_ENABLED = 'false';

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CacheStatsService,
          {
            provide: REDIS_CACHE,
            useValue: {
              info: jest.fn(),
              scan: jest.fn(),
            },
          },
        ],
      }).compile();

      const disabledService = module.get<CacheStatsService>(CacheStatsService);

      disabledService.recordCascadeInvalidation('computed-fields', 10);

      const stats = disabledService.getStats();

      expect(stats.totalCascadeInvalidations).toBe(0);
      expect(stats.enabled).toBe(false);
    });

    it('should track regular and cascade invalidations independently', () => {
      service.recordInvalidation('computed-fields');
      service.recordInvalidation('computed-fields');
      service.recordCascadeInvalidation('computed-fields', 5);
      service.recordInvalidation('settlements');
      service.recordCascadeInvalidation('settlements', 3);

      const stats = service.getStats();

      expect(stats.totalInvalidations).toBe(3);
      expect(stats.totalCascadeInvalidations).toBe(8);
      expect(stats.byType['computed-fields'].invalidations).toBe(2);
      expect(stats.byType['computed-fields'].cascadeInvalidations).toBe(5);
      expect(stats.byType['settlements'].invalidations).toBe(1);
      expect(stats.byType['settlements'].cascadeInvalidations).toBe(3);
    });
  });

  describe('resetStats', () => {
    it('should reset all counters to zero', () => {
      // Record various operations
      service.recordHit('computed-fields');
      service.recordHit('settlements');
      service.recordMiss('structures');
      service.recordSet('spatial');
      service.recordInvalidation('computed-fields');
      service.recordCascadeInvalidation('settlements', 5);

      // Verify stats were recorded
      let stats = service.getStats();
      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(1);
      expect(stats.totalSets).toBe(1);
      expect(stats.totalInvalidations).toBe(1);
      expect(stats.totalCascadeInvalidations).toBe(5);

      // Reset stats
      service.resetStats();

      // Verify all counters are zero
      stats = service.getStats();
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
      expect(stats.totalSets).toBe(0);
      expect(stats.totalInvalidations).toBe(0);
      expect(stats.totalCascadeInvalidations).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should reset per-type stats', () => {
      // Record operations for multiple cache types
      service.recordHit('computed-fields');
      service.recordMiss('settlements');
      service.recordSet('structures');
      service.recordInvalidation('spatial');

      // Verify per-type stats exist
      let stats = service.getStats();
      expect(stats.byType['computed-fields']).toBeDefined();
      expect(stats.byType['settlements']).toBeDefined();
      expect(stats.byType['structures']).toBeDefined();
      expect(stats.byType['spatial']).toBeDefined();

      // Reset stats
      service.resetStats();

      // Verify per-type stats are cleared
      stats = service.getStats();
      expect(Object.keys(stats.byType).length).toBe(0);
    });

    it('should update startTime on reset', () => {
      const originalStats = service.getStats();
      const originalStartTime = originalStats.startTime;

      // Wait a bit to ensure time difference
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      return delay(10).then(() => {
        // Reset stats
        service.resetStats();

        const newStats = service.getStats();
        const newStartTime = newStats.startTime;

        // New start time should be greater than original
        expect(newStartTime).toBeGreaterThan(originalStartTime);
      });
    });

    it('should allow stats to be recorded after reset', () => {
      // Record initial operations
      service.recordHit('computed-fields');
      service.recordMiss('computed-fields');

      // Reset stats
      service.resetStats();

      // Verify stats are zero
      let stats = service.getStats();
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);

      // Record new operations after reset
      service.recordHit('settlements');
      service.recordHit('settlements');
      service.recordMiss('settlements');

      // Verify new operations are tracked correctly
      stats = service.getStats();
      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(1);
      expect(stats.byType['settlements'].hits).toBe(2);
      expect(stats.byType['settlements'].misses).toBe(1);
      expect(stats.byType['computed-fields']).toBeUndefined(); // Old type stats should be gone
    });

    it('should reset hit rate calculation to zero', () => {
      // Record operations to get a non-zero hit rate
      service.recordHit('computed-fields');
      service.recordHit('computed-fields');
      service.recordHit('computed-fields');
      service.recordMiss('computed-fields');

      let stats = service.getStats();
      expect(stats.hitRate).toBe(0.75); // 3 hits / 4 total

      // Reset stats
      service.resetStats();

      // Verify hit rate is now zero
      stats = service.getStats();
      expect(stats.hitRate).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
    });

    it('should be idempotent when called multiple times', () => {
      // Record some operations
      service.recordHit('computed-fields');
      service.recordMiss('settlements');

      // Reset multiple times
      service.resetStats();
      service.resetStats();
      service.resetStats();

      // Stats should still be zero
      const stats = service.getStats();
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
      expect(Object.keys(stats.byType).length).toBe(0);
    });
  });

  describe('hit rate calculation', () => {
    it('should calculate hit rate of 0 when no operations', () => {
      const stats = service.getStats();

      expect(stats.hitRate).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
    });

    it('should calculate hit rate of 1.0 for all hits', () => {
      service.recordHit('computed-fields');
      service.recordHit('computed-fields');
      service.recordHit('settlements');

      const stats = service.getStats();

      expect(stats.hitRate).toBe(1.0);
      expect(stats.totalHits).toBe(3);
      expect(stats.totalMisses).toBe(0);
    });

    it('should calculate hit rate of 0.0 for all misses', () => {
      service.recordMiss('computed-fields');
      service.recordMiss('settlements');
      service.recordMiss('spatial');

      const stats = service.getStats();

      expect(stats.hitRate).toBe(0.0);
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(3);
    });

    it('should calculate hit rate of 0.5 for equal hits and misses', () => {
      service.recordHit('computed-fields');
      service.recordHit('settlements');
      service.recordMiss('structures');
      service.recordMiss('spatial');

      const stats = service.getStats();

      expect(stats.hitRate).toBe(0.5);
      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(2);
    });

    it('should calculate hit rate of 0.75 for 3 hits and 1 miss', () => {
      service.recordHit('computed-fields');
      service.recordHit('settlements');
      service.recordHit('structures');
      service.recordMiss('spatial');

      const stats = service.getStats();

      expect(stats.hitRate).toBe(0.75);
      expect(stats.totalHits).toBe(3);
      expect(stats.totalMisses).toBe(1);
    });

    it('should calculate hit rate of 0.25 for 1 hit and 3 misses', () => {
      service.recordHit('computed-fields');
      service.recordMiss('settlements');
      service.recordMiss('structures');
      service.recordMiss('spatial');

      const stats = service.getStats();

      expect(stats.hitRate).toBe(0.25);
      expect(stats.totalHits).toBe(1);
      expect(stats.totalMisses).toBe(3);
    });

    it('should calculate per-type hit rates correctly', () => {
      // computed-fields: 2 hits, 1 miss = 0.667 (2/3)
      service.recordHit('computed-fields');
      service.recordHit('computed-fields');
      service.recordMiss('computed-fields');

      // settlements: 1 hit, 1 miss = 0.5 (1/2)
      service.recordHit('settlements');
      service.recordMiss('settlements');

      // structures: 0 hits, 2 misses = 0.0 (0/2)
      service.recordMiss('structures');
      service.recordMiss('structures');

      // spatial: 3 hits, 0 misses = 1.0 (3/3)
      service.recordHit('spatial');
      service.recordHit('spatial');
      service.recordHit('spatial');

      const stats = service.getStats();

      // Overall: 6 hits, 4 misses = 0.6 (6/10)
      expect(stats.hitRate).toBe(0.6);
      expect(stats.totalHits).toBe(6);
      expect(stats.totalMisses).toBe(4);

      // Per-type hit rates
      expect(stats.byType['computed-fields'].hitRate).toBeCloseTo(0.667, 3);
      expect(stats.byType['settlements'].hitRate).toBe(0.5);
      expect(stats.byType['structures'].hitRate).toBe(0.0);
      expect(stats.byType['spatial'].hitRate).toBe(1.0);
    });

    it('should return 0 hit rate for cache type with no operations', () => {
      service.recordHit('computed-fields');

      const stats = service.getStats();
      const hitRateForType = service.getHitRateForType('non-existent-type');

      expect(hitRateForType).toBe(0);
      expect(stats.byType['non-existent-type']).toBeUndefined();
    });

    it('should calculate accurate hit rate with large numbers', () => {
      // Simulate 1000 hits and 500 misses
      for (let i = 0; i < 1000; i++) {
        service.recordHit('computed-fields');
      }
      for (let i = 0; i < 500; i++) {
        service.recordMiss('computed-fields');
      }

      const stats = service.getStats();

      // 1000 / 1500 = 0.6667
      expect(stats.hitRate).toBeCloseTo(0.6667, 4);
      expect(stats.byType['computed-fields'].hitRate).toBeCloseTo(0.6667, 4);
    });

    it('should aggregate hit rates correctly across multiple cache types', () => {
      // Type 1: 80% hit rate (8 hits, 2 misses)
      for (let i = 0; i < 8; i++) service.recordHit('computed-fields');
      for (let i = 0; i < 2; i++) service.recordMiss('computed-fields');

      // Type 2: 20% hit rate (2 hits, 8 misses)
      for (let i = 0; i < 2; i++) service.recordHit('settlements');
      for (let i = 0; i < 8; i++) service.recordMiss('settlements');

      const stats = service.getStats();

      // Overall: 10 hits, 10 misses = 50% hit rate
      expect(stats.hitRate).toBe(0.5);
      expect(stats.byType['computed-fields'].hitRate).toBe(0.8);
      expect(stats.byType['settlements'].hitRate).toBe(0.2);
    });
  });
});
