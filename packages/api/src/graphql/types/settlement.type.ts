/**
 * Settlement GraphQL Type
 * Represents a settlement within a kingdom
 */

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import { Location } from './location.type';
import { VariableSchemaType } from './variable-schema.types';

@ObjectType()
export class Settlement {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  kingdomId!: string;

  @Field(() => ID)
  locationId!: string;

  @Field(() => Location, { description: 'The location where this settlement is placed' })
  location!: Location;

  @Field(() => Date)
  name!: string;

  @Field(() => Int, { description: 'Settlement level' })
  level!: number;

  @Field(() => GraphQLJSON, { description: 'Settlement-level typed variables' })
  variables!: Record<string, unknown>;

  @Field(() => [VariableSchemaType], { description: 'Variable schema definitions for validation' })
  variableSchemas!: VariableSchemaType[];

  @Field(() => Int, { description: 'Version for optimistic locking' })
  version!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => String, { nullable: true })
  deletedAt?: Date | null;

  @Field(() => String, { nullable: true })
  archivedAt?: Date | null;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Computed fields from evaluated conditions',
  })
  computedFields?: Record<string, unknown>;
}
