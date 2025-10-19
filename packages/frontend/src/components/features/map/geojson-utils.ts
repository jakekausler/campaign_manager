import type { Point, Polygon, Position } from 'geojson';

import type {
  LocationPointFeature,
  LocationRegionFeature,
  SettlementFeature,
  StructureFeature,
  LocationPointProperties,
  LocationRegionProperties,
  SettlementProperties,
  StructureProperties,
} from './types';

/**
 * Creates a GeoJSON Point geometry from coordinates
 */
function createPoint(longitude: number, latitude: number): Point {
  return {
    type: 'Point',
    coordinates: [longitude, latitude],
  };
}

/**
 * Creates a GeoJSON Polygon geometry from coordinate rings
 * @param rings Array of coordinate rings (outer ring first, then holes)
 */
function createPolygon(rings: Position[][]): Polygon {
  return {
    type: 'Polygon',
    coordinates: rings,
  };
}

/**
 * Creates a Location point feature from location data
 */
export function createLocationPointFeature(location: {
  id: string;
  name: string;
  description?: string;
  worldId: string;
  longitude: number;
  latitude: number;
}): LocationPointFeature | null {
  // Handle missing or invalid coordinates
  if (
    typeof location.longitude !== 'number' ||
    typeof location.latitude !== 'number' ||
    !Number.isFinite(location.longitude) ||
    !Number.isFinite(location.latitude)
  ) {
    return null;
  }

  const properties: LocationPointProperties = {
    type: 'location-point',
    id: location.id,
    name: location.name,
    description: location.description,
    worldId: location.worldId,
  };

  return {
    type: 'Feature',
    geometry: createPoint(location.longitude, location.latitude),
    properties,
  };
}

/**
 * Creates a Location region feature from location data with polygon geometry
 */
export function createLocationRegionFeature(location: {
  id: string;
  name: string;
  description?: string;
  worldId: string;
  rings: Position[][];
}): LocationRegionFeature | null {
  // Handle missing or invalid polygon rings
  if (!location.rings || location.rings.length === 0) {
    return null;
  }

  // Validate that rings are properly formed
  for (const ring of location.rings) {
    if (!ring || ring.length < 3) {
      return null; // Polygon rings must have at least 3 coordinates
    }
  }

  const properties: LocationRegionProperties = {
    type: 'location-region',
    id: location.id,
    name: location.name,
    description: location.description,
    worldId: location.worldId,
  };

  return {
    type: 'Feature',
    geometry: createPolygon(location.rings),
    properties,
  };
}

/**
 * Creates a Settlement feature from settlement and location data
 */
export function createSettlementFeature(settlement: {
  id: string;
  name: string;
  level: number;
  kingdomId?: string;
  locationId: string;
  typedVariables?: Record<string, unknown>;
  location: {
    longitude: number;
    latitude: number;
  };
}): SettlementFeature | null {
  // Handle missing or invalid location coordinates
  if (
    !settlement.location ||
    typeof settlement.location.longitude !== 'number' ||
    typeof settlement.location.latitude !== 'number' ||
    !Number.isFinite(settlement.location.longitude) ||
    !Number.isFinite(settlement.location.latitude)
  ) {
    return null;
  }

  const properties: SettlementProperties = {
    type: 'settlement',
    id: settlement.id,
    name: settlement.name,
    level: settlement.level,
    kingdomId: settlement.kingdomId,
    locationId: settlement.locationId,
    typedVariables: settlement.typedVariables,
  };

  return {
    type: 'Feature',
    geometry: createPoint(settlement.location.longitude, settlement.location.latitude),
    properties,
  };
}

/**
 * Creates a Structure feature from structure and location data
 */
export function createStructureFeature(structure: {
  id: string;
  name: string;
  structureType: string;
  level: number;
  settlementId?: string;
  locationId?: string;
  typedVariables?: Record<string, unknown>;
  location: {
    longitude: number;
    latitude: number;
  };
}): StructureFeature | null {
  // Handle missing or invalid location coordinates
  if (
    !structure.location ||
    typeof structure.location.longitude !== 'number' ||
    typeof structure.location.latitude !== 'number' ||
    !Number.isFinite(structure.location.longitude) ||
    !Number.isFinite(structure.location.latitude)
  ) {
    return null;
  }

  const properties: StructureProperties = {
    type: 'structure',
    id: structure.id,
    name: structure.name,
    structureType: structure.structureType,
    level: structure.level,
    settlementId: structure.settlementId,
    locationId: structure.locationId,
    typedVariables: structure.typedVariables,
  };

  return {
    type: 'Feature',
    geometry: createPoint(structure.location.longitude, structure.location.latitude),
    properties,
  };
}

/**
 * Filters an array of features, removing null values
 */
export function filterValidFeatures<T>(features: (T | null)[]): T[] {
  return features.filter((feature): feature is T => feature !== null);
}
