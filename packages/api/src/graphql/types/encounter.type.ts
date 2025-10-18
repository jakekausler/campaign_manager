/**
 * Encounter GraphQL Type
 * Represents a combat encounter or challenge in a campaign
 */

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import { EffectExecutionSummary } from './effect.type';

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

/**
 * EncounterResolutionResult - Result of resolving an encounter with effect execution
 */
@ObjectType()
export class EncounterResolutionResult {
  @Field(() => Encounter, { description: 'The resolved encounter' })
  encounter!: Encounter;

  @Field(() => EffectExecutionSummary, {
    description: 'Summary of PRE effects executed before resolution',
  })
  pre!: EffectExecutionSummary;

  @Field(() => EffectExecutionSummary, {
    description: 'Summary of ON_RESOLVE effects executed during resolution',
  })
  onResolve!: EffectExecutionSummary;

  @Field(() => EffectExecutionSummary, {
    description: 'Summary of POST effects executed after resolution',
  })
  post!: EffectExecutionSummary;
}
