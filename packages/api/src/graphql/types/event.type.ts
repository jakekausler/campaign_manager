/**
 * Event GraphQL Type
 * Represents a story event or happening in a campaign
 */

import { ObjectType, Field, ID } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class Event {
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

  @Field({ description: 'Event type: story, kingdom, party, or world' })
  eventType!: string;

  @Field({ nullable: true, description: 'When the event is scheduled to occur (world time)' })
  scheduledAt?: Date;

  @Field({ nullable: true, description: 'When the event occurred (world time)' })
  occurredAt?: Date;

  @Field({ description: 'Whether the event has been completed' })
  isCompleted!: boolean;

  @Field(() => GraphQLJSON, { description: 'Custom event data' })
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
