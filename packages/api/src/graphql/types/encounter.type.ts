/**
 * Encounter GraphQL Type
 * Represents a combat encounter or challenge in a campaign
 */

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class Encounter {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  campaignId!: string;

  @Field(() => ID, { nullable: true })
  locationId?: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Int, { nullable: true, description: 'Challenge rating or difficulty' })
  difficulty?: number;

  @Field({ description: 'Whether the encounter has been resolved' })
  isResolved!: boolean;

  @Field({ nullable: true, description: 'When the encounter was resolved' })
  resolvedAt?: Date;

  @Field(() => GraphQLJSON, { description: 'Custom encounter data' })
  variables!: Record<string, unknown>;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  deletedAt?: Date;

  @Field({ nullable: true })
  archivedAt?: Date;
}
