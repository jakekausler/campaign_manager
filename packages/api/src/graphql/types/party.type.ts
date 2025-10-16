/**
 * Party GraphQL Type
 * Represents a group of characters in a campaign
 */

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class Party {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  campaignId!: string;

  @Field()
  name!: string;

  @Field(() => Int, { nullable: true, description: 'Computed average party level' })
  averageLevel?: number;

  @Field(() => Int, { nullable: true, description: 'Manual override for party level' })
  manualLevelOverride?: number;

  @Field(() => GraphQLJSON, { description: 'Party-level typed variables' })
  variables!: Record<string, unknown>;

  @Field(() => GraphQLJSON, { description: 'Variable schema definitions for validation' })
  variableSchemas!: unknown[];

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  deletedAt?: Date;

  @Field({ nullable: true })
  archivedAt?: Date;
}
