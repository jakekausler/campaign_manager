/**
 * Event GraphQL Type
 * Represents a story event or happening in a campaign
 */

import { ObjectType, Field, ID } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import { EffectExecutionSummary } from './effect.type';

@ObjectType()
export class Event {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  campaignId!: string;

  @Field(() => ID, { nullable: true })
  locationId?: string;

  @Field(() => Date)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, { description: 'Event type: story, kingdom, party, or world' })
  eventType!: string;

  @Field(() => String, {
    nullable: true,
    description: 'When the event is scheduled to occur (world time)',
  })
  scheduledAt?: Date;

  @Field(() => String, { nullable: true, description: 'When the event occurred (world time)' })
  occurredAt?: Date;

  @Field({ description: 'Whether the event has been completed' })
  isCompleted!: boolean;

  @Field(() => GraphQLJSON, { description: 'Custom event data' })
  variables!: Record<string, unknown>;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => String, { nullable: true })
  deletedAt?: Date;

  @Field(() => String, { nullable: true })
  archivedAt?: Date;
}

/**
 * EventCompletionResult - Result of completing an event with effect execution
 */
@ObjectType()
export class EventCompletionResult {
  @Field(() => Event, { description: 'The completed event' })
  event!: Event;

  @Field(() => EffectExecutionSummary, {
    description: 'Summary of PRE effects executed before completion',
  })
  pre!: EffectExecutionSummary;

  @Field(() => EffectExecutionSummary, {
    description: 'Summary of ON_RESOLVE effects executed during completion',
  })
  onResolve!: EffectExecutionSummary;

  @Field(() => EffectExecutionSummary, {
    description: 'Summary of POST effects executed after completion',
  })
  post!: EffectExecutionSummary;
}
