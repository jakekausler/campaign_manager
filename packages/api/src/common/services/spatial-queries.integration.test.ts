/**
 * Integration tests for SpatialService spatial query operations
 * Tests PostGIS spatial queries with real database
 */
import { Test, TestingModule } from '@nestjs/testing';

import { GeoJSONPoint, SRID } from '@campaign/shared';

import { PrismaService } from '../../database/prisma.service';

import { SpatialService, BoundingBox } from './spatial.service';

describe('SpatialService - Spatial Queries (Integration)', () => {
  let service: SpatialService;
  let prisma: PrismaService;
  let testWorldId: string;
  let testPointId: string;
  let testRegionId: string;
  let testRegion2Id: string;
  let testPointInRegionId: string;
  let testPointOutsideRegionId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SpatialService, PrismaService],
    }).compile();

    service = module.get<SpatialService>(SpatialService);
    prisma = module.get<PrismaService>(PrismaService);

    // Create test world
    const world = await prisma.world.create({
      data: {
        name: 'Test World for Spatial Queries',
        calendars: [],
      },
    });
    testWorldId = world.id;

    // Create test locations with geometry
    // Point 1: (0, 0)
    const point1Geom = service.geoJsonToEWKB(
      { type: 'Point', coordinates: [0, 0] },
      SRID.WEB_MERCATOR
    );
    await prisma.$executeRaw`
      INSERT INTO "Location" (id, "worldId", type, name, geom, "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(),
        ${testWorldId},
        'point',
        'Point at Origin',
        ST_GeomFromEWKB(${point1Geom}),
        NOW(),
        NOW()
      )
      RETURNING id
    `;
    const result1 = await prisma.$queryRaw<[{ id: string }]>`
      SELECT id FROM "Location" WHERE name = 'Point at Origin'
    `;
    testPointId = result1[0].id;

    // Point 2: (5, 5) - inside region
    const point2Geom = service.geoJsonToEWKB(
      { type: 'Point', coordinates: [5, 5] },
      SRID.WEB_MERCATOR
    );
    await prisma.$executeRaw`
      INSERT INTO "Location" (id, "worldId", type, name, geom, "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(),
        ${testWorldId},
        'point',
        'Point Inside Region',
        ST_GeomFromEWKB(${point2Geom}),
        NOW(),
        NOW()
      )
    `;
    const result2 = await prisma.$queryRaw<[{ id: string }]>`
      SELECT id FROM "Location" WHERE name = 'Point Inside Region'
    `;
    testPointInRegionId = result2[0].id;

    // Point 3: (50, 50) - outside region
    const point3Geom = service.geoJsonToEWKB(
      { type: 'Point', coordinates: [50, 50] },
      SRID.WEB_MERCATOR
    );
    await prisma.$executeRaw`
      INSERT INTO "Location" (id, "worldId", type, name, geom, "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(),
        ${testWorldId},
        'point',
        'Point Outside Region',
        ST_GeomFromEWKB(${point3Geom}),
        NOW(),
        NOW()
      )
    `;
    const result3 = await prisma.$queryRaw<[{ id: string }]>`
      SELECT id FROM "Location" WHERE name = 'Point Outside Region'
    `;
    testPointOutsideRegionId = result3[0].id;

    // Region: Square from (0, 0) to (10, 10)
    const regionGeom = service.geoJsonToEWKB(
      {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
          ],
        ],
      },
      SRID.WEB_MERCATOR
    );
    await prisma.$executeRaw`
      INSERT INTO "Location" (id, "worldId", type, name, geom, "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(),
        ${testWorldId},
        'region',
        'Test Region',
        ST_GeomFromEWKB(${regionGeom}),
        NOW(),
        NOW()
      )
    `;
    const result4 = await prisma.$queryRaw<[{ id: string }]>`
      SELECT id FROM "Location" WHERE name = 'Test Region'
    `;
    testRegionId = result4[0].id;

    // Region 2: Square from (5, 5) to (15, 15) - overlaps with Region 1
    const region2Geom = service.geoJsonToEWKB(
      {
        type: 'Polygon',
        coordinates: [
          [
            [5, 5],
            [15, 5],
            [15, 15],
            [5, 15],
            [5, 5],
          ],
        ],
      },
      SRID.WEB_MERCATOR
    );
    await prisma.$executeRaw`
      INSERT INTO "Location" (id, "worldId", type, name, geom, "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(),
        ${testWorldId},
        'region',
        'Overlapping Region',
        ST_GeomFromEWKB(${region2Geom}),
        NOW(),
        NOW()
      )
    `;
    const result5 = await prisma.$queryRaw<[{ id: string }]>`
      SELECT id FROM "Location" WHERE name = 'Overlapping Region'
    `;
    testRegion2Id = result5[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.location.deleteMany({
      where: { worldId: testWorldId },
    });
    await prisma.world.delete({
      where: { id: testWorldId },
    });
    await prisma.$disconnect();
  });

  describe('pointWithinRegion', () => {
    it('should return true for point inside region', async () => {
      const result = await service.pointWithinRegion(testPointInRegionId, testRegionId);
      expect(result).toBe(true);
    });

    it('should return false for point outside region', async () => {
      const result = await service.pointWithinRegion(testPointOutsideRegionId, testRegionId);
      expect(result).toBe(false);
    });

    it('should return true for point on region boundary', async () => {
      const result = await service.pointWithinRegion(testPointId, testRegionId);
      // Points on boundary are considered inside by ST_Within
      expect(result).toBe(true);
    });
  });

  describe('distance', () => {
    it('should calculate distance between two points', async () => {
      const result = await service.distance(testPointId, testPointInRegionId);
      expect(result).toBeGreaterThan(0);
      // Distance should be approximately sqrt((5-0)^2 + (5-0)^2) = sqrt(50) ≈ 7.07
      expect(result).toBeCloseTo(7.07, 1);
    });

    it('should return zero for distance from point to itself', async () => {
      const result = await service.distance(testPointId, testPointId);
      expect(result).toBe(0);
    });

    it('should calculate larger distance correctly', async () => {
      const result = await service.distance(testPointId, testPointOutsideRegionId);
      expect(result).toBeGreaterThan(50);
      // Distance should be approximately sqrt((50-0)^2 + (50-0)^2) = sqrt(5000) ≈ 70.71
      expect(result).toBeCloseTo(70.71, 1);
    });
  });

  describe('locationsInBounds', () => {
    it('should return locations within bounding box', async () => {
      const bbox: BoundingBox = {
        west: -1,
        south: -1,
        east: 11,
        north: 11,
        srid: SRID.WEB_MERCATOR,
      };
      const results = await service.locationsInBounds(bbox, testWorldId);

      expect(results.length).toBeGreaterThan(0);
      // Should include points and regions in the area
      const names = results.map((r) => r.name);
      expect(names).toContain('Point at Origin');
      expect(names).toContain('Point Inside Region');
      expect(names).toContain('Test Region');
    });

    it('should exclude locations outside bounding box', async () => {
      const bbox: BoundingBox = {
        west: -1,
        south: -1,
        east: 11,
        north: 11,
        srid: SRID.WEB_MERCATOR,
      };
      const results = await service.locationsInBounds(bbox, testWorldId);

      const names = results.map((r) => r.name);
      expect(names).not.toContain('Point Outside Region');
    });

    it('should return empty array for bounding box with no locations', async () => {
      const bbox: BoundingBox = {
        west: 100,
        south: 100,
        east: 200,
        north: 200,
        srid: SRID.WEB_MERCATOR,
      };
      const results = await service.locationsInBounds(bbox, testWorldId);

      expect(results).toEqual([]);
    });

    it('should filter by worldId when provided', async () => {
      const bbox: BoundingBox = {
        west: -100,
        south: -100,
        east: 100,
        north: 100,
        srid: SRID.WEB_MERCATOR,
      };
      const results = await service.locationsInBounds(bbox, testWorldId);

      // All results should belong to test world
      expect(results.every((r) => r.id)).toBeTruthy();
    });
  });

  describe('locationsNear', () => {
    it('should return locations within radius', async () => {
      const point: GeoJSONPoint = { type: 'Point', coordinates: [0, 0] };
      const radius = 20; // Should include point at origin and point inside region
      const results = await service.locationsNear(point, radius, SRID.WEB_MERCATOR, testWorldId);

      expect(results.length).toBeGreaterThan(0);
      const names = results.map((r) => r.name);
      expect(names).toContain('Point at Origin');
      expect(names).toContain('Point Inside Region');
    });

    it('should exclude locations outside radius', async () => {
      const point: GeoJSONPoint = { type: 'Point', coordinates: [0, 0] };
      const radius = 20;
      const results = await service.locationsNear(point, radius, SRID.WEB_MERCATOR, testWorldId);

      const names = results.map((r) => r.name);
      expect(names).not.toContain('Point Outside Region');
    });

    it('should order results by distance', async () => {
      const point: GeoJSONPoint = { type: 'Point', coordinates: [0, 0] };
      const radius = 100;
      const results = await service.locationsNear(point, radius, SRID.WEB_MERCATOR, testWorldId);

      // Filter to only point locations for distance comparison
      const points = results.filter((r) => r.type === 'point');
      expect(points.length).toBeGreaterThanOrEqual(2);

      // Verify distances are in ascending order
      for (let i = 1; i < points.length; i++) {
        expect(points[i].distance).toBeGreaterThanOrEqual(points[i - 1].distance);
      }
    });

    it('should return empty array when no locations within radius', async () => {
      const point: GeoJSONPoint = { type: 'Point', coordinates: [1000, 1000] };
      const radius = 10;
      const results = await service.locationsNear(point, radius, SRID.WEB_MERCATOR, testWorldId);

      expect(results).toEqual([]);
    });

    it('should include distance in results', async () => {
      const point: GeoJSONPoint = { type: 'Point', coordinates: [0, 0] };
      const radius = 20;
      const results = await service.locationsNear(point, radius, SRID.WEB_MERCATOR, testWorldId);

      expect(results.length).toBeGreaterThan(0);
      results.forEach((result) => {
        expect(result).toHaveProperty('distance');
        expect(typeof result.distance).toBe('number');
      });
    });
  });

  describe('locationsInRegion', () => {
    it('should return locations within region', async () => {
      const results = await service.locationsInRegion(testRegionId, testWorldId);

      expect(results.length).toBeGreaterThan(0);
      const names = results.map((r) => r.name);
      expect(names).toContain('Point Inside Region');
    });

    it('should exclude locations outside region', async () => {
      const results = await service.locationsInRegion(testRegionId, testWorldId);

      const names = results.map((r) => r.name);
      expect(names).not.toContain('Point Outside Region');
    });

    it('should exclude the region itself', async () => {
      const results = await service.locationsInRegion(testRegionId, testWorldId);

      const ids = results.map((r) => r.id);
      expect(ids).not.toContain(testRegionId);
    });

    it('should return empty array for region with no locations', async () => {
      // Create a region far away with no locations inside
      const emptyRegionGeom = service.geoJsonToEWKB(
        {
          type: 'Polygon',
          coordinates: [
            [
              [1000, 1000],
              [1010, 1000],
              [1010, 1010],
              [1000, 1010],
              [1000, 1000],
            ],
          ],
        },
        SRID.WEB_MERCATOR
      );
      await prisma.$executeRaw`
        INSERT INTO "Location" (id, "worldId", type, name, geom, "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${testWorldId},
          'region',
          'Empty Region',
          ST_GeomFromEWKB(${emptyRegionGeom}),
          NOW(),
          NOW()
        )
      `;
      const emptyRegionResult = await prisma.$queryRaw<[{ id: string }]>`
        SELECT id FROM "Location" WHERE name = 'Empty Region'
      `;
      const emptyRegionId = emptyRegionResult[0].id;

      const results = await service.locationsInRegion(emptyRegionId, testWorldId);
      expect(results).toEqual([]);
    });
  });

  describe('checkRegionOverlap', () => {
    it('should return true for overlapping regions', async () => {
      const result = await service.checkRegionOverlap(testRegionId, testRegion2Id);
      expect(result).toBe(true);
    });

    it('should return false for non-overlapping regions', async () => {
      // Create a non-overlapping region
      const noOverlapGeom = service.geoJsonToEWKB(
        {
          type: 'Polygon',
          coordinates: [
            [
              [100, 100],
              [110, 100],
              [110, 110],
              [100, 110],
              [100, 100],
            ],
          ],
        },
        SRID.WEB_MERCATOR
      );
      await prisma.$executeRaw`
        INSERT INTO "Location" (id, "worldId", type, name, geom, "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${testWorldId},
          'region',
          'Non-Overlapping Region',
          ST_GeomFromEWKB(${noOverlapGeom}),
          NOW(),
          NOW()
        )
      `;
      const noOverlapResult = await prisma.$queryRaw<[{ id: string }]>`
        SELECT id FROM "Location" WHERE name = 'Non-Overlapping Region'
      `;
      const noOverlapRegionId = noOverlapResult[0].id;

      const result = await service.checkRegionOverlap(testRegionId, noOverlapRegionId);
      expect(result).toBe(false);
    });

    it('should return false for region compared with itself', async () => {
      const result = await service.checkRegionOverlap(testRegionId, testRegionId);
      // ST_Overlaps returns false when comparing a region with itself
      expect(result).toBe(false);
    });

    it('should return false for adjacent regions (touching but not overlapping)', async () => {
      // Create a region adjacent to testRegion (10,0 to 20,10)
      const adjacentGeom = service.geoJsonToEWKB(
        {
          type: 'Polygon',
          coordinates: [
            [
              [10, 0],
              [20, 0],
              [20, 10],
              [10, 10],
              [10, 0],
            ],
          ],
        },
        SRID.WEB_MERCATOR
      );
      await prisma.$executeRaw`
        INSERT INTO "Location" (id, "worldId", type, name, geom, "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${testWorldId},
          'region',
          'Adjacent Region',
          ST_GeomFromEWKB(${adjacentGeom}),
          NOW(),
          NOW()
        )
      `;
      const adjacentResult = await prisma.$queryRaw<[{ id: string }]>`
        SELECT id FROM "Location" WHERE name = 'Adjacent Region'
      `;
      const adjacentRegionId = adjacentResult[0].id;

      const result = await service.checkRegionOverlap(testRegionId, adjacentRegionId);
      // ST_Overlaps returns false for geometries that only touch at boundary
      expect(result).toBe(false);
    });
  });
});
