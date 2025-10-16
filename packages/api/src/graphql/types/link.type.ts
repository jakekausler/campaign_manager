/**
 * Link GraphQL Type
 * Represents a relationship between two entities (encounters and events)
 */

import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Link {
  @Field(() => ID)
  id!: string;

  @Field({ description: 'Source entity type: encounter or event' })
  sourceType!: string;

  @Field(() => ID)
  sourceId!: string;

  @Field({ description: 'Target entity type: encounter or event' })
  targetType!: string;

  @Field(() => ID)
  targetId!: string;

  @Field({ description: 'Link type: prerequisite, blocks, triggers, or related' })
  linkType!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  deletedAt?: Date;
}
