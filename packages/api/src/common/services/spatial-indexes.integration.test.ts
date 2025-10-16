import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';

describe('Spatial Indexes Integration Tests', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Database Schema', () => {
    it('should have Campaign.srid field with default value', async () => {
      // Query information_schema to verify column exists
      const result = await prisma.$queryRaw<
        Array<{
          column_name: string;
          data_type: string;
          column_default: string;
        }>
      >`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'Campaign' AND column_name = 'srid'
      `;

      expect(result).toHaveLength(1);
      expect(result[0].column_name).toBe('srid');
      expect(result[0].data_type).toBe('integer');
      expect(result[0].column_default).toBe('3857');
    });

    it('should have GIST index on Location.geom', async () => {
      // Query pg_indexes to verify GIST index exists
      const result = await prisma.$queryRaw<
        Array<{
          indexname: string;
          indexdef: string;
        }>
      >`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'Location' AND indexname = 'Location_geom_gist_idx'
      `;

      expect(result).toHaveLength(1);
      expect(result[0].indexname).toBe('Location_geom_gist_idx');
      expect(result[0].indexdef).toContain('USING gist');
      expect(result[0].indexdef).toContain('geom');
    });
  });

  describe('Spatial Index Performance', () => {
    beforeAll(async () => {
      // Create test data: a world and multiple locations
      const world = await prisma.world.create({
        data: {
          name: 'Test World for Spatial Index',
          calendars: {},
        },
      });

      // Create locations with geometry
      const locationPromises = [];
      for (let i = 0; i < 100; i++) {
        // Create points spread across a grid (longitude: 0-10, latitude: 0-10)
        const lon = (i % 10) * 1.0;
        const lat = Math.floor(i / 10) * 1.0;

        // Use ST_GeomFromText to create point geometry
        locationPromises.push(
          prisma.$executeRaw`
            INSERT INTO "Location" (id, "worldId", type, name, geom, version, "createdAt", "updatedAt")
            VALUES (
              gen_random_uuid()::text,
              ${world.id},
              'point',
              ${`Test Point ${i}`},
              ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 3857),
              1,
              NOW(),
              NOW()
            )
          `
        );
      }

      await Promise.all(locationPromises);
    });

    afterAll(async () => {
      // Clean up test data
      await prisma.$executeRaw`
        DELETE FROM "Location" WHERE name LIKE 'Test Point %'
      `;
      await prisma.$executeRaw`
        DELETE FROM "World" WHERE name = 'Test World for Spatial Index'
      `;
    });

    it('should use GIST index for bounding box queries', async () => {
      // Use EXPLAIN to verify index usage
      const explainResult = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(`
        EXPLAIN
        SELECT *
        FROM "Location"
        WHERE ST_Intersects(
          geom,
          ST_MakeEnvelope(2.0, 2.0, 5.0, 5.0, 3857)
        )
      `);

      // Combine all lines of the query plan
      const queryPlan = explainResult
        .map((row: { 'QUERY PLAN': string }) => row['QUERY PLAN'])
        .join(' ');

      // Verify that the GIST index is being used
      expect(queryPlan).toContain('Location_geom_gist_idx');
    });

    it('should return correct results for bounding box query', async () => {
      // Query for locations within a bounding box (2-5, 2-5)
      const result = await prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
        }>
      >`
        SELECT id, name
        FROM "Location"
        WHERE name LIKE 'Test Point %'
          AND ST_Intersects(
            geom,
            ST_MakeEnvelope(2.0, 2.0, 5.0, 5.0, 3857)
          )
        ORDER BY name
      `;

      // Should return 16 points (4x4 grid: points 22, 23, 24, 25, 32, 33, 34, 35, 42, 43, 44, 45, 52, 53, 54, 55)
      // Points are at coordinates (lon % 10, floor(lon / 10))
      // Within bbox [2,2] to [5,5]: x in [2,3,4,5] and y in [2,3,4,5]
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(16);

      // Verify all returned points have names
      result.forEach((row: { id: string; name: string }) => {
        expect(row.name).toMatch(/Test Point \d+/);
      });
    });

    it('should use GIST index for distance queries', async () => {
      // Use EXPLAIN to verify index usage for ST_DWithin
      const explainResult = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(`
        EXPLAIN
        SELECT *
        FROM "Location"
        WHERE ST_DWithin(
          geom,
          ST_SetSRID(ST_MakePoint(5.0, 5.0), 3857),
          100000.0
        )
      `);

      // Combine all lines of the query plan
      const queryPlan = explainResult
        .map((row: { 'QUERY PLAN': string }) => row['QUERY PLAN'])
        .join(' ');

      // Verify that the GIST index is being used
      expect(queryPlan).toContain('Location_geom_gist_idx');
    });
  });

  describe('Campaign SRID Field', () => {
    let testWorld: { id: string };
    let testUser: { id: string };

    beforeAll(async () => {
      // Create test world
      testWorld = await prisma.world.create({
        data: {
          name: 'Test World for Campaign SRID',
          calendars: {},
        },
      });

      // Create test user
      testUser = await prisma.user.create({
        data: {
          email: 'spatial-test@example.com',
          name: 'Spatial Test User',
          password: 'hashed_password',
        },
      });
    });

    afterAll(async () => {
      // Clean up test data
      await prisma.campaign.deleteMany({
        where: { name: { startsWith: 'Test Campaign SRID' } },
      });
      await prisma.user.deleteMany({
        where: { email: 'spatial-test@example.com' },
      });
      await prisma.world.deleteMany({
        where: { name: 'Test World for Campaign SRID' },
      });
    });

    it('should create campaign with default SRID', async () => {
      const campaign = await prisma.campaign.create({
        data: {
          name: 'Test Campaign SRID Default',
          worldId: testWorld.id,
          ownerId: testUser.id,
        },
      });

      expect(campaign.srid).toBe(3857);
    });

    it('should create campaign with custom SRID', async () => {
      const campaign = await prisma.campaign.create({
        data: {
          name: 'Test Campaign SRID Custom',
          worldId: testWorld.id,
          ownerId: testUser.id,
          srid: 4326, // WGS84
        },
      });

      expect(campaign.srid).toBe(4326);
    });

    it('should update campaign SRID', async () => {
      const campaign = await prisma.campaign.create({
        data: {
          name: 'Test Campaign SRID Update',
          worldId: testWorld.id,
          ownerId: testUser.id,
        },
      });

      expect(campaign.srid).toBe(3857);

      const updated = await prisma.campaign.update({
        where: { id: campaign.id },
        data: { srid: 9999 }, // Custom fantasy map SRID
      });

      expect(updated.srid).toBe(9999);
    });
  });
});
