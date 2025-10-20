/**
 * Character GraphQL Type
 * Represents a player character or NPC in a campaign
 */

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class Character {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  campaignId!: string;

  @Field(() => ID, { nullable: true })
  partyId?: string;

  @Field(() => Date)
  name!: string;

  @Field(() => Int)
  level!: number;

  @Field(() => String, { nullable: true })
  race?: string;

  @Field(() => String, { nullable: true })
  class?: string;

  @Field({ description: 'Whether this character is an NPC' })
  isNPC!: boolean;

  @Field(() => GraphQLJSON, { description: 'Character stats, inventory, and custom variables' })
  variables!: Record<string, unknown>;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => String, { nullable: true })
  deletedAt?: Date;

  @Field(() => String, { nullable: true })
  archivedAt?: Date;
}
