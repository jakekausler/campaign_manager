/**
 * Shared Filter Input Types
 * Base filters that can be extended by entity-specific filters
 */

import { Field, InputType, registerEnumType } from '@nestjs/graphql';

/**
 * Entity status for filtering
 */
export enum EntityStatus {
  ACTIVE = 'ACTIVE', // Not deleted and not archived
  ARCHIVED = 'ARCHIVED', // Archived but not deleted
  DELETED = 'DELETED', // Soft deleted
  ALL = 'ALL', // Include everything (admin use)
}

registerEnumType(EntityStatus, {
  name: 'EntityStatus',
  description: 'Status filter for entities',
});

/**
 * Sort order enum
 */
export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

registerEnumType(SortOrder, {
  name: 'SortOrder',
  description: 'Sort order for results',
});

/**
 * Base filter input with common fields
 */
@InputType()
export class BaseFilterInput {
  @Field(() => String, { nullable: true, description: 'Search by name' })
  nameContains?: string;

  @Field(() => [String], { nullable: true, description: 'Filter by tags' })
  tags?: string[];

  @Field(() => EntityStatus, {
    nullable: true,
    defaultValue: EntityStatus.ACTIVE,
    description: 'Filter by entity status',
  })
  status?: EntityStatus;

  @Field(() => Date, { nullable: true, description: 'Created after this date' })
  createdAfter?: Date;

  @Field(() => Date, { nullable: true, description: 'Created before this date' })
  createdBefore?: Date;

  @Field(() => Date, { nullable: true, description: 'Updated after this date' })
  updatedAfter?: Date;

  @Field(() => Date, { nullable: true, description: 'Updated before this date' })
  updatedBefore?: Date;
}

/**
 * Sort field options for most entities
 */
export enum CommonSortField {
  NAME = 'NAME',
  CREATED_AT = 'CREATED_AT',
  UPDATED_AT = 'UPDATED_AT',
}

registerEnumType(CommonSortField, {
  name: 'CommonSortField',
  description: 'Common sort fields',
});

/**
 * Base sort input
 */
@InputType()
export class BaseSortInput {
  @Field(() => CommonSortField, {
    nullable: true,
    defaultValue: CommonSortField.CREATED_AT,
    description: 'Field to sort by',
  })
  field?: CommonSortField;

  @Field(() => SortOrder, {
    nullable: true,
    defaultValue: SortOrder.DESC,
    description: 'Sort order',
  })
  order?: SortOrder;
}

/**
 * Helper to build Prisma where clause from status filter
 */
export function buildStatusWhere(status?: EntityStatus) {
  switch (status) {
    case EntityStatus.ACTIVE:
      return {
        deletedAt: null,
        archivedAt: null,
      };
    case EntityStatus.ARCHIVED:
      return {
        deletedAt: null,
        archivedAt: { not: null },
      };
    case EntityStatus.DELETED:
      return {
        deletedAt: { not: null },
      };
    case EntityStatus.ALL:
      return {}; // No filter
    default:
      // Default to ACTIVE
      return {
        deletedAt: null,
        archivedAt: null,
      };
  }
}
