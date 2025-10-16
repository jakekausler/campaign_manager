/**
 * Location GraphQL Type
 * Represents a location in a world with optional spatial data
 */

import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Location {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  worldId!: string;

  @Field({ description: 'Location type: point or region' })
  type!: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => ID, { nullable: true })
  parentLocationId?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  deletedAt?: Date;

  @Field({ nullable: true })
  archivedAt?: Date;
}
