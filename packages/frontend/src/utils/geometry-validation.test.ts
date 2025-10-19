import { describe, it, expect } from 'vitest';

import type { DrawFeature } from '../components/features/map/DrawControl';

import {
  validatePointCoordinates,
  validatePolygonGeometry,
  validateGeometry,
} from './geometry-validation';

describe('validatePointCoordinates', () => {
  it('should pass for valid point within bounds', () => {
    const result = validatePointCoordinates([-122.4194, 37.7749]); // San Francisco
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should pass for valid point at extreme bounds', () => {
    const result = validatePointCoordinates([-180, -90]); // Min bounds
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);

    const result2 = validatePointCoordinates([180, 90]); // Max bounds
    expect(result2.isValid).toBe(true);
    expect(result2.errors).toHaveLength(0);
  });

  it('should fail for longitude out of bounds', () => {
    const result = validatePointCoordinates([181, 0]);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Longitude must be between -180 and 180 degrees');
  });

  it('should fail for latitude out of bounds', () => {
    const result = validatePointCoordinates([0, 91]);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Latitude must be between -90 and 90 degrees');
  });

  it('should fail for invalid coordinate array', () => {
    const result = validatePointCoordinates([0] as unknown as [number, number]);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Point coordinates must be [longitude, latitude]');
  });

  it('should fail for null coordinates', () => {
    const result = validatePointCoordinates(null as unknown as [number, number]);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Point coordinates must be [longitude, latitude]');
  });

  it('should fail for non-numeric coordinates', () => {
    const result = validatePointCoordinates(['a', 'b'] as unknown as [number, number]);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Point coordinates must be [longitude, latitude]');
  });
});

describe('validatePolygonGeometry', () => {
  // Helper to create a valid square polygon
  const createSquare = (size: number, lng = 0, lat = 0): number[][] => [
    [lng, lat],
    [lng + size, lat],
    [lng + size, lat + size],
    [lng, lat + size],
    [lng, lat], // Closing point
  ];

  it('should pass for valid simple polygon', () => {
    const coordinates = createSquare(0.01);
    const result = validatePolygonGeometry(coordinates);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should pass for valid polygon with holes', () => {
    const outer = createSquare(0.1);
    const hole = createSquare(0.02, 0.03, 0.03);
    const result = validatePolygonGeometry([outer, hole]);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail for polygon with < 3 vertices (not including closing point)', () => {
    const coordinates = [
      [0, 0],
      [1, 0],
      [0, 0], // Only 2 unique vertices
    ];
    const result = validatePolygonGeometry(coordinates);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Polygon must have at least 3 vertices');
  });

  it('should fail for polygon with self-intersection', () => {
    // Bowtie/figure-8 polygon
    const coordinates = [
      [0, 0],
      [1, 1],
      [1, 0],
      [0, 1],
      [0, 0], // Self-intersecting
    ];
    const result = validatePolygonGeometry(coordinates);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Polygon must not have self-intersections');
  });

  it('should fail for polygon with coordinates out of bounds', () => {
    const coordinates = [
      [0, 0],
      [181, 0], // Longitude out of bounds
      [181, 1],
      [0, 1],
      [0, 0],
    ];
    const result = validatePolygonGeometry(coordinates);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('All coordinates must be within valid bounds');
  });

  it('should fail for polygon with area too small', () => {
    // Very tiny polygon (< 1 m²)
    // Using 0.000005 degrees (~0.56m) to create a square with area < 1 m²
    const coordinates = [
      [0, 0],
      [0.000005, 0],
      [0.000005, 0.000005],
      [0, 0.000005],
      [0, 0],
    ];
    const result = validatePolygonGeometry(coordinates);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Polygon area must be at least 1 m²');
  });

  it('should fail for polygon with area too large', () => {
    // Huge polygon (> 10,000 km²)
    // Using 10 degrees (~1,111 km) to create a polygon > 10,000 km²
    // 10° x 10° ≈ 1,234,568 km² at equator
    const coordinates = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ];
    const result = validatePolygonGeometry(coordinates);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Polygon area must be less than 10,000 km²');
  });

  it('should fail for null or invalid input', () => {
    const result = validatePolygonGeometry(null as unknown as number[][]);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Polygon coordinates must be an array');
  });

  it('should fail for polygon not closed', () => {
    const coordinates = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      // Missing closing point
    ];
    const result = validatePolygonGeometry(coordinates);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Polygon must be closed (first and last points must match)');
  });

  it('should handle edge case: polygon at high latitudes', () => {
    // Valid polygon near the north pole
    const coordinates = createSquare(0.01, 0, 85);
    const result = validatePolygonGeometry(coordinates);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('validateGeometry', () => {
  it('should validate Point feature correctly', () => {
    const feature: DrawFeature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [-122.4194, 37.7749],
      },
      properties: {},
    };
    const result = validateGeometry(feature);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate Polygon feature correctly', () => {
    const feature: DrawFeature = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0.01, 0],
            [0.01, 0.01],
            [0, 0.01],
            [0, 0],
          ],
        ],
      },
      properties: {},
    };
    const result = validateGeometry(feature);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail for unsupported geometry type', () => {
    const feature: DrawFeature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
      properties: {},
    };
    const result = validateGeometry(feature);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Unsupported geometry type: LineString');
  });

  it('should fail for invalid Point', () => {
    const feature: DrawFeature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [181, 0], // Invalid longitude
      },
      properties: {},
    };
    const result = validateGeometry(feature);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should fail for invalid Polygon', () => {
    const feature: DrawFeature = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [0, 0], // Only 2 vertices
          ],
        ],
      },
      properties: {},
    };
    const result = validateGeometry(feature);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should fail for null feature', () => {
    const result = validateGeometry(null as unknown as DrawFeature);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid feature: feature is null or undefined');
  });

  it('should fail for feature without geometry', () => {
    const feature = {
      type: 'Feature',
      properties: {},
    } as unknown as DrawFeature;
    const result = validateGeometry(feature);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid feature: missing geometry');
  });

  it('should return all validation errors', () => {
    const feature: DrawFeature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [181, 91], // Both out of bounds
      },
      properties: {},
    };
    const result = validateGeometry(feature);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.errors).toContain('Longitude must be between -180 and 180 degrees');
    expect(result.errors).toContain('Latitude must be between -90 and 90 degrees');
  });
});
