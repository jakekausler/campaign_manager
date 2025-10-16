/**
 * Version GraphQL Type
 * Represents a version snapshot of an entity at a specific point in world-time
 */

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class Version {
  @Field(() => ID)
  id!: string;

  @Field({ description: 'Type of entity being versioned (e.g., "campaign", "character")' })
  entityType!: string;

  @Field(() => ID, { description: 'ID of the entity being versioned' })
  entityId!: string;

  @Field(() => ID, { description: 'Branch this version belongs to' })
  branchId!: string;

  @Field({ description: 'Start of validity period in world-time' })
  validFrom!: Date;

  @Field({
    nullable: true,
    description: 'End of validity period in world-time (null means current)',
  })
  validTo?: Date;

  @Field(() => GraphQLJSON, { description: 'Complete entity state snapshot' })
  payload!: Record<string, unknown>;

  @Field(() => Int, { description: 'Version number for optimistic locking' })
  version!: number;

  @Field({ nullable: true, description: 'Optional comment describing the change' })
  comment?: string;

  @Field(() => ID, { description: 'User who created this version' })
  createdBy!: string;

  @Field({ description: 'When this version record was created' })
  createdAt!: Date;
}

@ObjectType()
export class VersionDiff {
  @Field(() => GraphQLJSON, { description: 'Fields that were added' })
  added!: Record<string, unknown>;

  @Field(() => GraphQLJSON, {
    description: 'Fields that were modified (showing old and new values)',
  })
  modified!: Record<string, { old: unknown; new: unknown }>;

  @Field(() => GraphQLJSON, { description: 'Fields that were removed' })
  removed!: Record<string, unknown>;
}

@ObjectType()
export class EntityModified {
  @Field(() => ID, { description: 'ID of the entity that was modified' })
  entityId!: string;

  @Field({ description: 'Type of entity that was modified' })
  entityType!: string;

  @Field(() => Int, { description: 'New version number after modification' })
  version!: number;

  @Field(() => ID, { description: 'User who made the modification' })
  modifiedBy!: string;

  @Field({ description: 'When the modification occurred' })
  modifiedAt!: Date;
}
