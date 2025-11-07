import { Test, TestingModule } from '@nestjs/testing';
import { Redis } from 'ioredis';

import { REDIS_CACHE } from '../../graphql/cache/redis-cache.provider';

import { CacheService } from './cache.service';

/**
 * Integration tests for CacheService with real Redis
 *
 * These tests are skipped by default because they require:
 * 1. Docker and docker-compose installed
 * 2. Redis service running (docker-compose up -d redis)
 *
 * To run these tests locally:
 * 1. Start Redis: docker-compose up -d redis
 * 2. Remove .skip from describe.skip below
 * 3. Run tests: pnpm --filter @campaign/api test
 * 4. Cleanup: docker-compose down
 *
 * Note: These tests use real Redis operations and verify actual behavior
 * including TTL expiration, pattern deletion, and stats tracking.
 */
describe.skip('CacheService - Redis Integration', () => {
  let cacheService: CacheService;
  let redisClient: Redis;
  let testRedis: Redis;

  // Read from environment (for docker-compose networking)
  const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

  beforeAll(async () => {
    // Set environment variables for CacheService
    process.env.CACHE_DEFAULT_TTL = '300';
    process.env.CACHE_METRICS_ENABLED = 'true';
    process.env.CACHE_LOGGING_ENABLED = 'false';

    // Create REAL Redis connection (used by CacheService)
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

    // Create test module with real Redis client
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: REDIS_CACHE,
          useValue: redisClient,
        },
        CacheService,
      ],
    }).compile();

    cacheService = module.get<CacheService>(CacheService);

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

    // Reset stats
    cacheService.resetStats();
  });

  describe('Basic Operations', () => {
    it('should set and get a value', async () => {
      const testData = { id: 123, name: 'Test Settlement' };

      await cacheService.set('test-key', testData);
      const result = await cacheService.get<typeof testData>('test-key');

      expect(result).toEqual(testData);
    });

    it('should return null for non-existent key', async () => {
      const result = await cacheService.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should delete a key', async () => {
      await cacheService.set('test-key', { data: 'value' });

      const deleteCount = await cacheService.del('test-key');
      expect(deleteCount).toBe(1);

      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
    });

    it('should handle complex nested objects', async () => {
      const complexData = {
        settlement: {
          id: 456,
          name: 'Complex Settlement',
          structures: [
            { id: 1, type: 'building', coordinates: { x: 10, y: 20 } },
            { id: 2, type: 'road', coordinates: { x: 30, y: 40 } },
          ],
        },
        metadata: {
          computed: true,
          timestamp: new Date().toISOString(),
          tags: ['test', 'integration'],
        },
      };

      await cacheService.set('complex-key', complexData);
      const result = await cacheService.get('complex-key');

      expect(result).toEqual(complexData);
    });
  });

  describe('TTL Expiration', () => {
    it('should expire key after TTL seconds', async () => {
      await cacheService.set('expiring-key', { data: 'will expire' }, { ttl: 1 });

      // Verify key exists immediately
      let result = await cacheService.get('expiring-key');
      expect(result).toEqual({ data: 'will expire' });

      // Wait for expiration (1 second + buffer)
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Verify key has expired
      result = await cacheService.get('expiring-key');
      expect(result).toBeNull();
    });

    it('should use default TTL when not specified', async () => {
      await cacheService.set('default-ttl-key', { data: 'test' });

      // Verify TTL is set on key in Redis
      const ttl = await testRedis.ttl('default-ttl-key');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(300); // Default TTL from env
    });

    it('should use custom TTL when specified', async () => {
      await cacheService.set('custom-ttl-key', { data: 'test' }, { ttl: 600 });

      // Verify custom TTL is set
      const ttl = await testRedis.ttl('custom-ttl-key');
      expect(ttl).toBeGreaterThan(590);
      expect(ttl).toBeLessThanOrEqual(600);
    });

    it('should handle multiple keys with different TTLs', async () => {
      await cacheService.set('short-lived', { data: '1sec' }, { ttl: 1 });
      await cacheService.set('long-lived', { data: '5sec' }, { ttl: 5 });

      // Wait for short-lived to expire
      await new Promise((resolve) => setTimeout(resolve, 1200));

      expect(await cacheService.get('short-lived')).toBeNull();
      expect(await cacheService.get('long-lived')).toEqual({ data: '5sec' });
    });
  });

  describe('Pattern Deletion', () => {
    it('should delete all keys matching a pattern', async () => {
      // Set multiple keys with same prefix
      await cacheService.set('computed-fields:settlement:1:main', { id: 1 });
      await cacheService.set('computed-fields:settlement:2:main', { id: 2 });
      await cacheService.set('computed-fields:kingdom:3:main', { id: 3 });
      await cacheService.set('other:settlement:4:main', { id: 4 });

      // Delete all computed-fields keys
      const result = await cacheService.delPattern('computed-fields:*');

      expect(result.success).toBe(true);
      expect(result.keysDeleted).toBe(3);

      // Verify computed-fields keys are gone
      expect(await cacheService.get('computed-fields:settlement:1:main')).toBeNull();
      expect(await cacheService.get('computed-fields:settlement:2:main')).toBeNull();
      expect(await cacheService.get('computed-fields:kingdom:3:main')).toBeNull();

      // Verify other keys still exist
      expect(await cacheService.get('other:settlement:4:main')).toEqual({ id: 4 });
    });

    it('should handle entity-specific pattern deletion', async () => {
      await cacheService.set('computed-fields:settlement:123:main', { type: 'computed' });
      await cacheService.set('settlements:kingdom:456:main', { type: 'list' });
      await cacheService.set('spatial:settlement:123:main', { type: 'spatial' });
      await cacheService.set('computed-fields:settlement:789:main', { type: 'other' });

      // Delete all caches for settlement:123
      const result = await cacheService.delPattern('*:settlement:123:main');

      expect(result.success).toBe(true);
      expect(result.keysDeleted).toBe(2);

      // Verify settlement:123 keys are gone
      expect(await cacheService.get('computed-fields:settlement:123:main')).toBeNull();
      expect(await cacheService.get('spatial:settlement:123:main')).toBeNull();

      // Verify other keys still exist
      expect(await cacheService.get('settlements:kingdom:456:main')).toEqual({ type: 'list' });
      expect(await cacheService.get('computed-fields:settlement:789:main')).toEqual({
        type: 'other',
      });
    });

    it('should handle branch-specific pattern deletion', async () => {
      await cacheService.set('computed-fields:settlement:1:main', { branch: 'main' });
      await cacheService.set('computed-fields:settlement:2:main', { branch: 'main' });
      await cacheService.set('computed-fields:settlement:3:alternate', { branch: 'alternate' });

      // Delete all keys in main branch
      const result = await cacheService.delPattern('*:main');

      expect(result.success).toBe(true);
      expect(result.keysDeleted).toBe(2);

      // Verify main branch keys are gone
      expect(await cacheService.get('computed-fields:settlement:1:main')).toBeNull();
      expect(await cacheService.get('computed-fields:settlement:2:main')).toBeNull();

      // Verify alternate branch keys still exist
      expect(await cacheService.get('computed-fields:settlement:3:alternate')).toEqual({
        branch: 'alternate',
      });
    });

    it('should handle pattern with no matches', async () => {
      const result = await cacheService.delPattern('non-existent-pattern:*');

      expect(result.success).toBe(true);
      expect(result.keysDeleted).toBe(0);
    });

    it('should handle large pattern deletion (pagination)', async () => {
      // Create 250 keys (more than SCAN COUNT=100)
      const promises = [];
      for (let i = 0; i < 250; i++) {
        promises.push(cacheService.set(`bulk:key:${i}:main`, { index: i }));
      }
      await Promise.all(promises);

      // Delete all with pattern
      const result = await cacheService.delPattern('bulk:*');

      expect(result.success).toBe(true);
      expect(result.keysDeleted).toBe(250);

      // Verify all keys are gone
      for (let i = 0; i < 250; i++) {
        expect(await cacheService.get(`bulk:key:${i}:main`)).toBeNull();
      }
    });
  });

  describe('Stats Tracking', () => {
    it('should track cache hits and misses', async () => {
      await cacheService.set('key1', { data: 'value1' });
      await cacheService.set('key2', { data: 'value2' });

      // 2 hits
      await cacheService.get('key1');
      await cacheService.get('key2');

      // 1 miss
      await cacheService.get('non-existent');

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2); // 2/3
    });

    it('should track set operations', async () => {
      await cacheService.set('key1', { data: 'value1' });
      await cacheService.set('key2', { data: 'value2' });
      await cacheService.set('key3', { data: 'value3' });

      const stats = cacheService.getStats();
      expect(stats.sets).toBe(3);
    });

    it('should track delete operations', async () => {
      await cacheService.set('key1', { data: 'value1' });
      await cacheService.set('key2', { data: 'value2' });

      await cacheService.del('key1');
      await cacheService.del('key2');

      const stats = cacheService.getStats();
      expect(stats.deletes).toBe(2);
    });

    it('should track pattern delete operations', async () => {
      await cacheService.set('pattern1:key1', { data: 'value1' });
      await cacheService.set('pattern2:key2', { data: 'value2' });

      await cacheService.delPattern('pattern1:*');
      await cacheService.delPattern('pattern2:*');

      const stats = cacheService.getStats();
      expect(stats.patternDeletes).toBe(2);
    });

    it('should calculate accurate hit rate over multiple operations', async () => {
      await cacheService.set('key1', { data: 'cached' });

      // 5 hits
      for (let i = 0; i < 5; i++) {
        await cacheService.get('key1');
      }

      // 5 misses
      for (let i = 0; i < 5; i++) {
        await cacheService.get(`miss-${i}`);
      }

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(5);
      expect(stats.misses).toBe(5);
      expect(stats.hitRate).toBe(0.5); // 5/10
    });

    it('should reset stats correctly', async () => {
      await cacheService.set('key1', { data: 'value' });
      await cacheService.get('key1');
      await cacheService.del('key1');

      cacheService.resetStats();

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.deletes).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle cache miss, fetch, set, hit workflow', async () => {
      // Cache miss
      let result = await cacheService.get('computed-fields:settlement:123:main');
      expect(result).toBeNull();

      // Simulate fetch from database and cache
      const fetchedData = { id: 123, name: 'Settlement', population: 1000 };
      await cacheService.set('computed-fields:settlement:123:main', fetchedData);

      // Cache hit
      result = await cacheService.get('computed-fields:settlement:123:main');
      expect(result).toEqual(fetchedData);

      const stats = cacheService.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.sets).toBe(1);
    });

    it('should handle bulk invalidation workflow', async () => {
      // Cache multiple settlements
      await cacheService.set('computed-fields:settlement:1:main', { id: 1 });
      await cacheService.set('computed-fields:settlement:2:main', { id: 2 });
      await cacheService.set('computed-fields:settlement:3:main', { id: 3 });

      // Simulate a change that invalidates all computed fields
      const result = await cacheService.delPattern('computed-fields:*');

      expect(result.success).toBe(true);
      expect(result.keysDeleted).toBe(3);

      // Verify all are invalidated
      expect(await cacheService.get('computed-fields:settlement:1:main')).toBeNull();
      expect(await cacheService.get('computed-fields:settlement:2:main')).toBeNull();
      expect(await cacheService.get('computed-fields:settlement:3:main')).toBeNull();
    });

    it('should handle concurrent operations', async () => {
      const promises = [];

      // Concurrent sets
      for (let i = 0; i < 10; i++) {
        promises.push(cacheService.set(`concurrent:key:${i}`, { index: i }));
      }

      await Promise.all(promises);

      // Concurrent gets
      const getPromises = [];
      for (let i = 0; i < 10; i++) {
        getPromises.push(cacheService.get(`concurrent:key:${i}`));
      }

      const results = await Promise.all(getPromises);

      // Verify all values are correct
      results.forEach((result, index) => {
        expect(result).toEqual({ index });
      });
    });

    it('should verify Redis persistence between service instances', async () => {
      // Set value with current service instance
      await cacheService.set('persistent-key', { data: 'persistent value' });

      // Read directly from Redis (simulating different service instance)
      const rawValue = await testRedis.get('persistent-key');
      expect(rawValue).not.toBeNull();

      const parsedValue = JSON.parse(rawValue!);
      expect(parsedValue).toEqual({ data: 'persistent value' });
    });
  });
});
