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

  @Field()
  name!: string;

  @Field(() => Int)
  level!: number;

  @Field({ nullable: true })
  race?: string;

  @Field({ nullable: true })
  class?: string;

  @Field({ description: 'Whether this character is an NPC' })
  isNPC!: boolean;

  @Field(() => GraphQLJSON, { description: 'Character stats, inventory, and custom variables' })
  variables!: Record<string, unknown>;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  deletedAt?: Date;

  @Field({ nullable: true })
  archivedAt?: Date;
}
