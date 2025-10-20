/**
 * Spatial GraphQL Types
 * Output types for spatial queries and map layers
 */

import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import { GeoJSONScalar } from '../scalars/geojson.scalar';

/**
 * GeoJSON Feature for map layers
 */
@ObjectType()
export class GeoJSONFeature {
  @Field(() => String)
  type!: 'Feature'; // GeoJSON spec literal type

  @Field(() => ID)
  id!: string;

  @Field(() => GeoJSONScalar, { description: 'GeoJSON geometry' })
  geometry!: unknown; // Using unknown to accept any GeoJSON geometry type

  @Field(() => GraphQLJSON, { description: 'Feature properties with entity metadata' })
  properties!: Record<string, unknown>;
}

/**
 * GeoJSON FeatureCollection for map layers
 */
@ObjectType()
export class GeoJSONFeatureCollection {
  @Field(() => String)
  type!: 'FeatureCollection'; // GeoJSON spec literal type

  @Field(() => [GeoJSONFeature])
  features!: GeoJSONFeature[];
}

/**
 * Location with distance from query point
 */
@ObjectType()
export class LocationWithDistance {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  worldId!: string;

  @Field(() => Date)
  type!: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => ID, { nullable: true })
  parentLocationId?: string;

  @Field(() => Float, { description: 'Distance in meters from query point' })
  distance!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

/**
 * Settlement with distance from query point
 */
@ObjectType()
export class SettlementWithDistance {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  locationId!: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => ID, { nullable: true })
  kingdomId?: string;

  @Field(() => String, { nullable: true })
  level?: string;

  @Field(() => Float, { description: 'Distance in meters from query point' })
  distance!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

/**
 * Region overlap check result
 */
@ObjectType()
export class RegionOverlapResult {
  @Field(() => Boolean, { description: 'Whether the regions overlap' })
  overlaps!: boolean;

  @Field(() => ID)
  region1Id!: string;

  @Field(() => ID)
  region2Id!: string;
}
