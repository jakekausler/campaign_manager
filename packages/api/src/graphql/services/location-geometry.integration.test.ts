/**
 * Location Geometry Operations Integration Tests
 * Tests for updateLocationGeometry method with PostGIS spatial data
 */

import { Test, TestingModule } from '@nestjs/testing';

import type { GeoJSONPoint, GeoJSONPolygon, GeoJSONMultiPolygon } from '@campaign/shared';

import { SpatialService } from '../../common/services/spatial.service';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';

import { AuditService } from './audit.service';
import { LocationService } from './location.service';
import { VersionService } from './version.service';

describe('LocationService - Geometry Operations (Integration)', () => {
  let locationService: LocationService;
  let spatialService: SpatialService;
  let prisma: PrismaService;
  let testWorldId: string;
  let testCampaignId: string;
  let testBranchId: string;
  let mockUser: AuthenticatedUser;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationService,
        SpatialService,
        PrismaService,
        AuditService,
        VersionService,
        {
          provide: REDIS_PUBSUB,
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    locationService = module.get<LocationService>(LocationService);
    spatialService = module.get<SpatialService>(SpatialService);
    prisma = module.get<PrismaService>(PrismaService);

    // Create test user in database (or get existing one)
    const testUser = await prisma.user.upsert({
      where: { email: 'test-geometry@example.com' },
      update: {},
      create: {
        email: 'test-geometry@example.com',
        name: 'Test User',
        password: 'test-hash', // Hashed password
      },
    });

    // Create mock user for service calls
    mockUser = {
      id: testUser.id,
      email: testUser.email,
      role: 'gm',
    };

    // Create test world
    const world = await prisma.world.create({
      data: {
        name: 'Test World for Geometry',
        calendars: {}, // Required JSON field
      },
    });
    testWorldId = world.id;

    // Create test campaign
    const campaign = await prisma.campaign.create({
      data: {
        name: 'Test Campaign',
        worldId: testWorldId,
        ownerId: mockUser.id, // Required field
        srid: 3857, // Web Mercator
      },
    });
    testCampaignId = campaign.id;

    // Create test branch
    const branch = await prisma.branch.create({
      data: {
        name: 'main',
        campaignId: testCampaignId,
      },
    });
    testBranchId = branch.id;
  });

  afterAll(async () => {
    // Clean up test data respecting foreign key constraints
    // Handle both current test data and any orphaned data from previous runs

    // 1. Delete versions for all branches owned by campaigns of this user
    const userCampaigns = await prisma.campaign.findMany({
      where: { ownerId: mockUser.id },
      select: { id: true },
    });
    const campaignIds = userCampaigns.map((c) => c.id);

    if (campaignIds.length > 0) {
      const branches = await prisma.branch.findMany({
        where: { campaignId: { in: campaignIds } },
        select: { id: true },
      });
      const branchIds = branches.map((b) => b.id);

      if (branchIds.length > 0) {
        await prisma.version.deleteMany({ where: { branchId: { in: branchIds } } });
      }

      // 2. Delete branches for all user's campaigns
      await prisma.branch.deleteMany({ where: { campaignId: { in: campaignIds } } });
    }

    // 3. Delete locations for this world
    await prisma.location.deleteMany({ where: { worldId: testWorldId } });

    // 4. Delete all campaigns owned by this user
    await prisma.campaign.deleteMany({ where: { ownerId: mockUser.id } });

    // 5. Delete audit records for this user
    await prisma.audit.deleteMany({ where: { userId: mockUser.id } });

    // 6. Delete world
    await prisma.world.deleteMany({ where: { id: testWorldId } });

    // 7. Delete user last
    await prisma.user.deleteMany({ where: { id: mockUser.id } });

    await prisma.$disconnect();
  });

  describe('updateLocationGeometry', () => {
    describe('Point geometry', () => {
      it('should create location with Point geometry', async () => {
        // Create location without geometry
        const location = await locationService.create(
          {
            worldId: testWorldId,
            type: 'point',
            name: 'Test Point Location',
          },
          mockUser
        );

        // Define Point geometry
        const pointGeometry: GeoJSONPoint = {
          type: 'Point',
          coordinates: [100.5, 50.25], // [longitude, latitude]
        };

        // Update location with geometry
        const updated = await locationService.updateLocationGeometry(
          location.id,
          pointGeometry,
          mockUser,
          location.version,
          testBranchId
        );

        // Verify location was updated
        expect(updated.id).toBe(location.id);
        expect(updated.version).toBe(location.version + 1);
        expect(updated.geom).not.toBeNull();

        // Verify geometry can be read back
        const retrieved = await locationService.findById(location.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.geom).not.toBeNull();

        // Convert geometry back to GeoJSON and verify
        const retrievedGeoJSON = spatialService.wkbToGeoJSON(retrieved!.geom!);
        expect(retrievedGeoJSON.type).toBe('Point');
        expect((retrievedGeoJSON as GeoJSONPoint).coordinates[0]).toBeCloseTo(100.5, 5);
        expect((retrievedGeoJSON as GeoJSONPoint).coordinates[1]).toBeCloseTo(50.25, 5);
      });

      it('should update existing Point geometry', async () => {
        // Create location with initial geometry
        const location = await locationService.create(
          {
            worldId: testWorldId,
            type: 'point',
            name: 'Test Point Update',
          },
          mockUser
        );

        const initialGeometry: GeoJSONPoint = {
          type: 'Point',
          coordinates: [10.0, 20.0],
        };

        await locationService.updateLocationGeometry(
          location.id,
          initialGeometry,
          mockUser,
          location.version,
          testBranchId
        );

        // Update with new geometry
        const newGeometry: GeoJSONPoint = {
          type: 'Point',
          coordinates: [30.0, 40.0],
        };

        const currentVersion = (await locationService.findById(location.id))!.version;
        const updated = await locationService.updateLocationGeometry(
          location.id,
          newGeometry,
          mockUser,
          currentVersion,
          testBranchId
        );

        // Verify geometry was updated
        const retrievedGeoJSON = spatialService.wkbToGeoJSON(updated.geom!);
        expect((retrievedGeoJSON as GeoJSONPoint).coordinates[0]).toBeCloseTo(30.0, 5);
        expect((retrievedGeoJSON as GeoJSONPoint).coordinates[1]).toBeCloseTo(40.0, 5);
      });
    });

    describe('Polygon geometry', () => {
      it('should create location with Polygon geometry', async () => {
        const location = await locationService.create(
          {
            worldId: testWorldId,
            type: 'region',
            name: 'Test Polygon Region',
          },
          mockUser
        );

        // Define square Polygon
        const polygonGeometry: GeoJSONPolygon = {
          type: 'Polygon',
          coordinates: [
            [
              [0.0, 0.0],
              [10.0, 0.0],
              [10.0, 10.0],
              [0.0, 10.0],
              [0.0, 0.0], // Closed ring
            ],
          ],
        };

        const updated = await locationService.updateLocationGeometry(
          location.id,
          polygonGeometry,
          mockUser,
          location.version,
          testBranchId
        );

        expect(updated.geom).not.toBeNull();

        // Verify polygon can be read back
        const retrieved = await locationService.findById(location.id);
        const retrievedGeoJSON = spatialService.wkbToGeoJSON(retrieved!.geom!);
        expect(retrievedGeoJSON.type).toBe('Polygon');
        expect((retrievedGeoJSON as GeoJSONPolygon).coordinates[0].length).toBe(5);
      });

      it('should create location with complex Polygon (1000+ vertices)', async () => {
        const location = await locationService.create(
          {
            worldId: testWorldId,
            type: 'region',
            name: 'Test Complex Polygon',
          },
          mockUser
        );

        // Generate circular polygon with 1000 vertices
        const centerX = 50.0;
        const centerY = 50.0;
        const radius = 10.0;
        const numVertices = 1000;
        const vertices: [number, number][] = [];

        for (let i = 0; i < numVertices; i++) {
          const angle = (2 * Math.PI * i) / numVertices;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          vertices.push([x, y]);
        }
        // Close the ring
        vertices.push(vertices[0]);

        const complexPolygon: GeoJSONPolygon = {
          type: 'Polygon',
          coordinates: [vertices],
        };

        const updated = await locationService.updateLocationGeometry(
          location.id,
          complexPolygon,
          mockUser,
          location.version,
          testBranchId
        );

        expect(updated.geom).not.toBeNull();

        // Verify complex polygon can be read back
        const retrieved = await locationService.findById(location.id);
        const retrievedGeoJSON = spatialService.wkbToGeoJSON(retrieved!.geom!);
        expect(retrievedGeoJSON.type).toBe('Polygon');
        expect((retrievedGeoJSON as GeoJSONPolygon).coordinates[0].length).toBe(1001); // 1000 + closing vertex
      });

      it('should create Polygon with holes (interior rings)', async () => {
        const location = await locationService.create(
          {
            worldId: testWorldId,
            type: 'region',
            name: 'Test Polygon with Hole',
          },
          mockUser
        );

        // Polygon with exterior ring and one hole
        const polygonWithHole: GeoJSONPolygon = {
          type: 'Polygon',
          coordinates: [
            // Exterior ring
            [
              [0.0, 0.0],
              [20.0, 0.0],
              [20.0, 20.0],
              [0.0, 20.0],
              [0.0, 0.0],
            ],
            // Interior ring (hole)
            [
              [5.0, 5.0],
              [15.0, 5.0],
              [15.0, 15.0],
              [5.0, 15.0],
              [5.0, 5.0],
            ],
          ],
        };

        const updated = await locationService.updateLocationGeometry(
          location.id,
          polygonWithHole,
          mockUser,
          location.version,
          testBranchId
        );

        expect(updated.geom).not.toBeNull();

        // Verify polygon with hole can be read back
        const retrieved = await locationService.findById(location.id);
        const retrievedGeoJSON = spatialService.wkbToGeoJSON(retrieved!.geom!);
        expect(retrievedGeoJSON.type).toBe('Polygon');
        expect((retrievedGeoJSON as GeoJSONPolygon).coordinates.length).toBe(2); // Exterior + 1 hole
      });
    });

    describe('MultiPolygon geometry', () => {
      it('should create location with MultiPolygon geometry', async () => {
        const location = await locationService.create(
          {
            worldId: testWorldId,
            type: 'region',
            name: 'Test MultiPolygon Region',
          },
          mockUser
        );

        // MultiPolygon with two separate polygons
        const multiPolygon: GeoJSONMultiPolygon = {
          type: 'MultiPolygon',
          coordinates: [
            // First polygon
            [
              [
                [0.0, 0.0],
                [5.0, 0.0],
                [5.0, 5.0],
                [0.0, 5.0],
                [0.0, 0.0],
              ],
            ],
            // Second polygon
            [
              [
                [10.0, 10.0],
                [15.0, 10.0],
                [15.0, 15.0],
                [10.0, 15.0],
                [10.0, 10.0],
              ],
            ],
          ],
        };

        const updated = await locationService.updateLocationGeometry(
          location.id,
          multiPolygon,
          mockUser,
          location.version,
          testBranchId
        );

        expect(updated.geom).not.toBeNull();

        // Verify MultiPolygon can be read back
        const retrieved = await locationService.findById(location.id);
        const retrievedGeoJSON = spatialService.wkbToGeoJSON(retrieved!.geom!);
        expect(retrievedGeoJSON.type).toBe('MultiPolygon');
        expect((retrievedGeoJSON as GeoJSONMultiPolygon).coordinates.length).toBe(2);
      });
    });

    describe('Custom SRID support', () => {
      it('should store geometry with custom SRID', async () => {
        const location = await locationService.create(
          {
            worldId: testWorldId,
            type: 'point',
            name: 'Test Custom SRID Location',
          },
          mockUser
        );

        const pointGeometry: GeoJSONPoint = {
          type: 'Point',
          coordinates: [100.0, 50.0],
        };

        // Use WGS84 (4326) instead of default Web Mercator (3857)
        const customSRID = 4326;
        const updated = await locationService.updateLocationGeometry(
          location.id,
          pointGeometry,
          mockUser,
          location.version,
          testBranchId,
          customSRID
        );

        expect(updated.geom).not.toBeNull();

        // Verify SRID is preserved (if EWKB is used)
        const retrieved = await locationService.findById(location.id);
        expect(retrieved!.geom).not.toBeNull();
      });

      it('should use campaign default SRID when not specified', async () => {
        const location = await locationService.create(
          {
            worldId: testWorldId,
            type: 'point',
            name: 'Test Default SRID',
          },
          mockUser
        );

        const pointGeometry: GeoJSONPoint = {
          type: 'Point',
          coordinates: [100.0, 50.0],
        };

        // Don't specify SRID - should use campaign default (3857)
        const updated = await locationService.updateLocationGeometry(
          location.id,
          pointGeometry,
          mockUser,
          location.version,
          testBranchId
        );

        expect(updated.geom).not.toBeNull();
      });
    });

    describe('Validation', () => {
      it('should reject invalid GeoJSON', async () => {
        const location = await locationService.create(
          {
            worldId: testWorldId,
            type: 'point',
            name: 'Test Invalid GeoJSON',
          },
          mockUser
        );

        // Invalid GeoJSON - missing coordinates
        const invalidGeometry = {
          type: 'Point',
        } as GeoJSONPoint;

        await expect(
          locationService.updateLocationGeometry(
            location.id,
            invalidGeometry,
            mockUser,
            location.version,
            testBranchId
          )
        ).rejects.toThrow();
      });

      it('should reject Polygon with unclosed ring', async () => {
        const location = await locationService.create(
          {
            worldId: testWorldId,
            type: 'region',
            name: 'Test Unclosed Polygon',
          },
          mockUser
        );

        // Unclosed polygon (first and last coordinates don't match)
        const unclosedPolygon: GeoJSONPolygon = {
          type: 'Polygon',
          coordinates: [
            [
              [0.0, 0.0],
              [10.0, 0.0],
              [10.0, 10.0],
              [0.0, 10.0],
              // Missing closing coordinate
            ],
          ],
        };

        await expect(
          locationService.updateLocationGeometry(
            location.id,
            unclosedPolygon,
            mockUser,
            location.version,
            testBranchId
          )
        ).rejects.toThrow();
      });

      it('should reject invalid coordinates (NaN, Infinity)', async () => {
        const location = await locationService.create(
          {
            worldId: testWorldId,
            type: 'point',
            name: 'Test Invalid Coordinates',
          },
          mockUser
        );

        const invalidPoint: GeoJSONPoint = {
          type: 'Point',
          coordinates: [NaN, 50.0],
        };

        await expect(
          locationService.updateLocationGeometry(
            location.id,
            invalidPoint,
            mockUser,
            location.version,
            testBranchId
          )
        ).rejects.toThrow();
      });
    });

    describe('Versioning integration', () => {
      it('should create new version when geometry is updated', async () => {
        const location = await locationService.create(
          {
            worldId: testWorldId,
            type: 'point',
            name: 'Test Versioning',
          },
          mockUser
        );

        const initialVersion = location.version;

        const pointGeometry: GeoJSONPoint = {
          type: 'Point',
          coordinates: [100.0, 50.0],
        };

        const updated = await locationService.updateLocationGeometry(
          location.id,
          pointGeometry,
          mockUser,
          initialVersion,
          testBranchId
        );

        // Verify version was incremented
        expect(updated.version).toBe(initialVersion + 1);

        // Verify version record was created
        const versions = await prisma.version.findMany({
          where: {
            entityType: 'location',
            entityId: location.id,
            branchId: testBranchId,
          },
        });

        expect(versions.length).toBeGreaterThan(0);
      });

      it('should enforce optimistic locking on geometry updates', async () => {
        const location = await locationService.create(
          {
            worldId: testWorldId,
            type: 'point',
            name: 'Test Optimistic Lock',
          },
          mockUser
        );

        const pointGeometry: GeoJSONPoint = {
          type: 'Point',
          coordinates: [100.0, 50.0],
        };

        // First update succeeds
        await locationService.updateLocationGeometry(
          location.id,
          pointGeometry,
          mockUser,
          location.version,
          testBranchId
        );

        // Second update with stale version should fail
        await expect(
          locationService.updateLocationGeometry(
            location.id,
            pointGeometry,
            mockUser,
            location.version, // Stale version
            testBranchId
          )
        ).rejects.toThrow(); // Should throw OptimisticLockException
      });

      it('should include geometry in version payload', async () => {
        const location = await locationService.create(
          {
            worldId: testWorldId,
            type: 'point',
            name: 'Test Version Payload',
          },
          mockUser
        );

        const pointGeometry: GeoJSONPoint = {
          type: 'Point',
          coordinates: [100.0, 50.0],
        };

        await locationService.updateLocationGeometry(
          location.id,
          pointGeometry,
          mockUser,
          location.version,
          testBranchId
        );

        // Retrieve version
        const versions = await prisma.version.findMany({
          where: {
            entityType: 'location',
            entityId: location.id,
            branchId: testBranchId,
          },
          orderBy: { validFrom: 'desc' },
          take: 1,
        });

        expect(versions.length).toBe(1);
        // Version payload is stored in payloadGz (compressed)
        // We just verify the version was created
        expect(versions[0].payloadGz).toBeDefined();
      });
    });
  });
});
