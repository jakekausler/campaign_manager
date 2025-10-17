/**
 * Spatial Resolver Integration Tests
 * Tests for spatial GraphQL queries and mutations
 */

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createId } from '@paralleldrive/cuid2';
import type { Campaign, Location as PrismaLocation, Settlement, World } from '@prisma/client';

import type { GeoJSONPoint, GeoJSONPolygon } from '@campaign/shared';

import { SpatialService } from '../../common/services/spatial.service';
import { TileCacheService } from '../../common/services/tile-cache.service';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';
import { AuditService } from '../services/audit.service';
import { CampaignContextService } from '../services/campaign-context.service';
import { KingdomService } from '../services/kingdom.service';
import { LocationService } from '../services/location.service';
import { PartyService } from '../services/party.service';
import { SettlementService } from '../services/settlement.service';
import { StructureService } from '../services/structure.service';
import { VersionService } from '../services/version.service';

import { SpatialResolver } from './spatial.resolver';

// TODO: Fix circular dependency issue causing Jest worker crashes
// These tests work individually but cause stack overflow when run with all other tests
// See: https://github.com/nestjs/nest/issues/1165
describe.skip('SpatialResolver Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let resolver: SpatialResolver;
  let spatialService: SpatialService;

  let testUser: AuthenticatedUser;
  let testCampaign: Campaign;
  let testWorld: World;
  let testBranch: { id: string; name: string };
  let testKingdom: { id: string; name: string };
  let testRegion: PrismaLocation;
  let testPointLocation1: PrismaLocation;
  let testPointLocation2: PrismaLocation;
  let testPointLocation3: PrismaLocation;
  let testSettlement1: Settlement;
  let testSettlement2: Settlement;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SpatialResolver,
        LocationService,
        SettlementService,
        SpatialService,
        TileCacheService,
        PrismaService,
        AuditService,
        CampaignContextService,
        // Add all services that CampaignContextService depends on to resolve circular dependencies
        PartyService,
        KingdomService,
        StructureService,
        VersionService,
        {
          provide: REDIS_PUBSUB,
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    resolver = moduleRef.get<SpatialResolver>(SpatialResolver);
    spatialService = moduleRef.get<SpatialService>(SpatialService);

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'spatial-test@example.com',
        name: 'Spatial Test User',
        password: 'hash',
      },
    });

    testUser = {
      id: user.id,
      email: user.email,
      role: 'owner',
    };

    // Create test world first
    testWorld = await prisma.world.create({
      data: {
        name: 'Test World',
        calendars: {},
      },
    });

    // Create test campaign
    testCampaign = await prisma.campaign.create({
      data: {
        name: 'Spatial Test Campaign',
        worldId: testWorld.id,
        ownerId: testUser.id,
        srid: 3857, // Web Mercator
      },
    });

    // Create test branch
    testBranch = await prisma.branch.create({
      data: {
        campaignId: testCampaign.id,
        name: 'main',
      },
    });

    // Create test kingdom
    testKingdom = await prisma.kingdom.create({
      data: {
        campaignId: testCampaign.id,
        name: 'Test Kingdom',
        level: 1,
      },
    });

    // Create test region (polygon covering area from 0,0 to 100,100)
    const regionPolygon: GeoJSONPolygon = {
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
    };
    const regionEwkb = spatialService.geoJsonToEWKB(regionPolygon, 3857);
    const regionId = createId();

    await prisma.$executeRaw`
      INSERT INTO "Location" (id, "worldId", type, name, geom, "createdAt", "updatedAt")
      VALUES (
        ${regionId},
        ${testWorld.id},
        'region',
        'Test Region',
        ST_GeomFromEWKB(${regionEwkb}),
        NOW(),
        NOW()
      )
    `;
    testRegion = (await prisma.location.findUnique({ where: { id: regionId } }))!;

    // Create test point locations inside the region
    const point1: GeoJSONPoint = { type: 'Point', coordinates: [10, 10] };
    const point2: GeoJSONPoint = { type: 'Point', coordinates: [20, 20] };
    const point3: GeoJSONPoint = { type: 'Point', coordinates: [200, 200] }; // Outside region

    const point1Ewkb = spatialService.geoJsonToEWKB(point1, 3857);
    const point2Ewkb = spatialService.geoJsonToEWKB(point2, 3857);
    const point3Ewkb = spatialService.geoJsonToEWKB(point3, 3857);

    const point1Id = createId();
    const point2Id = createId();
    const point3Id = createId();

    await prisma.$executeRaw`
      INSERT INTO "Location" (id, "worldId", type, name, geom, "createdAt", "updatedAt")
      VALUES (
        ${point1Id},
        ${testWorld.id},
        'point',
        'Point Location 1',
        ST_GeomFromEWKB(${point1Ewkb}),
        NOW(),
        NOW()
      )
    `;
    testPointLocation1 = (await prisma.location.findUnique({ where: { id: point1Id } }))!;

    await prisma.$executeRaw`
      INSERT INTO "Location" (id, "worldId", type, name, geom, "createdAt", "updatedAt")
      VALUES (
        ${point2Id},
        ${testWorld.id},
        'point',
        'Point Location 2',
        ST_GeomFromEWKB(${point2Ewkb}),
        NOW(),
        NOW()
      )
    `;
    testPointLocation2 = (await prisma.location.findUnique({ where: { id: point2Id } }))!;

    await prisma.$executeRaw`
      INSERT INTO "Location" (id, "worldId", type, name, geom, "createdAt", "updatedAt")
      VALUES (
        ${point3Id},
        ${testWorld.id},
        'point',
        'Point Location 3',
        ST_GeomFromEWKB(${point3Ewkb}),
        NOW(),
        NOW()
      )
    `;
    testPointLocation3 = (await prisma.location.findUnique({ where: { id: point3Id } }))!;

    // Create test settlements
    testSettlement1 = await prisma.settlement.create({
      data: {
        kingdomId: testKingdom.id,
        locationId: testPointLocation1.id,
        name: 'Settlement 1',
        level: 1,
      },
    });

    testSettlement2 = await prisma.settlement.create({
      data: {
        kingdomId: testKingdom.id,
        locationId: testPointLocation2.id,
        name: 'Settlement 2',
        level: 2,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data respecting foreign key constraints
    // 1. Delete versions for branches in this campaign
    const branches = await prisma.branch.findMany({
      where: { campaignId: testCampaign.id },
      select: { id: true },
    });
    const branchIds = branches.map((b) => b.id);
    if (branchIds.length > 0) {
      await prisma.version.deleteMany({ where: { branchId: { in: branchIds } } });
    }

    // 2. Delete branches
    await prisma.branch.deleteMany({ where: { campaignId: testCampaign.id } });

    // 3. Delete settlements
    await prisma.settlement.deleteMany({ where: { kingdomId: testKingdom.id } });

    // 4. Delete locations
    await prisma.location.deleteMany({ where: { worldId: testWorld.id } });

    // 5. Delete kingdom
    await prisma.kingdom.deleteMany({ where: { id: testKingdom.id } });

    // 6. Delete campaign
    await prisma.campaign.deleteMany({ where: { id: testCampaign.id } });

    // 7. Delete audit records
    await prisma.audit.deleteMany({ where: { userId: testUser.id } });

    // 8. Delete world
    await prisma.world.deleteMany({ where: { id: testWorld.id } });

    // 9. Delete user last
    await prisma.user.deleteMany({ where: { id: testUser.id } });

    await prisma.$disconnect();
    await app.close();
  });

  describe('mapLayer Query', () => {
    it('should return GeoJSON FeatureCollection for bounding box', async () => {
      const result = await resolver.mapLayer(
        testWorld.id,
        { west: -10, south: -10, east: 110, north: 110 },
        null,
        testUser
      );

      expect(result.type).toBe('FeatureCollection');
      expect(result.features.length).toBeGreaterThanOrEqual(3); // Region + 2 points inside
      expect(result.features[0].type).toBe('Feature');
      expect(result.features[0].geometry).toHaveProperty('type');
      expect(result.features[0].properties).toHaveProperty('name');
    });

    it('should include settlement data in feature properties', async () => {
      const result = await resolver.mapLayer(
        testWorld.id,
        { west: 5, south: 5, east: 15, north: 15 },
        null,
        testUser
      );

      const featureWithSettlement = result.features.find((f) => f.id === testPointLocation1.id);
      expect(featureWithSettlement).toBeDefined();
      expect(featureWithSettlement?.properties.settlement).toBeDefined();
      expect(featureWithSettlement?.properties.settlement).toMatchObject({
        id: testSettlement1.id,
        name: 'Settlement 1',
      });
    });

    it('should filter by location types', async () => {
      const result = await resolver.mapLayer(
        testWorld.id,
        { west: -10, south: -10, east: 110, north: 110 },
        { locationTypes: ['point'] },
        testUser
      );

      expect(result.features.every((f) => f.properties.type === 'point')).toBe(true);
    });
  });

  describe('updateLocationGeometry Mutation', () => {
    it('should update location geometry', async () => {
      const newPoint: GeoJSONPoint = { type: 'Point', coordinates: [30, 30] };

      const result = await resolver.updateLocationGeometry(
        testPointLocation1.id,
        {
          geoJson: newPoint,
          srid: 3857,
          branchId: testBranch.id,
          expectedVersion: 1,
        },
        testUser
      );

      expect(result.id).toBe(testPointLocation1.id);
      expect(result.name).toBe('Point Location 1');
      // Version field is internal and not exposed in GraphQL type
    });
  });

  describe('locationsNear Query', () => {
    it('should find locations within radius', async () => {
      const result = await resolver.locationsNear(
        {
          point: { longitude: 10, latitude: 10 },
          radius: 50000, // 50km in meters
          srid: 3857,
          worldId: testWorld.id,
        },
        testUser
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]).toHaveProperty('distance');
      expect(result[0].distance).toBeLessThan(50000);
    });

    it('should order results by distance', async () => {
      const result = await resolver.locationsNear(
        {
          point: { longitude: 10, latitude: 10 },
          radius: 100000,
          srid: 3857,
          worldId: testWorld.id,
        },
        testUser
      );

      for (let i = 1; i < result.length; i++) {
        expect(result[i].distance).toBeGreaterThanOrEqual(result[i - 1].distance);
      }
    });
  });

  describe('locationsInRegion Query', () => {
    it('should find all locations within region', async () => {
      const result = await resolver.locationsInRegion(testRegion.id, testWorld.id, testUser);

      expect(result.length).toBeGreaterThanOrEqual(2); // At least 2 points inside
      expect(result.some((loc) => loc.id === testPointLocation1.id)).toBe(true);
      expect(result.some((loc) => loc.id === testPointLocation2.id)).toBe(true);
    });

    it('should exclude locations outside region', async () => {
      const result = await resolver.locationsInRegion(testRegion.id, testWorld.id, testUser);

      expect(result.some((loc) => loc.id === testPointLocation3.id)).toBe(false);
    });
  });

  describe('checkRegionOverlap Query', () => {
    it('should detect non-overlapping regions', async () => {
      // Create a second non-overlapping region
      const region2Polygon: GeoJSONPolygon = {
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
      };
      const region2Ewkb = spatialService.geoJsonToEWKB(region2Polygon, 3857);
      const region2Id = createId();

      await prisma.$executeRaw`
        INSERT INTO "Location" (id, "worldId", type, name, geom, "createdAt", "updatedAt")
        VALUES (
          ${region2Id},
          ${testWorld.id},
          'region',
          'Test Region 2',
          ST_GeomFromEWKB(${region2Ewkb}),
          NOW(),
          NOW()
        )
      `;
      const region2 = (await prisma.location.findUnique({ where: { id: region2Id } }))!;

      const result = await resolver.checkRegionOverlap(testRegion.id, region2.id, testUser);

      expect(result.overlaps).toBe(false);
      expect(result.region1Id).toBe(testRegion.id);
      expect(result.region2Id).toBe(region2.id);

      // Clean up
      await prisma.location.delete({ where: { id: region2.id } });
    });
  });

  describe('settlementsInRegion Query', () => {
    it('should find all settlements within region', async () => {
      const result = await resolver.settlementsInRegion(testRegion.id, testWorld.id, testUser);

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.some((s) => s.id === testSettlement1.id)).toBe(true);
      expect(result.some((s) => s.id === testSettlement2.id)).toBe(true);
    });
  });

  describe('settlementAtLocation Query', () => {
    it('should find settlement at specific location', async () => {
      const result = await resolver.settlementAtLocation(testPointLocation1.id, testUser);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(testSettlement1.id);
      expect(result?.name).toBe('Settlement 1');
    });

    it('should return null when no settlement at location', async () => {
      const result = await resolver.settlementAtLocation(testPointLocation3.id, testUser);

      expect(result).toBeNull();
    });
  });

  describe('settlementsNear Query', () => {
    it('should find settlements within radius', async () => {
      const result = await resolver.settlementsNear(
        {
          point: { longitude: 10, latitude: 10 },
          radius: 50000,
          srid: 3857,
          worldId: testWorld.id,
        },
        testUser
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]).toHaveProperty('distance');
      expect(result[0].distance).toBeLessThan(50000);
    });

    it('should order settlements by distance', async () => {
      const result = await resolver.settlementsNear(
        {
          point: { longitude: 10, latitude: 10 },
          radius: 100000,
          srid: 3857,
          worldId: testWorld.id,
        },
        testUser
      );

      for (let i = 1; i < result.length; i++) {
        expect(result[i].distance).toBeGreaterThanOrEqual(result[i - 1].distance);
      }
    });
  });
});
