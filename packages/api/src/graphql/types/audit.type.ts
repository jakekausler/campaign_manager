/**
 * Audit GraphQL Type
 * Represents an audit log entry for entity mutations
 */

import { Field, ID, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class Audit {
  @Field(() => ID)
  id!: string;

  @Field(() => String, {
    description: 'Type of entity that was modified (e.g., "Settlement", "Structure")',
  })
  entityType!: string;

  @Field(() => ID, { description: 'ID of the entity that was modified' })
  entityId!: string;

  @Field(() => String, {
    description: 'Operation performed (CREATE, UPDATE, DELETE, ARCHIVE, RESTORE)',
  })
  operation!: string;

  @Field(() => ID, { description: 'User who performed the operation' })
  userId!: string;

  @Field(() => GraphQLJSON, {
    description:
      'Changes made (for CREATE: new values, for UPDATE: diff with before/after, for DELETE/ARCHIVE: final state)',
  })
  changes!: Record<string, unknown>;

  @Field(() => GraphQLJSON, {
    description: 'Additional metadata (IP address, user agent, etc.)',
  })
  metadata!: Record<string, unknown>;

  @Field({ description: 'When this audit entry was created' })
  timestamp!: Date;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Full entity state before the operation was performed',
  })
  previousState?: Record<string, unknown>;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Full entity state after the operation was performed',
  })
  newState?: Record<string, unknown>;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Computed diff between previousState and newState',
  })
  diff?: Record<string, unknown>;

  @Field(() => String, {
    nullable: true,
    description: 'Optional user-provided reason or explanation for this operation',
  })
  reason?: string;
}
