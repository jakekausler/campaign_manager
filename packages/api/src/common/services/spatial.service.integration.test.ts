import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';

import { PrismaService } from '../../database/prisma.service';
import { REDIS_CACHE } from '../cache/cache.module';
import { CacheService } from '../cache/cache.service';
import type { GeoJSONPoint, GeoJSONPolygon } from '../types/geojson.types';

import { SpatialService } from './spatial.service';

describe.skip('SpatialService - Redis Integration', () => {
  let spatialService: SpatialService;
  let cacheService: CacheService;
  let prismaService: PrismaService;
  let redis: Redis;

  const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
  const REDIS_DB = 1; // Cache uses DB 1

  beforeAll(async () => {
    // Suppress logger output
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();

    // Create real Redis client
    redis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      db: REDIS_DB,
    });

    // Create NestJS test module with real Redis
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: REDIS_CACHE,
          useValue: redis,
        },
        CacheService,
        PrismaService,
        SpatialService,
      ],
    }).compile();

    cacheService = module.get<CacheService>(CacheService);
    prismaService = module.get<PrismaService>(PrismaService);
    spatialService = module.get<SpatialService>(SpatialService);

    // Wait for Redis connection
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Cleanup
    await redis.flushdb();
    await redis.quit();
    await prismaService.$disconnect();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await redis.flushdb();
  });

  describe('locationsNear caching', () => {
    it('should cache spatial query results and return cached data on second call', async () => {
      const point: GeoJSONPoint = {
        type: 'Point',
        coordinates: [120.123456, 40.234567],
      };
      const radius = 1000;
      const srid = 3857;
      const worldId = 'world-123';

      // Mock database query
      const mockResults = [
        {
          id: 'loc-1',
          name: 'Test Location 1',
          worldId: 'world-123',
          geometry: {
            type: 'Point',
            coordinates: [120.123, 40.234],
          } as GeoJSONPoint,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      jest.spyOn(prismaService, '$queryRaw').mockResolvedValue(mockResults);

      // First call - cache miss, queries database
      const result1 = await spatialService.locationsNear(point, radius, srid, worldId);
      expect(result1).toEqual(mockResults);
      expect(prismaService.$queryRaw).toHaveBeenCalledTimes(1);

      // Verify cache was populated
      const cacheKey = await redis.keys('spatial:locations-near:*');
      expect(cacheKey.length).toBe(1);

      // Second call - cache hit, does NOT query database
      (prismaService.$queryRaw as jest.Mock).mockClear();
      const result2 = await spatialService.locationsNear(point, radius, srid, worldId);
      expect(result2).toEqual(mockResults);
      expect(prismaService.$queryRaw).not.toHaveBeenCalled(); // Cache hit!
    });

    it('should generate deterministic cache keys for same coordinates', async () => {
      const point1: GeoJSONPoint = {
        type: 'Point',
        coordinates: [120.123456789, 40.234567891], // High precision
      };
      const point2: GeoJSONPoint = {
        type: 'Point',
        coordinates: [120.123456, 40.234567], // Lower precision
      };
      const radius = 1000;
      const srid = 3857;

      const mockResults = [
        {
          id: 'loc-1',
          name: 'Test Location',
          worldId: 'world-123',
          geometry: {
            type: 'Point',
            coordinates: [120.123, 40.234],
          } as GeoJSONPoint,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      jest.spyOn(prismaService, '$queryRaw').mockResolvedValue(mockResults);

      // Call with both point variations
      await spatialService.locationsNear(point1, radius, srid);
      await spatialService.locationsNear(point2, radius, srid);

      // Verify only ONE cache key exists (same normalized key)
      const cacheKeys = await redis.keys('spatial:locations-near:*');
      expect(cacheKeys.length).toBe(1);

      // Verify database was only queried once (second call hit cache)
      expect(prismaService.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('locationsInRegion caching', () => {
    it('should cache region query results and return cached data on second call', async () => {
      const regionGeometry: GeoJSONPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [120.0, 40.0],
            [121.0, 40.0],
            [121.0, 41.0],
            [120.0, 41.0],
            [120.0, 40.0],
          ],
        ],
      };
      const regionId = 'region-123';
      const worldId = 'world-123';

      const mockResults = [
        {
          id: 'loc-1',
          name: 'Location in Region',
          worldId: 'world-123',
          geometry: {
            type: 'Point',
            coordinates: [120.5, 40.5],
          } as GeoJSONPoint,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      jest.spyOn(prismaService, '$queryRaw').mockResolvedValue(mockResults);

      // First call - cache miss
      const result1 = await spatialService.locationsInRegion(regionGeometry, regionId, worldId);
      expect(result1).toEqual(mockResults);
      expect(prismaService.$queryRaw).toHaveBeenCalledTimes(1);

      // Second call - cache hit
      (prismaService.$queryRaw as jest.Mock).mockClear();
      const result2 = await spatialService.locationsInRegion(regionGeometry, regionId, worldId);
      expect(result2).toEqual(mockResults);
      expect(prismaService.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('settlementsInRegion caching', () => {
    it('should cache settlement query results and return cached data on second call', async () => {
      const regionGeometry: GeoJSONPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [100.0, 30.0],
            [101.0, 30.0],
            [101.0, 31.0],
            [100.0, 31.0],
            [100.0, 30.0],
          ],
        ],
      };
      const regionId = 'region-789';
      const worldId = 'world-789';

      const mockResults = [
        {
          id: 'settlement-1',
          name: 'Settlement in Region',
          level: 3,
          locationId: 'loc-s1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      jest.spyOn(prismaService, '$queryRaw').mockResolvedValue(mockResults);

      // First call - cache miss
      const result1 = await spatialService.settlementsInRegion(regionGeometry, regionId, worldId);
      expect(result1).toEqual(mockResults);
      expect(prismaService.$queryRaw).toHaveBeenCalledTimes(1);

      // Second call - cache hit
      (prismaService.$queryRaw as jest.Mock).mockClear();
      const result2 = await spatialService.settlementsInRegion(regionGeometry, regionId, worldId);
      expect(result2).toEqual(mockResults);
      expect(prismaService.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('cache TTL expiration', () => {
    it('should expire spatial cache entries after TTL (300 seconds)', async () => {
      const point: GeoJSONPoint = {
        type: 'Point',
        coordinates: [120.123456, 40.234567],
      };
      const radius = 1000;
      const srid = 3857;

      const mockResults = [
        {
          id: 'loc-1',
          name: 'Test Location',
          worldId: 'world-123',
          geometry: {
            type: 'Point',
            coordinates: [120.123, 40.234],
          } as GeoJSONPoint,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      jest.spyOn(prismaService, '$queryRaw').mockResolvedValue(mockResults);

      // First call - populates cache
      await spatialService.locationsNear(point, radius, srid);

      // Verify cache key exists
      const cacheKeys = await redis.keys('spatial:locations-near:*');
      expect(cacheKeys.length).toBe(1);

      // Verify TTL is set (should be ~300 seconds)
      const ttl = await redis.ttl(cacheKeys[0]);
      expect(ttl).toBeGreaterThan(290);
      expect(ttl).toBeLessThanOrEqual(300);
    }, 10000); // Increase timeout for this test
  });

  describe('pattern-based cache invalidation', () => {
    it('should invalidate all spatial caches with pattern deletion', async () => {
      const branchId = 'main';

      // Populate cache with multiple spatial queries
      await cacheService.set('spatial:locations-near:40.1:120.1:1000:3857:main', ['data1'], {
        ttl: 300,
      });
      await cacheService.set('spatial:locations-in-region:region-1:world-1:main', ['data2'], {
        ttl: 300,
      });
      await cacheService.set('spatial:settlements-in-region:region-2:world-2:main', ['data3'], {
        ttl: 300,
      });
      await cacheService.set('other:cache:key:main', ['data4'], { ttl: 300 });

      // Verify all caches exist
      const spatialKeys = await redis.keys('spatial:*:main');
      expect(spatialKeys.length).toBe(3);

      // Invalidate all spatial caches using pattern
      const result = await cacheService.delPattern(`spatial:*:${branchId}`);

      // Verify invalidation
      expect(result.success).toBe(true);
      expect(result.keysDeleted).toBe(3);

      // Verify spatial caches are gone
      const remainingSpatialKeys = await redis.keys('spatial:*:main');
      expect(remainingSpatialKeys.length).toBe(0);

      // Verify other caches remain
      const otherKey = await cacheService.get('other:cache:key:main');
      expect(otherKey).toEqual(['data4']);
    });
  });
});
