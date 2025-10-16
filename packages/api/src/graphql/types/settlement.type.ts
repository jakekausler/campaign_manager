/**
 * Settlement GraphQL Type
 * Represents a settlement within a kingdom
 */

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

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

  @Field(() => Int)
  level!: number;

  @Field(() => GraphQLJSON, { description: 'Typed variables for this settlement' })
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
}
