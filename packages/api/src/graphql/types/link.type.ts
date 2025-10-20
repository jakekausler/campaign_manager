/**
 * Link GraphQL Type
 * Represents a relationship between two entities (encounters and events)
 */

import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Link {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { description: 'Source entity type: encounter or event' })
  sourceType!: string;

  @Field(() => ID)
  sourceId!: string;

  @Field(() => String, { description: 'Target entity type: encounter or event' })
  targetType!: string;

  @Field(() => ID)
  targetId!: string;

  @Field(() => String, { description: 'Link type: prerequisite, blocks, triggers, or related' })
  linkType!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => String, { nullable: true })
  deletedAt?: Date;
}
