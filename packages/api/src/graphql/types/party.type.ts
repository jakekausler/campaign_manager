/**
 * Party GraphQL Type
 * Represents a group of characters in a campaign
 */

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import { VariableSchemaType } from './variable-schema.types';

@ObjectType()
export class Party {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  campaignId!: string;

  @Field()
  name!: string;

  @Field(() => Int, { nullable: true, description: 'Computed average party level' })
  averageLevel?: number | null;

  @Field(() => Int, { nullable: true, description: 'Manual override for party level' })
  manualLevelOverride?: number | null;

  @Field(() => GraphQLJSON, { description: 'Party-level typed variables' })
  variables!: Record<string, unknown>;

  @Field(() => [VariableSchemaType], { description: 'Variable schema definitions for validation' })
  variableSchemas!: VariableSchemaType[];

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  deletedAt?: Date | null;

  @Field({ nullable: true })
  archivedAt?: Date | null;
}
