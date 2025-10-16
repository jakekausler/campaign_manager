/**
 * Kingdom GraphQL Type
 * Represents a kingdom in a campaign
 */

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import { VariableSchemaType } from './variable-schema.types';

@ObjectType()
export class Kingdom {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  campaignId!: string;

  @Field()
  name!: string;

  @Field(() => Int, { description: 'Kingdom level' })
  level!: number;

  @Field(() => GraphQLJSON, { description: 'Kingdom-level typed variables' })
  variables!: Record<string, unknown>;

  @Field(() => [VariableSchemaType], { description: 'Variable schema definitions for validation' })
  variableSchemas!: VariableSchemaType[];

  @Field(() => Int, { description: 'Version for optimistic locking' })
  version!: number;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  deletedAt?: Date | null;

  @Field({ nullable: true })
  archivedAt?: Date | null;
}
