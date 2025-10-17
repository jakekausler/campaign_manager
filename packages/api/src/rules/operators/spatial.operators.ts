/**
 * Spatial Operators
 * Custom operators for spatial queries (point-in-region, distance)
 */

import type { CustomOperator } from '../types/expression.types';

/**
 * Interface for spatial query services
 * This will be implemented by the actual SpatialService in future tickets
 */
export interface ISpatialService {
  /**
   * Check if a location is inside a region
   */
  pointInRegion(locationId: string, regionId: string): boolean;

  /**
   * Calculate distance between two locations
   */
  distanceFrom(currentLocationId: string, targetLocationId: string): number | null;
}

/**
 * Create the 'inside' operator for point-in-region queries
 *
 * Usage in JSONLogic:
 * { "inside": ["location-id", "region-id"] }
 *
 * @param spatialService - The spatial service to use for queries
 * @returns CustomOperator for 'inside'
 */
export function createInsideOperator(spatialService: ISpatialService): CustomOperator {
  return {
    name: 'inside',
    description: 'Check if a location is inside a region',
    implementation: (locationId: unknown, regionId: unknown): boolean => {
      // Validate arguments
      if (typeof locationId !== 'string' || typeof regionId !== 'string') {
        return false;
      }

      return spatialService.pointInRegion(locationId, regionId);
    },
  };
}

/**
 * Create the 'distanceFrom' operator for distance calculations
 *
 * Usage in JSONLogic:
 * { "distanceFrom": ["current-location-id", "target-location-id"] }
 *
 * @param spatialService - The spatial service to use for queries
 * @returns CustomOperator for 'distanceFrom'
 */
export function createDistanceFromOperator(spatialService: ISpatialService): CustomOperator {
  return {
    name: 'distanceFrom',
    description: 'Calculate distance between current location and target',
    implementation: (currentLocationId: unknown, targetLocationId: unknown): number | null => {
      // Validate arguments
      if (typeof currentLocationId !== 'string' || typeof targetLocationId !== 'string') {
        return null;
      }

      return spatialService.distanceFrom(currentLocationId, targetLocationId);
    },
  };
}
