/**
 * Geometry utility functions for map drawing
 */

/**
 * Calculate the area of a polygon using the Shoelace formula
 * Returns area in square meters (approximate)
 *
 * NOTE: This is a simplified spherical approximation suitable for small to medium
 * polygons (< 100 km²). Accuracy degrades for:
 * - Large polygons spanning significant latitude ranges
 * - Polygons in high-latitude regions (> 60° N/S)
 * - Polygons crossing the antimeridian (±180° longitude)
 *
 * For production use with large or high-precision requirements, consider using
 * Turf.js area() function which implements proper geodesic calculations.
 *
 * @param coordinates - GeoJSON polygon coordinates in [longitude, latitude] format:
 *   - Single ring: [[lng1, lat1], [lng2, lat2], ...]
 *   - With holes: [[[outer ring]], [[hole1]], [[hole2]]]
 *   Only the outer ring is used for area calculation.
 * @returns Area in square meters, or 0 for invalid/degenerate polygons
 */
export function calculatePolygonArea(coordinates: number[][] | number[][][]): number {
  // Validate input structure
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
    return 0;
  }

  const firstElement = coordinates[0];
  if (!Array.isArray(firstElement) || firstElement.length === 0) {
    return 0;
  }

  // Handle polygon with holes (only calculate outer ring)
  const ring = (Array.isArray(firstElement[0]) ? coordinates[0] : coordinates) as number[][];

  // Need at least 3 vertices to form a polygon
  if (!Array.isArray(ring) || ring.length < 3) {
    return 0;
  }

  // Use Shoelace formula with Earth's radius for geodesic approximation
  const EARTH_RADIUS = 6371000; // meters

  let area = 0;
  const numPoints = ring.length;

  for (let i = 0; i < numPoints; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % numPoints];

    // Validate coordinate pairs
    if (!Array.isArray(p1) || !Array.isArray(p2) || p1.length < 2 || p2.length < 2) {
      return 0;
    }

    // Convert to radians
    const lat1 = (p1[1] * Math.PI) / 180;
    const lat2 = (p2[1] * Math.PI) / 180;
    const lng1 = (p1[0] * Math.PI) / 180;
    const lng2 = (p2[0] * Math.PI) / 180;

    // Shoelace formula for spherical coordinates
    area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  area = (area * EARTH_RADIUS * EARTH_RADIUS) / 2;
  return Math.abs(area);
}

// Area conversion constants
const SQUARE_METERS_PER_HECTARE = 10000;
const SQUARE_METERS_PER_KM2 = 1000000;

/**
 * Format area for display with appropriate units
 *
 * Automatically selects the most appropriate unit:
 * - < 1 m²: Shows "< 1 m²"
 * - < 10,000 m² (1 ha): Shows in square meters with locale formatting
 * - < 1,000,000 m² (1 km²): Shows in hectares
 * - >= 1,000,000 m²: Shows in square kilometers
 *
 * @param areaInSquareMeters - Area in square meters
 * @returns Formatted string with units
 */
export function formatArea(areaInSquareMeters: number): string {
  if (areaInSquareMeters < 1) {
    return '< 1 m²';
  }

  if (areaInSquareMeters < SQUARE_METERS_PER_HECTARE) {
    // Less than 1 hectare - show in square meters
    // Round to nearest 10 for values >= 100 to avoid excessive precision
    const rounded =
      areaInSquareMeters >= 100
        ? Math.round(areaInSquareMeters / 10) * 10
        : Math.round(areaInSquareMeters);
    return `${rounded.toLocaleString()} m²`;
  }

  if (areaInSquareMeters < SQUARE_METERS_PER_KM2) {
    // Less than 1 km² - show in hectares
    const hectares = areaInSquareMeters / SQUARE_METERS_PER_HECTARE;
    return `${hectares.toFixed(2)} ha`;
  }

  // Show in square kilometers
  const km2 = areaInSquareMeters / SQUARE_METERS_PER_KM2;
  return `${km2.toFixed(2)} km²`;
}

/**
 * Count the number of vertices in a polygon
 *
 * @param coordinates - GeoJSON polygon coordinates in [longitude, latitude] format:
 *   - Single ring: [[lng1, lat1], [lng2, lat2], ...]
 *   - With holes: [[[outer ring]], [[hole1]], [[hole2]]]
 *   Only the outer ring is counted.
 * @returns Number of vertices (excluding the closing point), or 0 for invalid polygons
 */
export function countPolygonVertices(coordinates: number[][] | number[][][]): number {
  // Validate input structure
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
    return 0;
  }

  const firstElement = coordinates[0];
  if (!Array.isArray(firstElement) || firstElement.length === 0) {
    return 0;
  }

  // Handle polygon with holes (only count outer ring)
  const ring = (Array.isArray(firstElement[0]) ? coordinates[0] : coordinates) as number[][];

  if (!Array.isArray(ring)) {
    return 0;
  }

  // GeoJSON polygons have a closing point (first point == last point)
  // We don't count the closing point as a separate vertex
  const vertexCount = ring.length - 1;

  // A valid polygon needs at least 3 vertices (4 points including the closing point)
  return vertexCount >= 3 ? vertexCount : 0;
}
