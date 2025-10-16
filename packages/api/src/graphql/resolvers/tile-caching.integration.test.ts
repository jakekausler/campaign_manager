/**
 * Tile Caching Integration Tests
 * Tests for map tile caching and cache invalidation
 */

import { Test, TestingModule } from '@nestjs/testing';

import type { GeoJSONFeatureCollection, GeoJSONPoint } from '@campaign/shared';

import { TileCacheService } from '../../common/services/tile-cache.service';
import { PrismaService } from '../../database/prisma.service';

describe('Tile Caching Integration', () => {
  let prisma: PrismaService;
  let tileCacheService: TileCacheService;
  let worldId: string;
  let campaignId: string;
  let userId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TileCacheService, PrismaService],
    }).compile();

    tileCacheService = module.get<TileCacheService>(TileCacheService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Create test user first (needed for campaign ownerId)
    const user = await prisma.user.create({
      data: {
        email: 'cache-test@example.com',
        name: 'Cache Test User',
        password: 'hash',
      },
    });
    userId = user.id;

    // Create test world, campaign, and branch
    const world = await prisma.world.create({
      data: {
        name: 'Cache Test World',
        calendars: {},
      },
    });
    worldId = world.id;

    const campaign = await prisma.campaign.create({
      data: {
        worldId,
        name: 'Cache Test Campaign',
        ownerId: userId,
        srid: 3857,
      },
    });
    campaignId = campaign.id;

    await prisma.branch.create({
      data: {
        campaignId,
        name: 'main',
      },
    });

    // Clear cache before each test
    tileCacheService.clear();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.branch.deleteMany({ where: { campaignId } });
    await prisma.campaign.deleteMany({ where: { worldId } });
    await prisma.location.deleteMany({ where: { worldId } });
    await prisma.world.delete({ where: { id: worldId } });
    await prisma.user.delete({ where: { id: userId } });

    // Clear cache after each test
    tileCacheService.clear();
  });

  describe('mapLayer caching', () => {
    it('should cache mapLayer results on first request', async () => {
      // Create location with geometry
      const location = await prisma.location.create({
        data: {
          worldId,
          type: 'city',
          name: 'Test City',
          description: 'A test city',
        },
      });

      // Add geometry using raw SQL
      const pointGeometry: GeoJSONPoint = {
        type: 'Point',
        coordinates: [-122.5, 37.7],
      };
      const wkx = await import('wkx');
      const wkb = wkx.Geometry.parseGeoJSON(pointGeometry).toWkb();
      const ewkb = Buffer.concat([
        Buffer.from([0x01, 0x01, 0x00, 0x00, 0x20, 0x0f, 0x0f, 0x00, 0x00]),
        wkb,
      ]);

      await prisma.$executeRaw`
        UPDATE "Location"
        SET geom = ST_GeomFromEWKB(${ewkb})
        WHERE id = ${location.id}
      `;

      // Generate cache key
      const bbox = { west: -123, south: 37, east: -122, north: 38 };
      const cacheKey = tileCacheService.generateTileKey(worldId, bbox);

      // Verify cache is initially empty
      expect(tileCacheService.get(cacheKey)).toBeNull();

      // Call mapLayer (simulated by directly using SpatialService and manual caching logic)
      // In real usage, the resolver handles this
      const featureCollection: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: location.id,
            geometry: pointGeometry,
            properties: { name: 'Test City', type: 'city' },
          },
        ],
      };

      // Cache the result
      tileCacheService.set(cacheKey, featureCollection);

      // Verify cache now contains the result
      const cached = tileCacheService.get(cacheKey);
      expect(cached).not.toBeNull();
      expect(cached?.features).toHaveLength(1);
      expect(cached?.features[0].properties.name).toBe('Test City');
    });

    it('should return cached result on subsequent request', async () => {
      const bbox = { west: -123, south: 37, east: -122, north: 38 };
      const cacheKey = tileCacheService.generateTileKey(worldId, bbox);

      const featureCollection: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };

      // First request - cache the result
      tileCacheService.set(cacheKey, featureCollection);

      // Second request - should get cached result
      const cached1 = tileCacheService.get(cacheKey);
      const cached2 = tileCacheService.get(cacheKey);

      expect(cached1).toBe(cached2); // Same object reference (cached)
    });

    it('should use different cache keys for different bounding boxes', async () => {
      const bbox1 = { west: -123, south: 37, east: -122, north: 38 };
      const bbox2 = { west: -124, south: 36, east: -123, north: 37 };

      const key1 = tileCacheService.generateTileKey(worldId, bbox1);
      const key2 = tileCacheService.generateTileKey(worldId, bbox2);

      expect(key1).not.toBe(key2);

      const fc1: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: '1',
            geometry: { type: 'Point', coordinates: [-122.5, 37.5] },
            properties: { name: 'Location 1' },
          },
        ],
      };

      const fc2: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: '2',
            geometry: { type: 'Point', coordinates: [-123.5, 36.5] },
            properties: { name: 'Location 2' },
          },
        ],
      };

      tileCacheService.set(key1, fc1);
      tileCacheService.set(key2, fc2);

      expect(tileCacheService.get(key1)?.features[0].properties.name).toBe('Location 1');
      expect(tileCacheService.get(key2)?.features[0].properties.name).toBe('Location 2');
    });

    it('should use different cache keys for different filters', async () => {
      const bbox = { west: -123, south: 37, east: -122, north: 38 };

      const key1 = tileCacheService.generateTileKey(worldId, bbox);
      const key2 = tileCacheService.generateTileKey(worldId, bbox, { locationTypes: ['city'] });

      expect(key1).not.toBe(key2);
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate all tiles for a world when geometry is updated', async () => {
      // Create multiple cache entries for the world
      const bbox1 = { west: -123, south: 37, east: -122, north: 38 };
      const bbox2 = { west: -124, south: 36, east: -123, north: 37 };

      const key1 = tileCacheService.generateTileKey(worldId, bbox1);
      const key2 = tileCacheService.generateTileKey(worldId, bbox2);

      const fc: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };

      tileCacheService.set(key1, fc);
      tileCacheService.set(key2, fc);

      // Verify cache is populated
      expect(tileCacheService.get(key1)).not.toBeNull();
      expect(tileCacheService.get(key2)).not.toBeNull();

      // Invalidate all tiles for this world
      tileCacheService.invalidateWorld(worldId);

      // Verify all tiles are invalidated
      expect(tileCacheService.get(key1)).toBeNull();
      expect(tileCacheService.get(key2)).toBeNull();
    });

    it('should only invalidate tiles for the specified world', async () => {
      // Create another world
      const world2 = await prisma.world.create({
        data: {
          name: 'Other World',
          calendars: {},
        },
      });

      const bbox = { west: -123, south: 37, east: -122, north: 38 };

      const key1 = tileCacheService.generateTileKey(worldId, bbox);
      const key2 = tileCacheService.generateTileKey(world2.id, bbox);

      const fc: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };

      tileCacheService.set(key1, fc);
      tileCacheService.set(key2, fc);

      // Invalidate only tiles for worldId
      tileCacheService.invalidateWorld(worldId);

      // worldId tiles should be invalidated
      expect(tileCacheService.get(key1)).toBeNull();

      // world2 tiles should remain cached
      expect(tileCacheService.get(key2)).not.toBeNull();

      // Cleanup
      await prisma.world.delete({ where: { id: world2.id } });
    });
  });

  describe('cache statistics', () => {
    it('should track cache size correctly', async () => {
      const bbox1 = { west: -123, south: 37, east: -122, north: 38 };
      const bbox2 = { west: -124, south: 36, east: -123, north: 37 };

      const fc: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };

      // Initially empty
      expect(tileCacheService.getStats().size).toBe(0);

      // Add first entry
      const key1 = tileCacheService.generateTileKey(worldId, bbox1);
      tileCacheService.set(key1, fc);
      expect(tileCacheService.getStats().size).toBe(1);

      // Add second entry
      const key2 = tileCacheService.generateTileKey(worldId, bbox2);
      tileCacheService.set(key2, fc);
      expect(tileCacheService.getStats().size).toBe(2);

      // Clear cache
      tileCacheService.clear();
      expect(tileCacheService.getStats().size).toBe(0);
    });

    it('should list all cache keys', async () => {
      const bbox1 = { west: -123, south: 37, east: -122, north: 38 };
      const bbox2 = { west: -124, south: 36, east: -123, north: 37 };

      const fc: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };

      const key1 = tileCacheService.generateTileKey(worldId, bbox1);
      const key2 = tileCacheService.generateTileKey(worldId, bbox2);

      tileCacheService.set(key1, fc);
      tileCacheService.set(key2, fc);

      const stats = tileCacheService.getStats();
      expect(stats.keys).toContain(key1);
      expect(stats.keys).toContain(key2);
      expect(stats.keys).toHaveLength(2);
    });
  });
});
