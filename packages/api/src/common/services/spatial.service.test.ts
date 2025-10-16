import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { GeoJSONPoint, GeoJSONPolygon, GeoJSONMultiPolygon, SRID } from '@campaign/shared';

import { SpatialService } from './spatial.service';

describe('SpatialService', () => {
  let service: SpatialService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SpatialService],
    }).compile();

    service = module.get<SpatialService>(SpatialService);
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
});
