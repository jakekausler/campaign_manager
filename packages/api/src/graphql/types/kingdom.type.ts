/**
 * Kingdom GraphQL Type
 * Represents a kingdom in a campaign
 */

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class Kingdom {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  campaignId!: string;

  @Field()
  name!: string;

  @Field(() => Int)
  level!: number;

  @Field(() => GraphQLJSON, { description: 'Kingdom-level typed variables' })
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
