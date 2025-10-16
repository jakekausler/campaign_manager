/**
 * GeoJSON type definitions for spatial data
 * Based on RFC 7946: https://tools.ietf.org/html/rfc7946
 */
/**
 * GeoJSON Point geometry
 * Represents a single point in space
 */
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number];
}
/**
 * GeoJSON LineString geometry
 * Represents a line connecting two or more points
 */
export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: [number, number][];
}
/**
 * GeoJSON Polygon geometry
 * First array is exterior ring, subsequent arrays are holes (interior rings)
 * Each ring must be closed (first and last positions are identical)
 */
export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}
/**
 * GeoJSON MultiPoint geometry
 * Collection of points
 */
export interface GeoJSONMultiPoint {
  type: 'MultiPoint';
  coordinates: [number, number][];
}
/**
 * GeoJSON MultiLineString geometry
 * Collection of LineStrings
 */
export interface GeoJSONMultiLineString {
  type: 'MultiLineString';
  coordinates: [number, number][][];
}
/**
 * GeoJSON MultiPolygon geometry
 * Collection of Polygons
 */
export interface GeoJSONMultiPolygon {
  type: 'MultiPolygon';
  coordinates: [number, number][][][];
}
/**
 * GeoJSON GeometryCollection
 * Collection of different geometry types
 */
export interface GeoJSONGeometryCollection {
  type: 'GeometryCollection';
  geometries: GeoJSONGeometry[];
}
/**
 * Union type of all GeoJSON geometry types
 */
export type GeoJSONGeometry =
  | GeoJSONPoint
  | GeoJSONLineString
  | GeoJSONPolygon
  | GeoJSONMultiPoint
  | GeoJSONMultiLineString
  | GeoJSONMultiPolygon
  | GeoJSONGeometryCollection;
/**
 * GeoJSON Feature
 * Represents a spatially bounded entity with properties
 */
export interface GeoJSONFeature<
  G extends GeoJSONGeometry = GeoJSONGeometry,
  P = Record<string, unknown>,
> {
  type: 'Feature';
  id?: string | number;
  geometry: G;
  properties: P;
}
/**
 * GeoJSON FeatureCollection
 * Collection of Features
 */
export interface GeoJSONFeatureCollection<
  G extends GeoJSONGeometry = GeoJSONGeometry,
  P = Record<string, unknown>,
> {
  type: 'FeatureCollection';
  features: GeoJSONFeature<G, P>[];
}
/**
 * Bounding box for spatial queries
 * [west, south, east, north] or [minX, minY, maxX, maxY]
 */
export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}
/**
 * Coordinate Reference System (CRS) configuration
 */
export interface CRSConfig {
  /** SRID (Spatial Reference System Identifier) */
  srid: number;
  /** Human-readable name */
  name: string;
  /** Whether this is a fantasy/custom CRS (not real-world) */
  isCustom: boolean;
}
/**
 * Common SRID constants
 */
export declare const SRID: {
  /** WGS 84 - Standard GPS coordinates */
  readonly WGS84: 4326;
  /** Web Mercator - Used by most web maps */
  readonly WEB_MERCATOR: 3857;
};
/**
 * Validation result for geometry
 */
export interface GeometryValidationResult {
  valid: boolean;
  errors: string[];
}
//# sourceMappingURL=geojson.d.ts.map
