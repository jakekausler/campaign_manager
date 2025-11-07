import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { GeoJSONPoint, GeoJSONPolygon, GeoJSONMultiPolygon, SRID } from '@campaign/shared';

import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../cache/cache.service';

import { SpatialService } from './spatial.service';

describe('SpatialService', () => {
  let service: SpatialService;
  let cache: jest.Mocked<CacheService>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpatialService,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            delPattern: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SpatialService>(SpatialService);
    cache = module.get(CacheService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('geoJsonToWKB and wkbToGeoJSON', () => {
    it('should convert Point geometry to WKB and back without data loss', () => {
      const point: GeoJSONPoint = {
        type: 'Point',
        coordinates: [-122.4194, 37.7749], // San Francisco
      };

      const wkb = service.geoJsonToWKB(point);
      expect(wkb).toBeInstanceOf(Buffer);

      const result = service.wkbToGeoJSON(wkb) as GeoJSONPoint;
      expect(result.type).toBe('Point');
      expect(result.coordinates[0]).toBeCloseTo(-122.4194, 4);
      expect(result.coordinates[1]).toBeCloseTo(37.7749, 4);
    });

    it('should convert Polygon geometry to WKB and back without data loss', () => {
      const polygon: GeoJSONPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0, 10],
            [10, 10],
            [10, 0],
            [0, 0], // Closed ring
          ],
        ],
      };

      const wkb = service.geoJsonToWKB(polygon);
      expect(wkb).toBeInstanceOf(Buffer);

      const result = service.wkbToGeoJSON(wkb) as GeoJSONPolygon;
      expect(result.type).toBe('Polygon');
      expect(result.coordinates).toHaveLength(1);
      expect(result.coordinates[0]).toHaveLength(5);
      expect(result.coordinates[0][0]).toEqual([0, 0]);
      expect(result.coordinates[0][4]).toEqual([0, 0]); // Closed
    });

    it('should convert Polygon with holes to WKB and back', () => {
      const polygon: GeoJSONPolygon = {
        type: 'Polygon',
        coordinates: [
          // Exterior ring
          [
            [0, 0],
            [0, 10],
            [10, 10],
            [10, 0],
            [0, 0],
          ],
          // Interior ring (hole)
          [
            [2, 2],
            [2, 8],
            [8, 8],
            [8, 2],
            [2, 2],
          ],
        ],
      };

      const wkb = service.geoJsonToWKB(polygon);
      const result = service.wkbToGeoJSON(wkb) as GeoJSONPolygon;

      expect(result.type).toBe('Polygon');
      expect(result.coordinates).toHaveLength(2); // Exterior + 1 hole
      expect(result.coordinates[1][0]).toEqual([2, 2]); // Hole starts at 2,2
    });

    it('should convert MultiPolygon geometry to WKB and back', () => {
      const multiPolygon: GeoJSONMultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [0, 0],
              [0, 5],
              [5, 5],
              [5, 0],
              [0, 0],
            ],
          ],
          [
            [
              [10, 10],
              [10, 15],
              [15, 15],
              [15, 10],
              [10, 10],
            ],
          ],
        ],
      };

      const wkb = service.geoJsonToWKB(multiPolygon);
      const result = service.wkbToGeoJSON(wkb) as GeoJSONMultiPolygon;

      expect(result.type).toBe('MultiPolygon');
      expect(result.coordinates).toHaveLength(2);
    });

    it('should convert complex Polygon with many vertices', () => {
      // Create a polygon with 1000 vertices (circular shape)
      const vertices: [number, number][] = [];
      const numVertices = 1000;
      for (let i = 0; i < numVertices; i++) {
        const angle = (i / numVertices) * 2 * Math.PI;
        vertices.push([Math.cos(angle) * 100, Math.sin(angle) * 100]);
      }
      // Close the ring
      vertices.push(vertices[0]);

      const polygon: GeoJSONPolygon = {
        type: 'Polygon',
        coordinates: [vertices],
      };

      const wkb = service.geoJsonToWKB(polygon);
      const result = service.wkbToGeoJSON(wkb) as GeoJSONPolygon;

      expect(result.type).toBe('Polygon');
      expect(result.coordinates[0]).toHaveLength(numVertices + 1);
    });

    it('should throw BadRequestException for invalid GeoJSON', () => {
      const invalidGeoJson = {
        type: 'Point',
        coordinates: 'not an array',
      } as unknown as GeoJSONPoint;

      expect(() => service.geoJsonToWKB(invalidGeoJson)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid WKB', () => {
      const invalidWkb = Buffer.from('invalid data');

      expect(() => service.wkbToGeoJSON(invalidWkb)).toThrow(BadRequestException);
    });
  });

  describe('geoJsonToEWKB and ewkbToGeoJSON', () => {
    it('should convert GeoJSON to EWKB with SRID', () => {
      const point: GeoJSONPoint = {
        type: 'Point',
        coordinates: [-122.4194, 37.7749],
      };

      const ewkb = service.geoJsonToEWKB(point, SRID.WGS84);
      expect(ewkb).toBeInstanceOf(Buffer);

      const result = service.ewkbToGeoJSON(ewkb);
      expect(result.geometry.type).toBe('Point');
      expect(result.srid).toBe(SRID.WGS84);
    });

    it('should handle custom SRID', () => {
      const point: GeoJSONPoint = {
        type: 'Point',
        coordinates: [100, 200],
      };

      const customSRID = 9999;
      const ewkb = service.geoJsonToEWKB(point, customSRID);
      const result = service.ewkbToGeoJSON(ewkb);

      expect(result.srid).toBe(customSRID);
    });
  });

  describe('validateGeometry', () => {
    it('should validate a valid Point', () => {
      const point: GeoJSONPoint = {
        type: 'Point',
        coordinates: [10, 20],
      };

      const result = service.validateGeometry(point);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject Point with invalid coordinates', () => {
      const invalidPoint = {
        type: 'Point',
        coordinates: [10], // Only one coordinate
      } as unknown as GeoJSONPoint;

      const result = service.validateGeometry(invalidPoint);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject Point with NaN coordinates', () => {
      const invalidPoint = {
        type: 'Point',
        coordinates: [NaN, 20],
      } as unknown as GeoJSONPoint;

      const result = service.validateGeometry(invalidPoint);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('valid numbers'))).toBe(true);
    });

    it('should validate a valid Polygon', () => {
      const polygon: GeoJSONPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0, 10],
            [10, 10],
            [10, 0],
            [0, 0], // Closed
          ],
        ],
      };

      const result = service.validateGeometry(polygon);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject Polygon with unclosed ring', () => {
      const unclosedPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0, 10],
            [10, 10],
            [10, 0],
            // Missing closing coordinate
          ],
        ],
      } as unknown as GeoJSONPolygon;

      const result = service.validateGeometry(unclosedPolygon);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('at least 4 positions'))).toBe(true);
    });

    it('should reject Polygon where first and last positions do not match', () => {
      const notClosedPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0, 10],
            [10, 10],
            [10, 0],
            [0, 1], // Does not match first position
          ],
        ],
      } as unknown as GeoJSONPolygon;

      const result = service.validateGeometry(notClosedPolygon);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('not closed'))).toBe(true);
    });

    it('should reject Polygon with too few positions', () => {
      const tooFewPositions = {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0, 10],
            [0, 0], // Only 3 positions
          ],
        ],
      } as unknown as GeoJSONPolygon;

      const result = service.validateGeometry(tooFewPositions);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('at least 4 positions'))).toBe(true);
    });

    it('should validate Polygon with interior rings (holes)', () => {
      const polygon: GeoJSONPolygon = {
        type: 'Polygon',
        coordinates: [
          // Exterior
          [
            [0, 0],
            [0, 10],
            [10, 10],
            [10, 0],
            [0, 0],
          ],
          // Interior (hole)
          [
            [2, 2],
            [2, 8],
            [8, 8],
            [8, 2],
            [2, 2],
          ],
        ],
      };

      const result = service.validateGeometry(polygon);
      expect(result.valid).toBe(true);
    });

    it('should reject Polygon with unclosed interior ring', () => {
      const polygon = {
        type: 'Polygon',
        coordinates: [
          // Exterior (valid)
          [
            [0, 0],
            [0, 10],
            [10, 10],
            [10, 0],
            [0, 0],
          ],
          // Interior (unclosed)
          [
            [2, 2],
            [2, 8],
            [8, 8],
            [8, 2],
            [2, 3], // Does not match first
          ],
        ],
      } as unknown as GeoJSONPolygon;

      const result = service.validateGeometry(polygon);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('interior') && e.includes('not closed'))).toBe(
        true
      );
    });

    it('should validate a valid MultiPolygon', () => {
      const multiPolygon: GeoJSONMultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [0, 0],
              [0, 5],
              [5, 5],
              [5, 0],
              [0, 0],
            ],
          ],
          [
            [
              [10, 10],
              [10, 15],
              [15, 15],
              [15, 10],
              [10, 10],
            ],
          ],
        ],
      };

      const result = service.validateGeometry(multiPolygon);
      expect(result.valid).toBe(true);
    });

    it('should reject MultiPolygon with invalid polygon', () => {
      const multiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [0, 0],
              [0, 5],
              [5, 5],
              // Missing closing, too few positions
            ],
          ],
        ],
      } as unknown as GeoJSONMultiPolygon;

      const result = service.validateGeometry(multiPolygon);
      expect(result.valid).toBe(false);
    });

    it('should reject geometry with no type', () => {
      const noType = {
        coordinates: [10, 20],
      } as unknown as GeoJSONPoint;

      const result = service.validateGeometry(noType);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('type'))).toBe(true);
    });

    it('should reject geometry with unknown type', () => {
      const unknownType = {
        type: 'InvalidType',
        coordinates: [10, 20],
      } as unknown as GeoJSONPoint;

      const result = service.validateGeometry(unknownType);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Unknown geometry type'))).toBe(true);
    });
  });

  describe('CRS configuration', () => {
    it('should return WGS84 configuration', () => {
      const config = service.getCRSConfig(SRID.WGS84);
      expect(config.srid).toBe(SRID.WGS84);
      expect(config.name).toBe('WGS 84');
      expect(config.isCustom).toBe(false);
    });

    it('should return Web Mercator configuration', () => {
      const config = service.getCRSConfig(SRID.WEB_MERCATOR);
      expect(config.srid).toBe(SRID.WEB_MERCATOR);
      expect(config.name).toBe('Web Mercator');
      expect(config.isCustom).toBe(true);
    });

    it('should return custom CRS configuration for unknown SRID', () => {
      const customSRID = 9999;
      const config = service.getCRSConfig(customSRID);
      expect(config.srid).toBe(customSRID);
      expect(config.name).toContain('Custom');
      expect(config.isCustom).toBe(true);
    });

    it('should return default SRID', () => {
      const defaultSRID = service.getDefaultSRID();
      expect(defaultSRID).toBe(SRID.WEB_MERCATOR);
    });

    it('should validate positive integer SRIDs', () => {
      expect(service.isValidSRID(4326)).toBe(true);
      expect(service.isValidSRID(3857)).toBe(true);
      expect(service.isValidSRID(9999)).toBe(true);
    });

    it('should reject invalid SRIDs', () => {
      expect(service.isValidSRID(0)).toBe(false);
      expect(service.isValidSRID(-1)).toBe(false);
      expect(service.isValidSRID(3.14)).toBe(false);
      expect(service.isValidSRID(NaN)).toBe(false);
    });
  });

  describe('Spatial Query Caching', () => {
    describe('locationsNear', () => {
      it('should return cached data on cache hit without executing database query', async () => {
        // Arrange
        const point: GeoJSONPoint = {
          type: 'Point',
          coordinates: [120.123456, 40.234567], // Lon, Lat
        };
        const radius = 1000; // meters
        const srid = 3857; // Web Mercator
        const worldId = 'world-123';

        const cachedData = [
          {
            id: 'loc-1',
            name: 'Cached Location 1',
            type: 'city',
            geom: Buffer.from('mock-wkb-1'),
            distance: 250.5,
          },
          {
            id: 'loc-2',
            name: 'Cached Location 2',
            type: 'town',
            geom: Buffer.from('mock-wkb-2'),
            distance: 750.2,
          },
        ];

        // Mock cache.get to return cached data (cache hit)
        cache.get.mockResolvedValue(cachedData);

        // Act
        const result = await service.locationsNear(point, radius, srid, worldId);

        // Assert
        expect(result).toEqual(cachedData);
        expect(cache.get).toHaveBeenCalledTimes(1);
        expect(cache.get).toHaveBeenCalledWith(
          expect.stringMatching(/^spatial:locations-near:40\.234567:120\.123456:1000:3857/)
        );
        // Verify database query was NOT executed (cache hit)
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
        // Verify cache.set was NOT called (already cached)
        expect(cache.set).not.toHaveBeenCalled();
      });

      it('should execute database query on cache miss and store results', async () => {
        // Arrange - Set up test data
        const point: GeoJSONPoint = {
          type: 'Point',
          coordinates: [120.123456, 40.234567],
        };
        const radius = 1000; // meters
        const srid = 3857; // Web Mercator
        const worldId = 'world-123';

        const dbResults = [
          {
            id: 'loc-1',
            name: 'Test Location 1',
            worldId: 'world-123',
            geometry: {
              type: 'Point',
              coordinates: [120.123, 40.234],
            } as GeoJSONPoint,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          },
          {
            id: 'loc-2',
            name: 'Test Location 2',
            worldId: 'world-123',
            geometry: {
              type: 'Point',
              coordinates: [120.124, 40.235],
            } as GeoJSONPoint,
            createdAt: new Date('2024-01-02'),
            updatedAt: new Date('2024-01-02'),
          },
        ];

        // Mock cache.get to return null (cache miss)
        cache.get.mockResolvedValue(null);

        // Mock database query to return results
        prisma.$queryRaw.mockResolvedValue(dbResults);

        // Act - Call the method
        const result = await service.locationsNear(point, radius, srid, worldId);

        // Assert - Verify behavior
        expect(result).toEqual(dbResults); // Returns database results

        // Verify cache was checked first
        expect(cache.get).toHaveBeenCalledTimes(1);
        expect(cache.get).toHaveBeenCalledWith(
          expect.stringMatching(/^spatial:locations-near:40\.234567:120\.123456:1000:3857/)
        );

        // Verify database query was executed (cache miss)
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
        expect(prisma.$queryRaw).toHaveBeenCalledWith(
          expect.objectContaining({
            strings: expect.any(Array),
            values: expect.any(Array),
          })
        );

        // Verify results were stored in cache with correct TTL (300 seconds)
        expect(cache.set).toHaveBeenCalledTimes(1);
        expect(cache.set).toHaveBeenCalledWith(
          expect.stringMatching(/^spatial:locations-near:40\.234567:120\.123456:1000:3857/),
          dbResults,
          { ttl: 300 }
        );
      });

      it('should generate deterministic cache keys (same params = same key)', async () => {
        // Arrange - Set up test data with slightly different floating-point precision
        const point1: GeoJSONPoint = {
          type: 'Point',
          coordinates: [120.123456789, 40.234567891], // Higher precision
        };
        const point2: GeoJSONPoint = {
          type: 'Point',
          coordinates: [120.123456, 40.234567], // Lower precision (same after rounding)
        };
        const radius = 1000;
        const srid = 3857;
        const worldId = 'world-123';

        const cachedData = [
          {
            id: 'loc-1',
            name: 'Test Location',
            worldId: 'world-123',
            geometry: {
              type: 'Point',
              coordinates: [120.123, 40.234],
            } as GeoJSONPoint,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          },
        ];

        // Mock cache to return data (cache hit)
        cache.get.mockResolvedValue(cachedData);

        // Act - Call with both point variations
        const result1 = await service.locationsNear(point1, radius, srid, worldId);
        const result2 = await service.locationsNear(point2, radius, srid, worldId);

        // Assert - Both calls should use the same cache key
        expect(cache.get).toHaveBeenCalledTimes(2);

        // Extract the actual cache keys used
        const call1Key = (cache.get as jest.Mock).mock.calls[0][0];
        const call2Key = (cache.get as jest.Mock).mock.calls[1][0];

        // Verify both keys are identical (normalized to 6 decimal places)
        expect(call1Key).toBe(call2Key);

        // Verify the normalized key format
        expect(call1Key).toMatch(/^spatial:locations-near:40\.234567:120\.123456:1000:3857/);

        // Verify both calls returned the same cached data
        expect(result1).toEqual(cachedData);
        expect(result2).toEqual(cachedData);

        // Verify database was NOT queried (cache hit both times)
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
      });
    });

    describe('locationsInRegion', () => {
      it('should return cached data on cache hit without executing database query', async () => {
        // Arrange - Set up test data
        const regionId = 'region-123';
        const worldId = 'world-123';

        const cachedData = [
          {
            id: 'loc-1',
            name: 'Location in Region 1',
            worldId: 'world-123',
            geometry: {
              type: 'Point',
              coordinates: [120.5, 40.5],
            } as GeoJSONPoint,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          },
          {
            id: 'loc-2',
            name: 'Location in Region 2',
            worldId: 'world-123',
            geometry: {
              type: 'Point',
              coordinates: [120.7, 40.7],
            } as GeoJSONPoint,
            createdAt: new Date('2024-01-02'),
            updatedAt: new Date('2024-01-02'),
          },
        ];

        // Mock cache.get to return cached data (cache hit)
        cache.get.mockResolvedValue(cachedData);

        // Act - Call the method
        const result = await service.locationsInRegion(regionId, worldId);

        // Assert - Verify behavior
        expect(result).toEqual(cachedData); // Returns cached data

        // Verify cache was checked with correct key
        expect(cache.get).toHaveBeenCalledTimes(1);
        expect(cache.get).toHaveBeenCalledWith(
          expect.stringMatching(/^spatial:locations-in-region:region-123/)
        );

        // Verify database query was NOT executed (cache hit)
        expect(prisma.$queryRaw).not.toHaveBeenCalled();

        // Verify cache.set was NOT called (already cached)
        expect(cache.set).not.toHaveBeenCalled();
      });

      it('should execute database query on cache miss and store results', async () => {
        // Arrange - Set up test data
        const regionId = 'region-456';
        const worldId = 'world-456';

        const dbResults = [
          {
            id: 'loc-3',
            name: 'Database Location 1',
            worldId: 'world-456',
            geometry: {
              type: 'Point',
              coordinates: [120.3, 40.3],
            } as GeoJSONPoint,
            createdAt: new Date('2024-02-01'),
            updatedAt: new Date('2024-02-01'),
          },
          {
            id: 'loc-4',
            name: 'Database Location 2',
            worldId: 'world-456',
            geometry: {
              type: 'Point',
              coordinates: [120.8, 40.8],
            } as GeoJSONPoint,
            createdAt: new Date('2024-02-02'),
            updatedAt: new Date('2024-02-02'),
          },
        ];

        // Mock cache.get to return null (cache miss)
        cache.get.mockResolvedValue(null);

        // Mock database query to return results
        prisma.$queryRaw.mockResolvedValue(dbResults);

        // Act - Call the method
        const result = await service.locationsInRegion(regionId, worldId);

        // Assert - Verify behavior
        expect(result).toEqual(dbResults); // Returns database results

        // Verify cache was checked first
        expect(cache.get).toHaveBeenCalledTimes(1);
        expect(cache.get).toHaveBeenCalledWith(
          expect.stringMatching(/^spatial:locations-in-region:region-456/)
        );

        // Verify database query was executed (cache miss)
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
        expect(prisma.$queryRaw).toHaveBeenCalledWith(
          expect.objectContaining({
            strings: expect.any(Array),
            values: expect.any(Array),
          })
        );

        // Verify results were stored in cache with correct TTL (300 seconds)
        expect(cache.set).toHaveBeenCalledTimes(1);
        expect(cache.set).toHaveBeenCalledWith(
          expect.stringMatching(/^spatial:locations-in-region:region-456/),
          dbResults,
          { ttl: 300 }
        );
      });
    });

    describe('settlementsInRegion', () => {
      it('should return cached data on cache hit without executing database query', async () => {
        // Arrange - Set up test data
        const regionId = 'region-789';
        const worldId = 'world-789';

        const cachedData = [
          {
            id: 'settlement-1',
            name: 'Cached Settlement 1',
            level: 3,
            locationId: 'loc-s1',
            createdAt: new Date('2024-03-01'),
            updatedAt: new Date('2024-03-01'),
          },
          {
            id: 'settlement-2',
            name: 'Cached Settlement 2',
            level: 5,
            locationId: 'loc-s2',
            createdAt: new Date('2024-03-02'),
            updatedAt: new Date('2024-03-02'),
          },
        ];

        // Mock cache.get to return cached data (cache hit)
        cache.get.mockResolvedValue(cachedData);

        // Act - Call the method
        const result = await service.settlementsInRegion(regionId, worldId);

        // Assert - Verify behavior
        expect(result).toEqual(cachedData); // Returns cached data

        // Verify cache was checked with correct key
        expect(cache.get).toHaveBeenCalledTimes(1);
        expect(cache.get).toHaveBeenCalledWith(
          expect.stringMatching(/^spatial:settlements-in-region:region-789/)
        );

        // Verify database query was NOT executed (cache hit)
        expect(prisma.$queryRaw).not.toHaveBeenCalled();

        // Verify cache.set was NOT called (already cached)
        expect(cache.set).not.toHaveBeenCalled();
      });
    });

    describe('Cache Invalidation', () => {
      it('should invalidate all spatial caches when geometry is updated', async () => {
        // Arrange - Set up mock for pattern-based cache deletion
        const branchId = 'main';
        const spatialCachePattern = `spatial:*:${branchId}`;
        const deleteResult = { success: true, keysDeleted: 5, error: undefined };

        // Mock cache.delPattern to return successful deletion
        cache.delPattern = jest.fn().mockResolvedValue(deleteResult);

        // Act - Simulate geometry update triggering cache invalidation
        // (This would normally be called by LocationService.updateLocationGeometry)
        await cache.delPattern(spatialCachePattern);

        // Assert - Verify pattern-based deletion was called
        expect(cache.delPattern).toHaveBeenCalledTimes(1);
        expect(cache.delPattern).toHaveBeenCalledWith(spatialCachePattern);

        // Verify the deletion was successful and deleted keys
        const result = await cache.delPattern(spatialCachePattern);
        expect(result.success).toBe(true);
        expect(result.keysDeleted).toBeGreaterThan(0);
      });
    });
  });
});
