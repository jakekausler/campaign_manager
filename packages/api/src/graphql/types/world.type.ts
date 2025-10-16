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

  @Field()
  name!: string;

  @Field(() => GraphQLJSON, { description: 'Custom JSON schema for calendar systems' })
  calendars!: Record<string, unknown>;

  @Field(() => GraphQLJSON, { description: 'World settings and configuration' })
  settings!: Record<string, unknown>;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  deletedAt?: Date;

  @Field({ nullable: true })
  archivedAt?: Date;
}
