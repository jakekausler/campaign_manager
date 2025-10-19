/**
 * Geometry validation utilities for map drawing
 *
 * Validates point coordinates and polygon geometry to ensure data quality
 * before saving to the database.
 */

import * as turf from '@turf/turf';

import type { DrawFeature } from '../components/features/map/DrawControl';

import { calculatePolygonArea } from './geometry';
/**
 * Result of geometry validation
 */
export interface ValidationResult {
  /** Whether the geometry is valid */
  isValid: boolean;
  /** List of validation errors (empty if valid) */
  errors: string[];
}

// Coordinate bounds
const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;
const MIN_LATITUDE = -90;
const MAX_LATITUDE = 90;

// Polygon area limits (in square meters)
const MIN_POLYGON_AREA = 1; // 1 m²
const MAX_POLYGON_AREA = 10_000_000_000; // 10,000 km²

/**
 * Validate point coordinates are within valid geographic bounds
 *
 * @param coordinates - Point coordinates in [longitude, latitude] format
 * @returns ValidationResult with isValid flag and error messages
 *
 * @example
 * ```typescript
 * const result = validatePointCoordinates([-122.4194, 37.7749]);
 * if (!result.isValid) {
 *   console.error(result.errors);
 * }
 * ```
 */
export function validatePointCoordinates(coordinates: [number, number]): ValidationResult {
  const errors: string[] = [];

  // Check if coordinates is a valid array
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    errors.push('Point coordinates must be [longitude, latitude]');
    return { isValid: false, errors };
  }

  const [lng, lat] = coordinates;

  // Check if coordinates are numbers
  if (typeof lng !== 'number' || typeof lat !== 'number') {
    errors.push('Point coordinates must be [longitude, latitude]');
    return { isValid: false, errors };
  }

  // Check if coordinates are within valid bounds
  if (lng < MIN_LONGITUDE || lng > MAX_LONGITUDE) {
    errors.push('Longitude must be between -180 and 180 degrees');
  }

  if (lat < MIN_LATITUDE || lat > MAX_LATITUDE) {
    errors.push('Latitude must be between -90 and 90 degrees');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate polygon geometry for minimum vertices, self-intersections, and area limits
 *
 * @param coordinates - Polygon coordinates in GeoJSON format:
 *   - Single ring: [[lng, lat], [lng, lat], ...]
 *   - With holes: [[[outer ring]], [[hole1]], [[hole2]]]
 * @returns ValidationResult with isValid flag and error messages
 *
 * @example
 * ```typescript
 * const coordinates = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
 * const result = validatePolygonGeometry(coordinates);
 * if (!result.isValid) {
 *   console.error(result.errors);
 * }
 * ```
 */
export function validatePolygonGeometry(coordinates: number[][] | number[][][]): ValidationResult {
  const errors: string[] = [];

  // Validate input structure
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
    errors.push('Polygon coordinates must be an array');
    return { isValid: false, errors };
  }

  // Get the outer ring
  const firstElement = coordinates[0];
  if (!Array.isArray(firstElement) || firstElement.length === 0) {
    errors.push('Polygon coordinates must be an array');
    return { isValid: false, errors };
  }

  // Handle polygon with holes (only validate outer ring)
  const ring = (Array.isArray(firstElement[0]) ? coordinates[0] : coordinates) as number[][];

  if (!Array.isArray(ring)) {
    errors.push('Polygon coordinates must be an array');
    return { isValid: false, errors };
  }

  // Check if polygon is closed (first point === last point)
  if (ring.length < 4) {
    // Need at least 4 points for a closed triangle
    errors.push('Polygon must be closed (first and last points must match)');
  } else {
    const firstPoint = ring[0];
    const lastPoint = ring[ring.length - 1];
    if (
      !Array.isArray(firstPoint) ||
      !Array.isArray(lastPoint) ||
      firstPoint[0] !== lastPoint[0] ||
      firstPoint[1] !== lastPoint[1]
    ) {
      errors.push('Polygon must be closed (first and last points must match)');
    }
  }

  // Check minimum vertices (excluding closing point)
  const vertexCount = ring.length - 1;
  if (vertexCount < 3) {
    errors.push('Polygon must have at least 3 vertices');
  }

  // Validate all coordinates are within bounds
  let allCoordsValid = true;
  for (const coord of ring) {
    if (!Array.isArray(coord) || coord.length < 2) {
      allCoordsValid = false;
      break;
    }
    const [lng, lat] = coord;
    if (
      typeof lng !== 'number' ||
      typeof lat !== 'number' ||
      lng < MIN_LONGITUDE ||
      lng > MAX_LONGITUDE ||
      lat < MIN_LATITUDE ||
      lat > MAX_LATITUDE
    ) {
      allCoordsValid = false;
      break;
    }
  }

  if (!allCoordsValid) {
    errors.push('All coordinates must be within valid bounds');
  }

  // Continue validation to collect all errors (don't return early)
  // This provides better feedback to users about all issues with their polygon

  // Check for self-intersections using Turf.js (only if coords are valid)
  if (allCoordsValid) {
    try {
      const polygon = turf.polygon([ring]);
      const kinks = turf.kinks(polygon);

      if (kinks.features.length > 0) {
        errors.push('Polygon must not have self-intersections');
      }
    } catch (error) {
      // If turf fails to process, it's likely an invalid polygon
      errors.push('Polygon must not have self-intersections');
    }
  }

  // Validate area is within reasonable limits
  // We calculate area even if coords are invalid to provide comprehensive feedback
  const area = calculatePolygonArea(coordinates);

  if (area < MIN_POLYGON_AREA) {
    errors.push('Polygon area must be at least 1 m²');
  }

  if (area > MAX_POLYGON_AREA) {
    errors.push('Polygon area must be less than 10,000 km²');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a DrawFeature geometry (supports Point and Polygon)
 *
 * @param feature - DrawFeature from maplibre-gl-draw
 * @returns ValidationResult with isValid flag and error messages
 *
 * @example
 * ```typescript
 * const feature = {
 *   type: 'Feature',
 *   geometry: {
 *     type: 'Point',
 *     coordinates: [-122.4194, 37.7749]
 *   },
 *   properties: {}
 * };
 * const result = validateGeometry(feature);
 * ```
 */
export function validateGeometry(feature: DrawFeature): ValidationResult {
  const errors: string[] = [];

  // Validate feature structure
  if (!feature) {
    errors.push('Invalid feature: feature is null or undefined');
    return { isValid: false, errors };
  }

  if (!feature.geometry) {
    errors.push('Invalid feature: missing geometry');
    return { isValid: false, errors };
  }

  const { geometry } = feature;

  // Validate based on geometry type
  if (geometry.type === 'Point') {
    // Point coordinates should be [lng, lat]
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 2) {
      errors.push('Invalid Point geometry: coordinates must be [longitude, latitude]');
      return { isValid: false, errors };
    }

    return validatePointCoordinates(geometry.coordinates as [number, number]);
  } else if (geometry.type === 'Polygon') {
    // Polygon coordinates should be [[outer ring], [hole1], ...]
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
      errors.push('Invalid Polygon geometry: coordinates must be an array of rings');
      return { isValid: false, errors };
    }

    // For GeoJSON Polygon, coordinates is an array of rings
    // Pass the outer ring (first element)
    return validatePolygonGeometry(geometry.coordinates as number[][] | number[][][]);
  } else {
    errors.push(`Unsupported geometry type: ${geometry.type}`);
    return { isValid: false, errors };
  }
}
