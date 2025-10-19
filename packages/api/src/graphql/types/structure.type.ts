/**
 * Structure GraphQL Type
 * Represents a structure within a settlement (e.g., temple, barracks, market)
 */

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import { Settlement } from './settlement.type';
import { VariableSchemaType } from './variable-schema.types';

@ObjectType()
export class Structure {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  settlementId!: string;

  @Field(() => Settlement, { nullable: true, description: 'Settlement this structure belongs to' })
  settlement?: Settlement;

  @Field({ description: 'Structure type (e.g., temple, barracks, market, library)' })
  type!: string;

  @Field()
  name!: string;

  @Field(() => Int, { description: 'Structure level' })
  level!: number;

  @Field(() => GraphQLJSON, { description: 'Structure-level typed variables' })
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

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Computed fields from evaluated conditions',
  })
  computedFields?: Record<string, unknown>;
}
