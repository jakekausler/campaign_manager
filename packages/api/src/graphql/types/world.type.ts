/**
 * World GraphQL Type
 * Represents a campaign world with calendar systems and settings
 */

import { ObjectType, Field, ID } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class World {
  @Field(() => ID)
  id!: string;

  @Field(() => Date)
  name!: string;

  @Field(() => GraphQLJSON, { description: 'Custom JSON schema for calendar systems' })
  calendars!: Record<string, unknown>;

  @Field(() => GraphQLJSON, { description: 'World settings and configuration' })
  settings!: Record<string, unknown>;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => String, { nullable: true })
  deletedAt?: Date;

  @Field(() => String, { nullable: true })
  archivedAt?: Date;
}
