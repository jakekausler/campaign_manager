/**
 * Mock Spatial Service for Testing
 * Simulates spatial queries without requiring actual PostGIS database
 */

export interface Point {
  x: number;
  y: number;
}

export interface Region {
  points: Point[];
}

/**
 * Mock spatial service with test data
 */
export class MockSpatialService {
  private readonly locations: Map<string, Point> = new Map();
  private readonly regions: Map<string, Region> = new Map();

  /**
   * Add a test location
   */
  addLocation(id: string, point: Point): void {
    this.locations.set(id, point);
  }

  /**
   * Add a test region
   */
  addRegion(id: string, region: Region): void {
    this.regions.set(id, region);
  }

  /**
   * Check if a point is inside a region
   * Uses simple rectangle bounds for testing
   */
  pointInRegion(locationId: string, regionId: string): boolean {
    const point = this.locations.get(locationId);
    const region = this.regions.get(regionId);

    if (!point || !region || region.points.length === 0) {
      return false;
    }

    // Simple bounding box check for testing
    const minX = Math.min(...region.points.map((p) => p.x));
    const maxX = Math.max(...region.points.map((p) => p.x));
    const minY = Math.min(...region.points.map((p) => p.y));
    const maxY = Math.max(...region.points.map((p) => p.y));

    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  }

  /**
   * Calculate distance between current location and target
   * Uses simple Euclidean distance for testing
   */
  distanceFrom(currentLocationId: string, targetLocationId: string): number | null {
    const current = this.locations.get(currentLocationId);
    const target = this.locations.get(targetLocationId);

    if (!current || !target) {
      return null;
    }

    const dx = target.x - current.x;
    const dy = target.y - current.y;

    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Clear all test data
   */
  clear(): void {
    this.locations.clear();
    this.regions.clear();
  }
}
