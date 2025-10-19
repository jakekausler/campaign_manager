import type { Feature, Point, Polygon } from 'geojson';

/**
 * Entity types that can be displayed on the map
 */
export type EntityType = 'location-point' | 'location-region' | 'settlement' | 'structure';

/**
 * Base properties for all map features
 */
export interface BaseFeatureProperties {
  /** Entity type */
  type: EntityType;
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
}

/**
 * Properties for Location point features
 */
export interface LocationPointProperties extends BaseFeatureProperties {
  type: 'location-point';
  /** Optional description */
  description?: string;
  /** World ID this location belongs to */
  worldId: string;
}

/**
 * Properties for Location region features (polygons)
 */
export interface LocationRegionProperties extends BaseFeatureProperties {
  type: 'location-region';
  /** Optional description */
  description?: string;
  /** World ID this location belongs to */
  worldId: string;
}

/**
 * Properties for Settlement features
 */
export interface SettlementProperties extends BaseFeatureProperties {
  type: 'settlement';
  /** Settlement level */
  level: number;
  /** Kingdom ID (optional) */
  kingdomId?: string;
  /** Location ID where settlement is positioned */
  locationId: string;
  /** Typed variables (key-value pairs) */
  typedVariables?: Record<string, unknown>;
}

/**
 * Properties for Structure features
 */
export interface StructureProperties extends BaseFeatureProperties {
  type: 'structure';
  /** Structure type identifier */
  structureType: string;
  /** Structure level */
  level: number;
  /** Settlement ID (optional) */
  settlementId?: string;
  /** Location ID (optional, if structure has independent location) */
  locationId?: string;
  /** Typed variables (key-value pairs) */
  typedVariables?: Record<string, unknown>;
}

/**
 * Union type for all feature properties
 */
export type MapFeatureProperties =
  | LocationPointProperties
  | LocationRegionProperties
  | SettlementProperties
  | StructureProperties;

/**
 * GeoJSON Feature for Location points
 */
export type LocationPointFeature = Feature<Point, LocationPointProperties>;

/**
 * GeoJSON Feature for Location regions
 */
export type LocationRegionFeature = Feature<Polygon, LocationRegionProperties>;

/**
 * GeoJSON Feature for Settlements
 */
export type SettlementFeature = Feature<Point, SettlementProperties>;

/**
 * GeoJSON Feature for Structures
 */
export type StructureFeature = Feature<Point, StructureProperties>;

/**
 * Union type for all map features
 */
export type MapFeature =
  | LocationPointFeature
  | LocationRegionFeature
  | SettlementFeature
  | StructureFeature;

/**
 * Map layer configuration
 */
export interface LayerConfig {
  /** Unique layer ID */
  id: string;
  /** Layer type */
  type: EntityType;
  /** Whether layer is currently visible */
  visible: boolean;
  /** GeoJSON source ID */
  sourceId: string;
}

/**
 * Layer visibility state
 */
export interface LayerVisibility {
  'location-point': boolean;
  'location-region': boolean;
  settlement: boolean;
  structure: boolean;
}
