import { Test, TestingModule } from '@nestjs/testing';
import { Redis } from 'ioredis';

import { CacheStatsService } from '../cache/cache-stats.service';
import { CacheModule } from '../cache/cache.module';
import { CacheService } from '../cache/cache.service';

import { CacheHealthIndicator } from './cache-health.indicator';

describe('CacheHealthIndicator (Integration)', () => {
  let healthIndicator: CacheHealthIndicator;
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
      providers: [CacheHealthIndicator],
    }).compile();

    healthIndicator = module.get<CacheHealthIndicator>(CacheHealthIndicator);
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

  describe('Health Check Status', () => {
    it('should return "up" status when Redis is connected', async () => {
      const result = await healthIndicator.isHealthy('cache');

      expect(result).toHaveProperty('cache');
      expect(result.cache.status).toBe('up');
    });

    it('should include responseTime in health check result', async () => {
      const result = await healthIndicator.isHealthy('cache');

      expect(result.cache).toHaveProperty('responseTime');
      expect(typeof result.cache.responseTime).toBe('number');
      expect(result.cache.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return "up" status even with no cache operations', async () => {
      const result = await healthIndicator.isHealthy('cache');

      expect(result.cache.status).toBe('up');
      expect(result.cache.metrics.totalHits).toBe(0);
      expect(result.cache.metrics.totalMisses).toBe(0);
      expect(result.cache.metrics.hitRate).toBe(0);
    });
  });

  describe('Cache Metrics', () => {
    it('should include hit rate metrics in health check result', async () => {
      // Perform some cache operations to generate stats
      await cacheService.set('test:key1', { data: 'value1' }, { ttl: 300 });
      await cacheService.get('test:key1'); // Hit
      await cacheService.get('test:key2'); // Miss

      const result = await healthIndicator.isHealthy('cache');

      expect(result.cache.metrics).toHaveProperty('hitRate');
      expect(result.cache.metrics).toHaveProperty('totalHits');
      expect(result.cache.metrics).toHaveProperty('totalMisses');
      expect(result.cache.metrics.totalHits).toBe(1);
      expect(result.cache.metrics.totalMisses).toBe(1);
      expect(result.cache.metrics.hitRate).toBeCloseTo(50.0, 1); // Hit rate is percentage (0-100)
    });

    it('should include total key count in health check result', async () => {
      // Add some keys to Redis
      await cacheService.set('computed-fields:entity:1', { data: 'value1' }, { ttl: 300 });
      await cacheService.set('settlements:kingdom:2', { data: 'value2' }, { ttl: 300 });
      await cacheService.set('spatial:query:3', { data: 'value3' }, { ttl: 300 });

      const result = await healthIndicator.isHealthy('cache');

      expect(result.cache.metrics).toHaveProperty('totalKeys');
      expect(result.cache.metrics.totalKeys).toBe(3);
    });

    it('should include memory usage in health check result', async () => {
      const result = await healthIndicator.isHealthy('cache');

      expect(result.cache.metrics).toHaveProperty('memoryUsedMB');
      expect(typeof result.cache.metrics.memoryUsedMB).toBe('number');
      expect(result.cache.metrics.memoryUsedMB).toBeGreaterThan(0);
    });

    it('should indicate when stats tracking is enabled', async () => {
      const result = await healthIndicator.isHealthy('cache');

      expect(result.cache.metrics).toHaveProperty('statsEnabled');
      expect(result.cache.metrics.statsEnabled).toBe(true);
    });
  });

  describe('Degraded Status Detection', () => {
    it('should return "degraded" status when hit rate is low with significant traffic', async () => {
      // Generate significant traffic (>100 operations) with low hit rate
      // Set 10 keys
      for (let i = 0; i < 10; i++) {
        await cacheService.set(`test:key${i}`, { data: `value${i}` }, { ttl: 300 });
      }

      // Generate 10 hits
      for (let i = 0; i < 10; i++) {
        await cacheService.get(`test:key${i}`);
      }

      // Generate 100 misses (total ops = 110, hit rate = 10/110 = 9% < 50%)
      for (let i = 10; i < 110; i++) {
        await cacheService.get(`test:nonexistent${i}`);
      }

      const result = await healthIndicator.isHealthy('cache');

      expect(result.cache.status).toBe('degraded');
      expect(result.cache).toHaveProperty('issues');
      expect(result.cache.issues).toContainEqual(expect.stringContaining('Low hit rate'));
      expect(result.cache.metrics.hitRate).toBeLessThan(50); // Hit rate is percentage (0-100)
    });

    it('should NOT return degraded for low hit rate with insufficient traffic', async () => {
      // Only 5 operations (below 100 threshold)
      await cacheService.set('test:key1', { data: 'value1' }, { ttl: 300 });
      await cacheService.get('test:key1'); // Hit
      await cacheService.get('test:miss1'); // Miss
      await cacheService.get('test:miss2'); // Miss
      await cacheService.get('test:miss3'); // Miss

      const result = await healthIndicator.isHealthy('cache');

      // Should be "up" because insufficient traffic to judge hit rate
      expect(result.cache.status).toBe('up');
      expect(result.cache.metrics.totalHits).toBe(1);
      expect(result.cache.metrics.totalMisses).toBe(3);
    });
  });

  describe('Redis Connection Check', () => {
    it('should verify Redis connection via ping test', async () => {
      const result = await healthIndicator.isHealthy('cache');

      expect(result.cache.status).toBe('up');
      expect(result.cache.message).toContain('Cache operating normally');
    });

    it('should perform set/get/del operations in ping test', async () => {
      await healthIndicator.isHealthy('cache');

      // Verify the health check ping key was created and cleaned up
      const pingKey = 'health-check:ping';
      const exists = await redisClient.exists(pingKey);
      expect(exists).toBe(0); // Should be cleaned up after health check
    });
  });

  describe('Real-World Health Check Scenario', () => {
    it('should provide comprehensive health status for production monitoring', async () => {
      // Simulate realistic cache usage
      // 1. Cache some entities
      await cacheService.set('computed-fields:settlement:1:main', { level: 5 }, { ttl: 300 });
      await cacheService.set('computed-fields:structure:2:main', { power: 100 }, { ttl: 300 });
      await cacheService.set('settlements:kingdom:1:main', ['s1', 's2'], { ttl: 600 });
      await cacheService.set('spatial:nearby:coords:main', [{ id: 1 }], { ttl: 300 });

      // 2. Cache hits (80% hit rate for healthy cache)
      for (let i = 0; i < 80; i++) {
        await cacheService.get('computed-fields:settlement:1:main');
      }

      // 3. Cache misses (20% miss rate)
      for (let i = 0; i < 20; i++) {
        await cacheService.get(`computed-fields:missing:${i}:main`);
      }

      // 4. Some invalidations
      await cacheService.del('computed-fields:structure:2:main');

      // 5. Check health status
      const result = await healthIndicator.isHealthy('cache');

      // Assertions
      expect(result.cache.status).toBe('up'); // Healthy with 80% hit rate
      expect(result.cache.metrics.hitRate).toBeCloseTo(80.0, 1); // 80% hit rate (as percentage)
      expect(result.cache.metrics.totalHits).toBe(80);
      expect(result.cache.metrics.totalMisses).toBe(20);
      expect(result.cache.metrics.totalKeys).toBe(3); // 4 set - 1 deleted = 3
      expect(result.cache.metrics.statsEnabled).toBe(true);
      expect(result.cache.metrics.memoryUsedMB).toBeGreaterThan(0);
      expect(result.cache.responseTime).toBeGreaterThan(0);
      expect(result.cache.issues).toBeUndefined(); // No issues for healthy cache
    });
  });

  describe('NestJS Terminus Integration', () => {
    it('should return HealthIndicatorResult format compatible with Terminus', async () => {
      const result = await healthIndicator.isHealthy('cache');

      // Verify Terminus HealthIndicatorResult format
      expect(result).toHaveProperty('cache');
      expect(typeof result.cache).toBe('object');
      expect(result.cache).toHaveProperty('status');
      expect(['up', 'degraded', 'down']).toContain(result.cache.status);
    });

    it('should use custom health check key parameter', async () => {
      const customKey = 'redis-cache';
      const result = await healthIndicator.isHealthy(customKey);

      expect(result).toHaveProperty(customKey);
      expect(result[customKey]).toHaveProperty('status');
    });
  });
});
