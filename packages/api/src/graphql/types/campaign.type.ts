/**
 * Campaign GraphQL Type
 * Represents a campaign within a world
 */

import { ObjectType, Field, ID } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class Campaign {
  @Field(() => ID)
  id!: string;

  @Field(() => Date)
  name!: string;

  @Field(() => ID)
  worldId!: string;

  @Field(() => ID)
  ownerId!: string;

  @Field(() => GraphQLJSON, { description: 'Campaign settings and configuration' })
  settings!: Record<string, unknown>;

  @Field({ description: 'Whether the campaign is currently active' })
  isActive!: boolean;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => String, { nullable: true })
  deletedAt?: Date;

  @Field(() => String, { nullable: true })
  archivedAt?: Date;

  @Field(() => String, { nullable: true, description: 'Current world time for this campaign' })
  currentWorldTime?: Date;
}
