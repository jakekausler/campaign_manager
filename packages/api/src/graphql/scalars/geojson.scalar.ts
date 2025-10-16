/**
 * GeoJSON Scalar
 * Handles GeoJSON geometry objects for spatial data
 * Used for Kingdom and Settlement location data
 */

import { Scalar, CustomScalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';

interface GeoJSONGeometry {
  type: string;
  coordinates: number[] | number[][] | number[][][] | number[][][][];
}

@Scalar('GeoJSON')
export class GeoJSONScalar implements CustomScalar<GeoJSONGeometry, GeoJSONGeometry> {
  description = 'GeoJSON geometry object (Point, LineString, Polygon, etc.)';

  // Validate GeoJSON structure
  private validateGeoJSON(value: unknown): GeoJSONGeometry {
    if (typeof value !== 'object' || value === null) {
      throw new Error('GeoJSON must be an object');
    }

    const geojson = value as Partial<GeoJSONGeometry>;

    if (!geojson.type || typeof geojson.type !== 'string') {
      throw new Error('GeoJSON must have a type property');
    }

    const validTypes = [
      'Point',
      'LineString',
      'Polygon',
      'MultiPoint',
      'MultiLineString',
      'MultiPolygon',
    ];

    if (!validTypes.includes(geojson.type)) {
      throw new Error(`Invalid GeoJSON type: ${geojson.type}`);
    }

    if (!geojson.coordinates || !Array.isArray(geojson.coordinates)) {
      throw new Error('GeoJSON must have a coordinates array');
    }

    return geojson as GeoJSONGeometry;
  }

  // Serialize GeoJSON for sending to client
  serialize(value: unknown): GeoJSONGeometry {
    return this.validateGeoJSON(value);
  }

  // Parse GeoJSON from client
  parseValue(value: unknown): GeoJSONGeometry {
    return this.validateGeoJSON(value);
  }

  // Parse AST literal to GeoJSON
  parseLiteral(ast: ValueNode): GeoJSONGeometry {
    if (ast.kind === Kind.OBJECT) {
      const obj: Record<string, unknown> = {};
      ast.fields.forEach((field) => {
        obj[field.name.value] = this.parseValueNode(field.value);
      });
      return this.validateGeoJSON(obj);
    }
    throw new Error('GeoJSON must be an object');
  }

  // Helper to parse any ValueNode
  private parseValueNode(ast: ValueNode): unknown {
    switch (ast.kind) {
      case Kind.STRING:
        return ast.value;
      case Kind.INT:
        return parseInt(ast.value, 10);
      case Kind.FLOAT:
        return parseFloat(ast.value);
      case Kind.BOOLEAN:
        return ast.value;
      case Kind.NULL:
        return null;
      case Kind.LIST:
        return ast.values.map((value) => this.parseValueNode(value));
      case Kind.OBJECT: {
        const obj: Record<string, unknown> = {};
        ast.fields.forEach((field) => {
          obj[field.name.value] = this.parseValueNode(field.value);
        });
        return obj;
      }
      default:
        return null;
    }
  }
}
