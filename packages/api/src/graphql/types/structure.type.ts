/**
 * Structure GraphQL Type
 * Represents a structure within a settlement (e.g., temple, barracks, market)
 */

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class Structure {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  settlementId!: string;

  @Field({ description: 'Structure type (e.g., temple, barracks, market, library)' })
  type!: string;

  @Field()
  name!: string;

  @Field(() => Int)
  level!: number;

  @Field(() => GraphQLJSON, { description: 'Typed variables for this structure' })
  variables!: Record<string, unknown>;

  @Field(() => GraphQLJSON, {
    description: 'Variable schema definitions for validation',
  })
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
