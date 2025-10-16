/**
 * Spatial GraphQL Types
 * Output types for spatial queries and map layers
 */

import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

import { GeoJSONScalar } from '../scalars/geojson.scalar';
import { JSONScalar } from '../scalars/json.scalar';

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

  @Field(() => JSONScalar, { description: 'Feature properties with entity metadata' })
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

  @Field()
  type!: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => ID, { nullable: true })
  parentLocationId?: string;

  @Field(() => Float, { description: 'Distance in meters from query point' })
  distance!: number;

  @Field()
  createdAt!: Date;

  @Field()
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

  @Field({ nullable: true })
  name?: string;

  @Field(() => ID, { nullable: true })
  kingdomId?: string;

  @Field(() => String, { nullable: true })
  level?: string;

  @Field(() => Float, { description: 'Distance in meters from query point' })
  distance!: number;

  @Field()
  createdAt!: Date;

  @Field()
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
