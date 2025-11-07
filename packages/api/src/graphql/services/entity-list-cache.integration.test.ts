/**
 * Entity List Cache Integration Tests
 *
 * Tests end-to-end entity list caching (settlements by kingdom, structures by settlement)
 * with real Redis instance.
 *
 * SETUP REQUIRED:
 * 1. Start Redis: docker-compose up -d redis
 * 2. Remove .skip from describe block below
 * 3. Run: pnpm --filter @campaign/api test
 * 4. Cleanup: docker-compose down
 */

import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';

import { CacheService } from '../../common/cache/cache.service';
import { REDIS_CACHE } from '../../graphql/cache/redis-cache.provider';

describe.skip('Entity List Cache Integration (Real Redis)', () => {
  let cacheService: CacheService;
  let redisClient: Redis;
  let testRedis: Redis;

  const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

  beforeAll(async () => {
    // Create Redis client for CacheService
    redisClient = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      db: 1, // Cache database
      retryStrategy: (times) => {
        if (times > 3) {
          return null; // Stop retrying
        }
        return Math.min(times * 50, 2000);
      },
    });

    // Create separate Redis client for test assertions and cleanup
    testRedis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      db: 1,
    });

    // Create NestJS test module
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
    await redisClient.ping();
  });

  beforeEach(async () => {
    // Clear database before each test for isolation
    await testRedis.flushdb();
    // Reset stats (accessing private method for testing)
    if ('resetStats' in cacheService && typeof cacheService.resetStats === 'function') {
      cacheService.resetStats();
    }
  });

  afterAll(async () => {
    // Cleanup
    await testRedis.flushdb();
    await redisClient.quit();
    await testRedis.quit();
  });

  describe('Settlement List Caching', () => {
    it('should cache settlement list by kingdom and return cached data on subsequent requests', async () => {
      const kingdomId = 'kingdom-1';
      const branchId = 'main';
      const cacheKey = `settlements:kingdom:${kingdomId}:${branchId}`;
      const settlements = [
        { id: 'settlement-1', name: 'Minas Tirith', kingdomId },
        { id: 'settlement-2', name: 'Osgiliath', kingdomId },
      ];

      // Cache miss - key should not exist
      const missResult = await cacheService.get(cacheKey);
      expect(missResult).toBeNull();

      // Store settlement list
      await cacheService.set(cacheKey, settlements, 600);

      // Verify stored in Redis
      const rawValue = await testRedis.get(`cache:${cacheKey}`);
      expect(rawValue).toBeTruthy();
      const parsedValue = JSON.parse(rawValue!);
      expect(parsedValue).toEqual(settlements);

      // Cache hit - should return cached data
      const hitResult = await cacheService.get(cacheKey);
      expect(hitResult).toEqual(settlements);
    });

    it('should invalidate settlement list when cache.del is called', async () => {
      const kingdomId = 'kingdom-1';
      const branchId = 'main';
      const cacheKey = `settlements:kingdom:${kingdomId}:${branchId}`;
      const settlements = [{ id: 'settlement-1', name: 'Minas Tirith', kingdomId }];

      // Store and verify
      await cacheService.set(cacheKey, settlements, 600);
      const cachedData = await cacheService.get(cacheKey);
      expect(cachedData).toEqual(settlements);

      // Invalidate
      await cacheService.del(cacheKey);

      // Verify deleted
      const afterDelete = await cacheService.get(cacheKey);
      expect(afterDelete).toBeNull();
    });

    it('should respect TTL for settlement list cache', async () => {
      const kingdomId = 'kingdom-1';
      const branchId = 'main';
      const cacheKey = `settlements:kingdom:${kingdomId}:${branchId}`;
      const settlements = [{ id: 'settlement-1', name: 'Minas Tirith', kingdomId }];
      const ttl = 2; // 2 seconds

      // Store with short TTL
      await cacheService.set(cacheKey, settlements, ttl);

      // Immediately should be cached
      const immediate = await cacheService.get(cacheKey);
      expect(immediate).toEqual(settlements);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 2100));

      // Should be expired
      const afterExpiration = await cacheService.get(cacheKey);
      expect(afterExpiration).toBeNull();
    });
  });

  describe('Structure List Caching', () => {
    it('should cache structure list by settlement and return cached data on subsequent requests', async () => {
      const settlementId = 'settlement-1';
      const branchId = 'main';
      const cacheKey = `structures:settlement:${settlementId}:${branchId}`;
      const structures = [
        { id: 'structure-1', name: 'Temple', settlementId, type: 'temple' },
        { id: 'structure-2', name: 'Barracks', settlementId, type: 'military' },
      ];

      // Cache miss
      const missResult = await cacheService.get(cacheKey);
      expect(missResult).toBeNull();

      // Store structure list
      await cacheService.set(cacheKey, structures, 600);

      // Verify stored in Redis
      const rawValue = await testRedis.get(`cache:${cacheKey}`);
      expect(rawValue).toBeTruthy();
      const parsedValue = JSON.parse(rawValue!);
      expect(parsedValue).toEqual(structures);

      // Cache hit
      const hitResult = await cacheService.get(cacheKey);
      expect(hitResult).toEqual(structures);
    });

    it('should invalidate structure list when cache.del is called', async () => {
      const settlementId = 'settlement-1';
      const branchId = 'main';
      const cacheKey = `structures:settlement:${settlementId}:${branchId}`;
      const structures = [{ id: 'structure-1', name: 'Temple', settlementId, type: 'temple' }];

      // Store and verify
      await cacheService.set(cacheKey, structures, 600);
      const cachedData = await cacheService.get(cacheKey);
      expect(cachedData).toEqual(structures);

      // Invalidate
      await cacheService.del(cacheKey);

      // Verify deleted
      const afterDelete = await cacheService.get(cacheKey);
      expect(afterDelete).toBeNull();
    });

    it('should respect TTL for structure list cache', async () => {
      const settlementId = 'settlement-1';
      const branchId = 'main';
      const cacheKey = `structures:settlement:${settlementId}:${branchId}`;
      const structures = [{ id: 'structure-1', name: 'Temple', settlementId, type: 'temple' }];
      const ttl = 2; // 2 seconds

      // Store with short TTL
      await cacheService.set(cacheKey, structures, ttl);

      // Immediately should be cached
      const immediate = await cacheService.get(cacheKey);
      expect(immediate).toEqual(structures);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 2100));

      // Should be expired
      const afterExpiration = await cacheService.get(cacheKey);
      expect(afterExpiration).toBeNull();
    });
  });

  describe('End-to-End Workflow', () => {
    it('should handle complete cache miss → set → hit workflow for settlements', async () => {
      const kingdomId = 'kingdom-1';
      const branchId = 'main';
      const cacheKey = `settlements:kingdom:${kingdomId}:${branchId}`;
      const settlements = [
        { id: 'settlement-1', name: 'Minas Tirith', kingdomId },
        { id: 'settlement-2', name: 'Osgiliath', kingdomId },
      ];

      // 1. Cache miss (simulates first request)
      let result = await cacheService.get(cacheKey);
      expect(result).toBeNull();

      // 2. "Fetch from database" and cache (simulates service after DB query)
      await cacheService.set(cacheKey, settlements, 600);

      // 3. Cache hit on subsequent request
      result = await cacheService.get(cacheKey);
      expect(result).toEqual(settlements);

      // 4. Invalidate after create/delete
      await cacheService.del(cacheKey);

      // 5. Cache miss again
      result = await cacheService.get(cacheKey);
      expect(result).toBeNull();
    });

    it('should handle complete cache miss → set → hit workflow for structures', async () => {
      const settlementId = 'settlement-1';
      const branchId = 'main';
      const cacheKey = `structures:settlement:${settlementId}:${branchId}`;
      const structures = [
        { id: 'structure-1', name: 'Temple', settlementId, type: 'temple' },
        { id: 'structure-2', name: 'Barracks', settlementId, type: 'military' },
      ];

      // 1. Cache miss
      let result = await cacheService.get(cacheKey);
      expect(result).toBeNull();

      // 2. Store after "database fetch"
      await cacheService.set(cacheKey, structures, 600);

      // 3. Cache hit
      result = await cacheService.get(cacheKey);
      expect(result).toEqual(structures);

      // 4. Invalidate
      await cacheService.del(cacheKey);

      // 5. Cache miss again
      result = await cacheService.get(cacheKey);
      expect(result).toBeNull();
    });

    it('should cache multiple entity lists independently', async () => {
      const kingdom1Key = 'settlements:kingdom:kingdom-1:main';
      const kingdom2Key = 'settlements:kingdom:kingdom-2:main';
      const settlement1Key = 'structures:settlement:settlement-1:main';
      const settlement2Key = 'structures:settlement:settlement-2:main';

      const settlements1 = [{ id: 'settlement-1', name: 'Minas Tirith', kingdomId: 'kingdom-1' }];
      const settlements2 = [{ id: 'settlement-3', name: 'Edoras', kingdomId: 'kingdom-2' }];
      const structures1 = [{ id: 'structure-1', name: 'Temple', settlementId: 'settlement-1' }];
      const structures2 = [{ id: 'structure-3', name: 'Hall', settlementId: 'settlement-2' }];

      // Store all
      await Promise.all([
        cacheService.set(kingdom1Key, settlements1, 600),
        cacheService.set(kingdom2Key, settlements2, 600),
        cacheService.set(settlement1Key, structures1, 600),
        cacheService.set(settlement2Key, structures2, 600),
      ]);

      // Verify all cached independently
      const results = await Promise.all([
        cacheService.get(kingdom1Key),
        cacheService.get(kingdom2Key),
        cacheService.get(settlement1Key),
        cacheService.get(settlement2Key),
      ]);

      expect(results[0]).toEqual(settlements1);
      expect(results[1]).toEqual(settlements2);
      expect(results[2]).toEqual(structures1);
      expect(results[3]).toEqual(structures2);

      // Invalidate one
      await cacheService.del(kingdom1Key);

      // Verify only that one is gone
      const afterDelete = await Promise.all([
        cacheService.get(kingdom1Key),
        cacheService.get(kingdom2Key),
        cacheService.get(settlement1Key),
        cacheService.get(settlement2Key),
      ]);

      expect(afterDelete[0]).toBeNull();
      expect(afterDelete[1]).toEqual(settlements2);
      expect(afterDelete[2]).toEqual(structures1);
      expect(afterDelete[3]).toEqual(structures2);
    });
  });
});
