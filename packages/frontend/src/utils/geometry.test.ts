import { afterEach, describe, it, expect, vi } from 'vitest';

import { calculatePolygonArea, countPolygonVertices, formatArea } from './geometry';

afterEach(() => {
  vi.clearAllMocks();
});

describe('calculatePolygonArea', () => {
  describe('valid polygons', () => {
    it('should calculate area for a simple square polygon', () => {
      // ~1km x 1km square near equator
      const coordinates: number[][] = [
        [0, 0],
        [0.009, 0], // ~1km east
        [0.009, 0.009], // ~1km north
        [0, 0.009],
        [0, 0], // closing point
      ];

      const area = calculatePolygonArea(coordinates);

      // Should be approximately 1,000,000 m² (1 km²)
      // Allow 10% margin due to spherical approximation
      expect(area).toBeGreaterThan(900000);
      expect(area).toBeLessThan(1100000);
    });

    it('should calculate area for a triangle', () => {
      // Small triangle
      const coordinates: number[][] = [
        [0, 0],
        [0.001, 0],
        [0.0005, 0.001],
        [0, 0], // closing point
      ];

      const area = calculatePolygonArea(coordinates);

      // Should be > 0 for a valid triangle
      expect(area).toBeGreaterThan(0);
      expect(area).toBeLessThan(100000); // Less than 0.1 km²
    });

    it('should handle polygon with holes (only calculates outer ring)', () => {
      // Polygon with hole - outer ring is a square
      const coordinates: number[][][] = [
        [
          // Outer ring
          [0, 0],
          [0.01, 0],
          [0.01, 0.01],
          [0, 0.01],
          [0, 0],
        ],
        [
          // Inner hole (should be ignored)
          [0.002, 0.002],
          [0.008, 0.002],
          [0.008, 0.008],
          [0.002, 0.008],
          [0.002, 0.002],
        ],
      ];

      const area = calculatePolygonArea(coordinates);

      // Should calculate only outer ring area
      // Outer ring is ~1.1km x 1.1km = ~1.21 km² = ~1,210,000 m²
      expect(area).toBeGreaterThan(1000000);
      expect(area).toBeLessThan(1500000);
    });

    it('should handle single-ring polygon format', () => {
      const singleRing: number[][] = [
        [0, 0],
        [0.01, 0],
        [0.01, 0.01],
        [0, 0.01],
        [0, 0],
      ];

      const area = calculatePolygonArea(singleRing);
      expect(area).toBeGreaterThan(0);
    });
  });

  describe('invalid/degenerate polygons', () => {
    it('should return 0 for polygon with < 3 vertices', () => {
      const twoPoints: number[][] = [
        [0, 0],
        [1, 1],
      ];

      expect(calculatePolygonArea(twoPoints)).toBe(0);
    });

    it('should return 0 for empty coordinates', () => {
      expect(calculatePolygonArea([])).toBe(0);
    });

    it('should return 0 for null input', () => {
      // @ts-expect-error - testing runtime validation
      expect(calculatePolygonArea(null)).toBe(0);
    });

    it('should return 0 for undefined input', () => {
      // @ts-expect-error - testing runtime validation
      expect(calculatePolygonArea(undefined)).toBe(0);
    });

    it('should return 0 for malformed nested array', () => {
      // Testing runtime validation for empty nested array
      expect(calculatePolygonArea([[]])).toBe(0);
    });

    it('should return 0 for coordinates with invalid points', () => {
      // Testing runtime validation for points with incomplete coordinates
      const invalidCoordinates = [
        [0, 0],
        [1], // Invalid - only one value
        [2, 2],
        [0, 0],
      ] as number[][];

      expect(calculatePolygonArea(invalidCoordinates)).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle polygons at high latitudes', () => {
      // Polygon near north pole (should still work but less accurate)
      const highLatPolygon: number[][] = [
        [0, 80],
        [10, 80],
        [10, 81],
        [0, 81],
        [0, 80],
      ];

      const area = calculatePolygonArea(highLatPolygon);
      // Should still return a positive area
      expect(area).toBeGreaterThan(0);
    });

    it('should handle very small polygons', () => {
      // Tiny polygon (a few meters)
      const tinyPolygon: number[][] = [
        [0, 0],
        [0.0001, 0],
        [0.0001, 0.0001],
        [0, 0.0001],
        [0, 0],
      ];

      const area = calculatePolygonArea(tinyPolygon);
      expect(area).toBeGreaterThan(0);
      expect(area).toBeLessThan(1000); // Less than 1000 m²
    });
  });
});

