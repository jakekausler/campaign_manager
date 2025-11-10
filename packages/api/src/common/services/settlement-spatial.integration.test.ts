import { Test, TestingModule } from '@nestjs/testing';
import { createId } from '@paralleldrive/cuid2';

import { GeoJSONPoint, SRID } from '@campaign/shared';

import { PrismaService } from '../../database/prisma.service';
import { CacheModule } from '../cache/cache.module';

import { SpatialService } from './spatial.service';

describe('SpatialService - Settlement Spatial Queries (Integration)', () => {
  let service: SpatialService;
  let prisma: PrismaService;

  // Test data IDs
  let userId: string;
  let campaignId: string;
  let worldId: string;
  let kingdomId: string;
  let regionLocationId: string;
  let settlementLocation1Id: string;
  let settlementLocation2Id: string;
  let settlementLocation3Id: string;
  let settlement1Id: string;
  let settlement2Id: string;
  let settlement3Id: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule],
      providers: [SpatialService, PrismaService],
    }).compile();

    service = module.get<SpatialService>(SpatialService);
    prisma = module.get<PrismaService>(PrismaService);

    // Create test user (needed as campaign owner)
    const user = await prisma.user.create({
      data: {
        email: 'settlement-test@example.com',
        name: 'Settlement Test User',
        password: 'not-a-real-hash',
      },
    });
    userId = user.id;

    // Create test world
    const world = await prisma.world.create({
      data: {
        name: 'Settlement Test World',
        calendars: {},
      },
    });
    worldId = world.id;

    // Create test campaign
    const campaign = await prisma.campaign.create({
      data: {
        name: 'Settlement Spatial Test Campaign',
        worldId,
        ownerId: userId,
        srid: SRID.WEB_MERCATOR,
      },
    });
    campaignId = campaign.id;

    // Create test kingdom
    const kingdom = await prisma.kingdom.create({
      data: {
        campaignId,
        name: 'Test Kingdom',
      },
    });
    kingdomId = kingdom.id;

    // Create region location (polygon covering area from 0,0 to 100,100)
    const regionGeom = service.geoJsonToEWKB(
      {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [100, 0],
            [100, 100],
            [0, 100],
            [0, 0],
          ],
        ],
      },
      SRID.WEB_MERCATOR
    );

    regionLocationId = createId();
    await prisma.$executeRaw`
      INSERT INTO "Location" (id, "worldId", name, type, geom, "createdAt", "updatedAt")
      VALUES (
        ${regionLocationId},
        ${worldId},
        'Test Region',
        'region',
        ST_GeomFromEWKB(${regionGeom}),
        NOW(),
        NOW()
      )
    `;

    // Create settlement location 1 (inside region at 25,25)
    const settlement1Geom = service.geoJsonToEWKB(
      {
        type: 'Point',
        coordinates: [25, 25],
      },
      SRID.WEB_MERCATOR
    );

    settlementLocation1Id = createId();
    await prisma.$executeRaw`
      INSERT INTO "Location" (id, "worldId", name, type, geom, "createdAt", "updatedAt")
      VALUES (
        ${settlementLocation1Id},
        ${worldId},
        'Settlement Location 1',
        'point',
        ST_GeomFromEWKB(${settlement1Geom}),
        NOW(),
        NOW()
      )
    `;

    // Create settlement location 2 (inside region at 75,75)
    const settlement2Geom = service.geoJsonToEWKB(
      {
        type: 'Point',
        coordinates: [75, 75],
      },
      SRID.WEB_MERCATOR
    );

    settlementLocation2Id = createId();
    await prisma.$executeRaw`
      INSERT INTO "Location" (id, "worldId", name, type, geom, "createdAt", "updatedAt")
      VALUES (
        ${settlementLocation2Id},
        ${worldId},
        'Settlement Location 2',
        'point',
        ST_GeomFromEWKB(${settlement2Geom}),
        NOW(),
        NOW()
      )
    `;

    // Create settlement location 3 (inside region at 50,50 - near center)
    const settlement3Geom = service.geoJsonToEWKB(
      {
        type: 'Point',
        coordinates: [50, 50],
      },
      SRID.WEB_MERCATOR
    );

    settlementLocation3Id = createId();
    await prisma.$executeRaw`
      INSERT INTO "Location" (id, "worldId", name, type, geom, "createdAt", "updatedAt")
      VALUES (
        ${settlementLocation3Id},
        ${worldId},
        'Settlement Location 3',
        'point',
        ST_GeomFromEWKB(${settlement3Geom}),
        NOW(),
        NOW()
      )
    `;

    // Create outside location (outside region at 150,150)
    const outsideGeom = service.geoJsonToEWKB(
      {
        type: 'Point',
        coordinates: [150, 150],
      },
      SRID.WEB_MERCATOR
    );

    await prisma.$executeRaw`
      INSERT INTO "Location" (id, "worldId", name, type, geom, "createdAt", "updatedAt")
      VALUES (
        ${createId()},
        ${worldId},
        'Outside Location',
        'point',
        ST_GeomFromEWKB(${outsideGeom}),
        NOW(),
        NOW()
      )
    `;

    // Outside location created but not needed for tests (verifies data setup works)

    // Create settlements
    const settlement1 = await prisma.settlement.create({
      data: {
        kingdomId,
        locationId: settlementLocation1Id,
        name: 'Settlement 1',
        level: 1,
        variables: {},
        variableSchemas: [],
      },
    });
    settlement1Id = settlement1.id;

    const settlement2 = await prisma.settlement.create({
      data: {
        kingdomId,
        locationId: settlementLocation2Id,
        name: 'Settlement 2',
        level: 2,
        variables: {},
        variableSchemas: [],
      },
    });
    settlement2Id = settlement2.id;

    const settlement3 = await prisma.settlement.create({
      data: {
        kingdomId,
        locationId: settlementLocation3Id,
        name: 'Settlement 3',
        level: 3,
        variables: {},
        variableSchemas: [],
      },
    });
    settlement3Id = settlement3.id;
  });

  afterAll(async () => {
    // Clean up test data (in reverse order of creation due to foreign keys)
    await prisma.settlement.deleteMany({
      where: { kingdomId },
    });
    await prisma.location.deleteMany({
      where: { worldId },
    });
    await prisma.kingdom.deleteMany({
      where: { id: kingdomId },
    });
    await prisma.campaign.deleteMany({
      where: { id: campaignId },
    });
    await prisma.world.deleteMany({
      where: { id: worldId },
    });
    await prisma.user.deleteMany({
      where: { id: userId },
    });

    await prisma.$disconnect();
  });

  describe('settlementsInRegion', () => {
    it('should return settlements within the region', async () => {
      const settlements = await service.settlementsInRegion(regionLocationId);

      expect(settlements).toHaveLength(3);
      expect(settlements.map((s) => s.name)).toContain('Settlement 1');
      expect(settlements.map((s) => s.name)).toContain('Settlement 2');
      expect(settlements.map((s) => s.name)).toContain('Settlement 3');
    });

    it('should exclude settlements outside the region', async () => {
      const settlements = await service.settlementsInRegion(regionLocationId);

      const settlementNames = settlements.map((s) => s.name);
      expect(settlementNames).not.toContain('Outside Settlement');
    });

    it('should respect worldId filter', async () => {
      const settlements = await service.settlementsInRegion(regionLocationId, worldId);

      expect(settlements).toHaveLength(3);
      expect(settlements.every((s) => s.kingdomId === kingdomId)).toBe(true);
    });

    it('should return empty array for region with no settlements', async () => {
      // Create a new region with no settlements
      const emptyRegionGeom = service.geoJsonToEWKB(
        {
          type: 'Polygon',
          coordinates: [
            [
              [200, 200],
              [300, 200],
              [300, 300],
              [200, 300],
              [200, 200],
            ],
          ],
        },
        SRID.WEB_MERCATOR
      );

      const emptyRegionId = createId();
      await prisma.$executeRaw`
        INSERT INTO "Location" (id, "worldId", name, type, geom, "createdAt", "updatedAt")
        VALUES (
          ${emptyRegionId},
          ${worldId},
          'Empty Region',
          'region',
          ST_GeomFromEWKB(${emptyRegionGeom}),
          NOW(),
          NOW()
        )
      `;

      const settlements = await service.settlementsInRegion(emptyRegionId);

      expect(settlements).toHaveLength(0);
    });

    it('should exclude soft-deleted settlements', async () => {
      // Soft delete Settlement 1
      await prisma.settlement.update({
        where: { id: settlement1Id },
        data: { deletedAt: new Date() },
      });

      // Clear the cache to ensure fresh query after soft delete
      await service['cache'].del(`spatial:settlements-in-region:${regionLocationId}:main`);

      const settlements = await service.settlementsInRegion(regionLocationId);

      expect(settlements).toHaveLength(2);
      expect(settlements.map((s) => s.name)).not.toContain('Settlement 1');

      // Restore Settlement 1
      await prisma.settlement.update({
        where: { id: settlement1Id },
        data: { deletedAt: null },
      });
    });
  });

  describe('settlementAtLocation', () => {
    it('should find settlement at specific location', async () => {
      const settlement = await service.settlementAtLocation(settlementLocation1Id);

      expect(settlement).not.toBeNull();
      expect(settlement?.name).toBe('Settlement 1');
      expect(settlement?.locationId).toBe(settlementLocation1Id);
    });

    it('should return null when no settlement at location', async () => {
      // Use region location which has no settlement
      const settlement = await service.settlementAtLocation(regionLocationId);

      expect(settlement).toBeNull();
    });

    it('should return null for non-existent location', async () => {
      const settlement = await service.settlementAtLocation('non-existent-id');

      expect(settlement).toBeNull();
    });

    it('should exclude soft-deleted settlements', async () => {
      // Soft delete Settlement 2
      await prisma.settlement.update({
        where: { id: settlement2Id },
        data: { deletedAt: new Date() },
      });

      const settlement = await service.settlementAtLocation(settlementLocation2Id);

      expect(settlement).toBeNull();

      // Restore Settlement 2
      await prisma.settlement.update({
        where: { id: settlement2Id },
        data: { deletedAt: null },
      });
    });
  });

  describe('settlementsNear', () => {
    it('should return settlements within radius, ordered by distance', async () => {
      const centerPoint: GeoJSONPoint = {
        type: 'Point',
        coordinates: [50, 50], // Center of region
      };

      // Search within radius of 50 (should include all 3 settlements)
      const settlements = await service.settlementsNear(centerPoint, 50, SRID.WEB_MERCATOR);

      expect(settlements.length).toBeGreaterThanOrEqual(1);
      expect(settlements.length).toBeLessThanOrEqual(3);

      // Verify ordering by distance (should be ascending)
      for (let i = 1; i < settlements.length; i++) {
        expect(settlements[i].distance).toBeGreaterThanOrEqual(settlements[i - 1].distance);
      }

      // Settlement 3 at (50,50) should be closest (distance ~0)
      expect(settlements[0].name).toBe('Settlement 3');
      expect(settlements[0].distance).toBeLessThan(1); // Should be very close to 0
    });

    it('should exclude settlements outside radius', async () => {
      const centerPoint: GeoJSONPoint = {
        type: 'Point',
        coordinates: [25, 25], // Settlement 1 location
      };

      // Very small radius (should only include Settlement 1)
      const settlements = await service.settlementsNear(centerPoint, 5, SRID.WEB_MERCATOR);

      expect(settlements).toHaveLength(1);
      expect(settlements[0].name).toBe('Settlement 1');
    });

    it('should return empty array when no settlements in radius', async () => {
      const farPoint: GeoJSONPoint = {
        type: 'Point',
        coordinates: [500, 500], // Far from all settlements
      };

      const settlements = await service.settlementsNear(farPoint, 50, SRID.WEB_MERCATOR);

      expect(settlements).toHaveLength(0);
    });

    it('should respect worldId filter', async () => {
      const centerPoint: GeoJSONPoint = {
        type: 'Point',
        coordinates: [50, 50],
      };

      const settlements = await service.settlementsNear(
        centerPoint,
        100,
        SRID.WEB_MERCATOR,
        worldId
      );

      expect(settlements.length).toBeGreaterThan(0);
      expect(settlements.every((s) => s.kingdomId === kingdomId)).toBe(true);
    });

    it('should include distance values in results', async () => {
      const centerPoint: GeoJSONPoint = {
        type: 'Point',
        coordinates: [50, 50],
      };

      const settlements = await service.settlementsNear(centerPoint, 100, SRID.WEB_MERCATOR);

      expect(settlements.length).toBeGreaterThan(0);
      settlements.forEach((settlement) => {
        expect(typeof settlement.distance).toBe('number');
        expect(settlement.distance).toBeGreaterThanOrEqual(0);
        expect(settlement.distance).toBeLessThanOrEqual(100);
      });
    });

    it('should exclude soft-deleted settlements', async () => {
      const centerPoint: GeoJSONPoint = {
        type: 'Point',
        coordinates: [50, 50],
      };

      // Soft delete Settlement 3
      await prisma.settlement.update({
        where: { id: settlement3Id },
        data: { deletedAt: new Date() },
      });

      const settlements = await service.settlementsNear(centerPoint, 100, SRID.WEB_MERCATOR);

      expect(settlements.map((s) => s.name)).not.toContain('Settlement 3');

      // Restore Settlement 3
      await prisma.settlement.update({
        where: { id: settlement3Id },
        data: { deletedAt: null },
      });
    });
  });
});
