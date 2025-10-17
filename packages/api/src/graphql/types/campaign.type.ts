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

  @Field()
  name!: string;

  @Field(() => ID)
  worldId!: string;

  @Field(() => ID)
  ownerId!: string;

  @Field(() => GraphQLJSON, { description: 'Campaign settings and configuration' })
  settings!: Record<string, unknown>;

  @Field({ description: 'Whether the campaign is currently active' })
  isActive!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  deletedAt?: Date;

  @Field({ nullable: true })
  archivedAt?: Date;

  @Field({ nullable: true, description: 'Current world time for this campaign' })
  currentWorldTime?: Date;
}
