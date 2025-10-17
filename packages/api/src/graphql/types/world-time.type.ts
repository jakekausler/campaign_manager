/**
 * World Time GraphQL Types
 * Represents world time operations and results
 */

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class WorldTimeResult {
  @Field(() => ID, { description: 'ID of the campaign whose time was advanced' })
  campaignId!: string;

  @Field({
    nullable: true,
    description: 'Previous world time before advancement (null if this is the first time set)',
  })
  previousWorldTime?: Date;

  @Field({ description: 'Current world time after advancement' })
  currentWorldTime!: Date;

  @Field(() => Int, { description: 'Count of entities with versions at this time' })
  affectedEntities!: number;

  @Field({ description: 'Human-readable message about the time advancement' })
  message!: string;
}
