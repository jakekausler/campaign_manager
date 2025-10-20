/**
 * Location GraphQL Type
 * Represents a location in a world with optional spatial data
 */

import { ObjectType, Field, ID } from '@nestjs/graphql';

import { GeoJSONScalar } from '../scalars/geojson.scalar';

@ObjectType()
export class Location {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  worldId!: string;

  @Field(() => String, { description: 'Location type: point or region' })
  type!: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => ID, { nullable: true })
  parentLocationId?: string;

  @Field(() => GeoJSONScalar, {
    nullable: true,
    description: 'GeoJSON geometry representation',
  })
  geojson?: unknown;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => String, { nullable: true })
  deletedAt?: Date;

  @Field(() => String, { nullable: true })
  archivedAt?: Date;
}
