/**
 * Branch GraphQL Type
 * Represents an alternate timeline branch for version management
 */

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class Branch {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => ID)
  campaignId!: string;

  @Field(() => ID, { nullable: true })
  parentId?: string;

  @Field(() => Date, {
    nullable: true,
    description: 'World time when this branch diverged from parent',
  })
  divergedAt?: Date;

  // Metadata for organization and UI
  @Field(() => Boolean, { description: 'Pin branch for quick access' })
  isPinned!: boolean;

  @Field({ nullable: true, description: 'Hex color code for visual categorization' })
  color?: string;

  @Field(() => [String], { description: 'Tags for organizing branches' })
  tags!: string[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date;

  // Optional field resolvers for relations
  @Field(() => Branch, { nullable: true, description: 'Parent branch in hierarchy' })
  parent?: Branch;

  @Field(() => [Branch], { description: 'Child branches' })
  children?: Branch[];
}

@ObjectType()
export class BranchNode {
  @Field(() => Branch, { description: 'The branch at this node' })
  branch!: Branch;

  @Field(() => [BranchNode], { description: 'Child nodes in hierarchy tree' })
  children!: BranchNode[];
}

@ObjectType()
export class ForkResult {
  @Field(() => Branch, { description: 'The newly created branch' })
  branch!: Branch;

  @Field(() => Int, { description: 'Number of entity versions copied to new branch' })
  versionsCopied!: number;
}

/**
 * Types of conflicts that can occur during merge
 */
export enum ConflictTypeEnum {
  /** Both branches modified the same property with different values */
  BOTH_MODIFIED = 'BOTH_MODIFIED',
  /** Both branches deleted the property */
  BOTH_DELETED = 'BOTH_DELETED',
  /** Source modified, target deleted */
  MODIFIED_DELETED = 'MODIFIED_DELETED',
  /** Source deleted, target modified */
  DELETED_MODIFIED = 'DELETED_MODIFIED',
}

@ObjectType()
export class MergeConflict {
  @Field({ description: 'JSON path to the conflicting property (e.g., "resources.gold")' })
  path!: string;

  @Field({ description: 'Type of conflict' })
  type!: string;

  @Field({ description: 'Human-readable conflict description' })
  description!: string;

  @Field({ nullable: true, description: 'Suggested resolution (if applicable)' })
  suggestion?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Value from common ancestor (base), JSON-stringified',
  })
  baseValue?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Value from source branch, JSON-stringified',
  })
  sourceValue?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Value from target branch, JSON-stringified',
  })
  targetValue?: string;
}

@ObjectType()
export class AutoResolvedChange {
  @Field({ description: 'JSON path to the auto-resolved property' })
  path!: string;

  @Field({ description: 'Which branch value was used: "source", "target", "base", or "both"' })
  resolvedTo!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Value from common ancestor (base), JSON-stringified',
  })
  baseValue?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Value from source branch, JSON-stringified',
  })
  sourceValue?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Value from target branch, JSON-stringified',
  })
  targetValue?: string;

  @Field(() => String, { description: 'The resolved value, JSON-stringified' })
  resolvedValue!: string;
}

@ObjectType()
export class EntityMergePreview {
  @Field(() => ID, { description: 'Entity ID' })
  entityId!: string;

  @Field({ description: 'Entity type (e.g., "settlement", "structure")' })
  entityType!: string;

  @Field(() => [MergeConflict], { description: 'Conflicts for this entity' })
  conflicts!: MergeConflict[];

  @Field(() => [AutoResolvedChange], { description: 'Auto-resolved changes for this entity' })
  autoResolvedChanges!: AutoResolvedChange[];
}

@ObjectType()
export class MergePreview {
  @Field(() => ID, { description: 'Source branch ID' })
  sourceBranchId!: string;

  @Field(() => ID, { description: 'Target branch ID' })
  targetBranchId!: string;

  @Field(() => ID, { nullable: true, description: 'Common ancestor branch ID' })
  commonAncestorId?: string;

  @Field(() => [EntityMergePreview], { description: 'Merge preview for each entity' })
  entities!: EntityMergePreview[];

  @Field(() => Int, { description: 'Total number of conflicts across all entities' })
  totalConflicts!: number;

  @Field(() => Int, { description: 'Total number of auto-resolved changes across all entities' })
  totalAutoResolved!: number;

  @Field(() => Boolean, { description: 'Whether merge requires manual conflict resolution' })
  requiresManualResolution!: boolean;
}

@ObjectType()
export class MergeResult {
  @Field(() => Boolean, { description: 'Whether the merge was successful' })
  success!: boolean;

  @Field(() => Int, { description: 'Number of entity versions created in target branch' })
  versionsCreated!: number;

  @Field(() => [String], { description: 'IDs of entities that were merged' })
  mergedEntityIds!: string[];

  @Field({ nullable: true, description: 'Error message if merge failed' })
  error?: string;
}

@ObjectType()
export class CherryPickResult {
  @Field(() => Boolean, { description: 'Whether the cherry-pick was successful' })
  success!: boolean;

  @Field(() => Boolean, { description: 'Whether conflicts were detected' })
  hasConflict!: boolean;

  @Field(() => [MergeConflict], {
    nullable: true,
    description: 'Conflicts detected during cherry-pick (if any)',
  })
  conflicts?: MergeConflict[];

  @Field(() => ID, {
    nullable: true,
    description: 'ID of the version created in target branch (if no conflicts)',
  })
  versionId?: string;

  @Field({ nullable: true, description: 'Error message if cherry-pick failed' })
  error?: string;
}

/**
 * MergeHistoryEntry - Represents a recorded merge operation for audit trail
 */
@ObjectType()
export class MergeHistoryEntry {
  @Field(() => ID, { description: 'Unique identifier for this merge history entry' })
  id!: string;

  @Field(() => ID, { description: 'ID of the source branch that was merged from' })
  sourceBranchId!: string;

  @Field(() => Branch, { description: 'Source branch that was merged from' })
  sourceBranch!: Branch;

  @Field(() => ID, { description: 'ID of the target branch that was merged into' })
  targetBranchId!: string;

  @Field(() => Branch, { description: 'Target branch that was merged into' })
  targetBranch!: Branch;

  @Field(() => ID, { description: 'ID of the common ancestor branch at time of merge' })
  commonAncestorId!: string;

  @Field(() => Date, { description: 'World time at which the merge was performed' })
  worldTime!: Date;

  @Field(() => ID, { description: 'ID of the user who performed the merge' })
  mergedBy!: string;

  @Field(() => Date, { description: 'System timestamp when merge completed' })
  mergedAt!: Date;

  @Field(() => Int, { description: 'Number of conflicts that were manually resolved' })
  conflictsCount!: number;

  @Field(() => Int, { description: 'Number of entities that had versions created' })
  entitiesMerged!: number;

  @Field(() => GraphQLJSON, { description: 'Conflict resolutions applied (for audit trail)' })
  resolutionsData!: Record<string, unknown>;

  @Field(() => GraphQLJSON, {
    description: 'Additional context (merge strategy, notes, etc.)',
    defaultValue: {},
  })
  metadata!: Record<string, unknown>;
}