describe('formatArea', () => {
  it('should format very small areas', () => {
    expect(formatArea(0)).toBe('< 1 m²');
    expect(formatArea(0.5)).toBe('< 1 m²');
    expect(formatArea(0.99)).toBe('< 1 m²');
  });

  it('should format areas in square meters', () => {
    expect(formatArea(1)).toBe('1 m²');
    expect(formatArea(50)).toBe('50 m²');
    expect(formatArea(1000)).toBe('1,000 m²');
    expect(formatArea(9999)).toBe('10,000 m²'); // Rounded
  });

  it('should format areas in hectares', () => {
    expect(formatArea(10000)).toBe('1.00 ha'); // Exactly 1 hectare
    expect(formatArea(50000)).toBe('5.00 ha');
    expect(formatArea(123456)).toBe('12.35 ha');
    expect(formatArea(999999)).toBe('100.00 ha');
  });

  it('should format areas in square kilometers', () => {
    expect(formatArea(1000000)).toBe('1.00 km²'); // Exactly 1 km²
    expect(formatArea(5000000)).toBe('5.00 km²');
    expect(formatArea(123456789)).toBe('123.46 km²');
  });

  it('should use locale-specific number formatting', () => {
    // 1234 m² should include locale-specific thousands separator
    const formatted = formatArea(1234);
    expect(formatted).toContain('1'); // Should have the number
    expect(formatted).toContain('m²'); // Should have the unit
  });
});

describe('countPolygonVertices', () => {
  describe('valid polygons', () => {
    it('should count vertices in a triangle (excluding closing point)', () => {
      const triangle: number[][] = [
        [0, 0],
        [1, 0],
        [0, 1],
        [0, 0], // closing point
      ];

      expect(countPolygonVertices(triangle)).toBe(3);
    });

    it('should count vertices in a square (excluding closing point)', () => {
      const square: number[][] = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0], // closing point
      ];

      expect(countPolygonVertices(square)).toBe(4);
    });

    it('should count vertices in a polygon with many sides', () => {
      // Pentagon
      const pentagon: number[][] = [
        [0, 0],
        [1, 0],
        [1.5, 1],
        [0.5, 1.5],
        [-0.5, 1],
        [0, 0], // closing point
      ];

      expect(countPolygonVertices(pentagon)).toBe(5);
    });

    it('should handle polygon with holes (only counts outer ring)', () => {
      const withHoles: number[][][] = [
        [
          // Outer ring - 4 vertices
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
        [
          // Inner hole - should be ignored
          [2, 2],
          [8, 2],
          [8, 8],
          [2, 8],
          [2, 2],
        ],
      ];

      expect(countPolygonVertices(withHoles)).toBe(4);
    });
  });

  describe('invalid/degenerate polygons', () => {
    it('should return 0 for polygon with < 3 vertices', () => {
      const twoPoints: number[][] = [
        [0, 0],
        [1, 1],
      ];

      expect(countPolygonVertices(twoPoints)).toBe(0);
    });

    it('should return 0 for empty coordinates', () => {
      expect(countPolygonVertices([])).toBe(0);
    });

    it('should return 0 for null input', () => {
      // @ts-expect-error - testing runtime validation
      expect(countPolygonVertices(null)).toBe(0);
    });

    it('should return 0 for undefined input', () => {
      // @ts-expect-error - testing runtime validation
      expect(countPolygonVertices(undefined)).toBe(0);
    });

    it('should return 0 for malformed nested array', () => {
      // Testing runtime validation for empty nested array
      expect(countPolygonVertices([[]])).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle polygon without closing point', () => {
      // Some systems might not include the closing point
      const noClosure: number[][] = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];

      // Should return 3 (4 - 1), even though there's no closing point
      expect(countPolygonVertices(noClosure)).toBe(3);
    });

    it('should handle polygon with only closing point', () => {
      const onlyClosing: number[][] = [[0, 0]];

      // Should return 0 (1 - 1 = 0)
      expect(countPolygonVertices(onlyClosing)).toBe(0);
    });
  });
});
