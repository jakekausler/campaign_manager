/**
 * Settlement GraphQL Type
 * Represents a settlement within a kingdom
 */

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import { VariableSchemaType } from './variable-schema.types';

@ObjectType()
export class Settlement {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  kingdomId!: string;

  @Field(() => ID)
  locationId!: string;

  @Field()
  name!: string;

  @Field(() => Int, { description: 'Settlement level' })
  level!: number;

  @Field(() => GraphQLJSON, { description: 'Settlement-level typed variables' })
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
