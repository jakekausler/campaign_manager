/**
 * @fileoverview Merge Service - Handles branch merges with 3-way merge algorithm
 *
 * This service provides comprehensive merge operations for the branching system, including:
 * - 3-way merge with automatic conflict detection and resolution
 * - Cherry-picking individual versions between branches
 * - Common ancestor finding for merge base determination
 * - Conflict detection and manual conflict resolution
 * - Merge history tracking and audit logging
 *
 * The service implements a true 3-way merge algorithm similar to Git, comparing:
 * - Base version (from common ancestor at divergence point)
 * - Source version (from branch being merged)
 * - Target version (from branch being merged into)
 *
 * Key Features:
 * - Automatic resolution when only one branch changed a property
 * - Conflict detection when both branches modified the same property
 * - Manual conflict resolution with validation
 * - Atomic merge operations with transaction support
 * - Cherry-pick support for selective change application
 * - Comprehensive audit logging and merge history
 *
 * @see BranchService For branch hierarchy management
 * @see VersionService For version resolution and creation
 * @see ConflictDetector For deep property-level conflict detection
 * @see AuditService For audit logging
 */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Branch as PrismaBranch, Version } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import type { ConflictResolution } from '../inputs/branch.input';

import { AuditService } from './audit.service';
import { BranchService } from './branch.service';
import { ConflictDetector } from './conflict-detector';
import { VersionService } from './version.service';

/**
 * Result of a 3-way merge operation
 */
export interface MergeResult {
  /** Whether the merge was successful without conflicts */
  success: boolean;
  /** List of conflicts that require manual resolution */
  conflicts: MergeConflict[];
  /** The merged payload (if auto-resolved) or null if conflicts exist */
  mergedPayload: Record<string, unknown> | null;
  /** Detailed information about conflicts for UI display */
  conflictDetails: ConflictDetail[];
}

/**
 * Represents a merge conflict between two branches
 */
export interface MergeConflict {
  /** JSON path to the conflicting property (e.g., "settlement.population") */
  path: string;
  /** Type of conflict */
  type: ConflictType;
  /** Value from the common ancestor (base) */
  baseValue: unknown;
  /** Value from the source branch */
  sourceValue: unknown;
  /** Value from the target branch */
  targetValue: unknown;
}

/**
 * Types of conflicts that can occur during merge
 */
export enum ConflictType {
  /** Both branches modified the same property */
  BOTH_MODIFIED = 'BOTH_MODIFIED',
  /** Both branches deleted the property */
  BOTH_DELETED = 'BOTH_DELETED',
  /** Source modified, target deleted */
  MODIFIED_DELETED = 'MODIFIED_DELETED',
  /** Source deleted, target modified */
  DELETED_MODIFIED = 'DELETED_MODIFIED',
}

/**
 * Detailed conflict information for UI display
 */
export interface ConflictDetail {
  /** JSON path to the conflict */
  path: string;
  /** Human-readable description */
  description: string;
  /** Suggested resolution (if any) */
  suggestion?: string;
}

/**
 * Result of retrieving three versions for 3-way merge
 */
export interface ThreeWayVersions {
  /** Version from common ancestor (merge base) */
  base: Version | null;
  /** Version from source branch */
  source: Version | null;
  /** Version from target branch */
  target: Version | null;
}

/**
 * Result of executing a merge operation
 */
export interface ExecuteMergeResult {
  /** Whether the merge was successful */
  success: boolean;
  /** Number of entity versions created in target branch */
  versionsCreated: number;
  /** IDs of entities that were merged (entityType:entityId format) */
  mergedEntityIds: string[];
  /** Error message if merge failed */
  error?: string;
}

/**
 * Result of a cherry-pick operation
 */
export interface CherryPickResult {
  /** Whether the cherry-pick was successful */
  success: boolean;
  /** Whether the cherry-pick has conflicts */
  hasConflict: boolean;
  /** List of conflicts (if any) */
  conflicts?: MergeConflict[];
  /** Version that was created (if successful) */
  versionCreated?: Version;
  /** Error message if cherry-pick failed */
  error?: string;
}

/**
 * Parameters for executing a merge operation
 */
export interface ExecuteMergeParams {
  /** Source branch ID (branch to merge from) */
  sourceBranchId: string;
  /** Target branch ID (branch to merge into) */
  targetBranchId: string;
  /** Common ancestor branch ID */
  commonAncestorId: string;
  /** World time at which to perform the merge */
  worldTime: Date;
  /** Manual resolutions for conflicts */
  resolutions: ConflictResolution[];
  /** User performing the merge */
  user: AuthenticatedUser;
}

/**
 * Service for handling branch merges with 3-way merge algorithm
 * and conflict detection/resolution.
 *
 * This service orchestrates complex merge operations between branches in the version control system.
 * It implements a true 3-way merge algorithm (similar to Git) that compares changes in both branches
 * against their common ancestor to intelligently detect and resolve conflicts.
 *
 * Architecture:
 * - Uses ConflictDetector for deep property-level conflict analysis
 * - Leverages BranchService for branch hierarchy traversal
 * - Uses VersionService for version resolution and creation
 * - Integrates with AuditService for comprehensive audit logging
 * - All merge operations are atomic via database transactions
 *
 * Merge Algorithm:
 * 1. Find common ancestor branch (merge base)
 * 2. Determine divergence point where branches split
 * 3. For each entity, resolve three versions (base, source, target)
 * 4. Compare versions to detect conflicts:
 *    - Only source changed → auto-resolve to source
 *    - Only target changed → auto-resolve to target
 *    - Both changed → conflict requiring manual resolution
 *    - Neither changed → keep base value
 * 5. Apply manual conflict resolutions if provided
 * 6. Create new versions in target branch
 * 7. Record merge history and audit logs
 *
 * @example
 * ```typescript
 * // Execute a merge with conflict resolution
 * const result = await mergeService.executeMerge({
 *   sourceBranchId: 'branch-123',
 *   targetBranchId: 'branch-456',
 *   commonAncestorId: 'branch-main',
 *   worldTime: new Date('2024-01-15T10:00:00Z'),
 *   resolutions: [
 *     {
 *       entityType: 'settlement',
 *       entityId: 'settlement-1',
 *       path: 'population',
 *       resolvedValue: '{"value": 5000}'
 *     }
 *   ],
 *   user: authenticatedUser
 * });
 * ```
 *
 * @see BranchService For branch hierarchy operations
 * @see VersionService For version management
 * @see ConflictDetector For conflict detection logic
 */
@Injectable()
export class MergeService {
  private readonly conflictDetector: ConflictDetector;

  /**
   * Creates a new MergeService instance.
   *
   * @param branchService - Service for branch operations and ancestry traversal
   * @param versionService - Service for version resolution and creation
   * @param prisma - Prisma client for database operations
   * @param audit - Service for audit logging
   */
  constructor(
    private readonly branchService: BranchService,
    private readonly versionService: VersionService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {
    this.conflictDetector = new ConflictDetector();
  }

  /**
   * Find the common ancestor (merge base) between two branches.
   * Uses the 3-way merge algorithm to identify the most recent common ancestor
   * in the branch hierarchy.
   *
   * This is a critical operation for 3-way merges, as the common ancestor represents
   * the "base" state that both branches diverged from. The algorithm walks backwards
   * through the branch ancestry to find the most recent shared ancestor.
   *
   * Algorithm:
   * 1. Get full ancestry chain for both branches (root to branch)
   * 2. Build a set of source branch ancestor IDs for O(1) lookup
   * 3. Walk backwards through target ancestry to find most recent common ancestor
   * 4. Return the first ancestor found in both chains (most recent)
   *
   * Time Complexity: O(n + m) where n and m are the depths of the two branches
   * Space Complexity: O(n) for the source ancestry set
   *
   * @example
   * ```typescript
   * const ancestor = await mergeService.findCommonAncestor('feature-1', 'feature-2');
   * if (ancestor) {
   *   console.log(`Common ancestor: ${ancestor.name}`);
   * } else {
   *   console.log('Branches have no common history');
   * }
   * ```
   *
   * @param sourceBranchId - ID of the source branch to merge from
   * @param targetBranchId - ID of the target branch to merge into
   * @returns The common ancestor branch, or null if branches have no common history
   */
  async findCommonAncestor(
    sourceBranchId: string,
    targetBranchId: string
  ): Promise<PrismaBranch | null> {
    // Get ancestry chains for both branches
    const sourceAncestry = await this.branchService.getAncestry(sourceBranchId);
    const targetAncestry = await this.branchService.getAncestry(targetBranchId);

    // Build a set of source branch IDs for O(1) lookup
    const sourceAncestorIds = new Set(sourceAncestry.map((b) => b.id));

    // Walk backwards through target ancestry to find most recent common ancestor
    // We reverse to start from the leaf and work toward the root
    for (let i = targetAncestry.length - 1; i >= 0; i--) {
      const targetBranch = targetAncestry[i];
      if (sourceAncestorIds.has(targetBranch.id)) {
        // Found the most recent common ancestor
        return targetBranch;
      }
    }

    // No common ancestor found
    return null;
  }

  /**
   * Find the divergence time for determining the base version in a 3-way merge.
   * This is the point in time where the source and target branches diverged from
   * the common ancestor.
   *
   * The divergence time is critical for accurate 3-way merges because it determines
   * what state should be considered the "base" version. Using the wrong time could
   * result in incorrect conflict detection or data loss.
   *
   * Algorithm:
   * 1. Fetch source and target branch metadata
   * 2. Get ancestry chains to find which branches diverged from the base
   * 3. Find the branch in each ancestry that has baseBranchId as its parent
   * 4. Extract the divergedAt time from those branches
   * 5. Special cases:
   *    - If one branch IS the common ancestor, use the other's divergence time
   *    - If both diverged from the base, use the earlier divergence time
   *
   * Edge Cases:
   * - Source branch is the common ancestor (fast-forward merge)
   * - Target branch is the common ancestor (already merged)
   * - Both branches diverged at different times
   * - Invalid branch hierarchy (throws BadRequestException)
   *
   * @param sourceBranchId - ID of source branch to merge from
   * @param targetBranchId - ID of target branch to merge into
   * @param baseBranchId - ID of common ancestor branch
   * @returns The divergence time to use for resolving the base version
   * @throws {BadRequestException} If divergence time cannot be determined (invalid hierarchy)
   */
  private async findDivergenceTime(
    sourceBranchId: string,
    targetBranchId: string,
    baseBranchId: string
  ): Promise<Date> {
    // Fetch source and target branches to check their divergedAt times
    const [sourceBranch, targetBranch] = await Promise.all([
      this.prisma.branch.findUnique({ where: { id: sourceBranchId } }),
      this.prisma.branch.findUnique({ where: { id: targetBranchId } }),
    ]);

    if (!sourceBranch || !targetBranch) {
      throw new Error('Source or target branch not found');
    }

    // Get ancestry chains to determine which branches diverged from the base
    const sourceAncestry = await this.branchService.getAncestry(sourceBranchId);
    const targetAncestry = await this.branchService.getAncestry(targetBranchId);

    // Find which branch in each ancestry chain diverged from the common ancestor
    let sourceDivergenceTime: Date | null = null;
    let targetDivergenceTime: Date | null = null;

    // Find the branch in source ancestry that has baseBranchId as parent
    for (const branch of sourceAncestry) {
      if (branch.parentId === baseBranchId && branch.divergedAt) {
        sourceDivergenceTime = branch.divergedAt;
        break;
      }
    }

    // Find the branch in target ancestry that has baseBranchId as parent
    for (const branch of targetAncestry) {
      if (branch.parentId === baseBranchId && branch.divergedAt) {
        targetDivergenceTime = branch.divergedAt;
        break;
      }
    }

    // Special case: if one branch IS the common ancestor, use the other's divergence time
    if (sourceBranchId === baseBranchId && targetDivergenceTime) {
      return targetDivergenceTime;
    }
    if (targetBranchId === baseBranchId && sourceDivergenceTime) {
      return sourceDivergenceTime;
    }

    // Both branches diverged from the base - use the earlier divergence time
    // This represents the point where both branches were last in sync
    if (sourceDivergenceTime && targetDivergenceTime) {
      return sourceDivergenceTime < targetDivergenceTime
        ? sourceDivergenceTime
        : targetDivergenceTime;
    }

    // If we reach here, we couldn't determine divergence time
    // This indicates a structural problem with the branch hierarchy
    throw new BadRequestException(
      `Cannot determine divergence time: source branch ${sourceBranchId} and target branch ${targetBranchId} do not properly diverge from common ancestor ${baseBranchId}`
    );
  }

  /**
   * Retrieve the three versions needed for a 3-way merge:
   * - base: version from common ancestor at divergence point
   * - source: version from source branch at worldTime
   * - target: version from target branch at worldTime
   *
   * Any of these may be null if the entity doesn't exist in that branch
   * at the given world time. This is normal and expected (e.g., entity
   * created in one branch but not the other).
   *
   * Algorithm:
   * 1. Determine the divergence point using findDivergenceTime()
   * 2. Resolve base version at the divergence time (when branches split)
   * 3. Resolve source and target versions at the provided world time
   * 4. Return all three versions for conflict detection
   *
   * Null Version Scenarios:
   * - Base null, source/target non-null: Entity created after divergence
   * - Base non-null, source null: Entity deleted in source branch
   * - Base non-null, target null: Entity deleted in target branch
   * - All null: Entity doesn't exist (should be filtered out)
   *
   * @example
   * ```typescript
   * const versions = await mergeService.getEntityVersionsForMerge(
   *   'settlement',
   *   'settlement-123',
   *   'feature-branch',
   *   'main',
   *   'common-ancestor',
   *   new Date('2024-01-15T10:00:00Z')
   * );
   * // versions.base: state at divergence
   * // versions.source: current state in feature-branch
   * // versions.target: current state in main
   * ```
   *
   * @param entityType - Type of entity (e.g., "settlement", "structure", "event")
   * @param entityId - Unique ID of the entity
   * @param sourceBranchId - ID of source branch to merge from
   * @param targetBranchId - ID of target branch to merge into
   * @param baseBranchId - ID of common ancestor branch
   * @param worldTime - World time at which to resolve source and target versions
   * @returns Object containing base, source, and target versions (any may be null)
   */
  async getEntityVersionsForMerge(
    entityType: string,
    entityId: string,
    sourceBranchId: string,
    targetBranchId: string,
    baseBranchId: string,
    worldTime: Date
  ): Promise<ThreeWayVersions> {
    // Determine the divergence point for the base version
    // The base version should be resolved at the point where the branches diverged
    const divergenceTime = await this.findDivergenceTime(
      sourceBranchId,
      targetBranchId,
      baseBranchId
    );

    // Fetch all three versions
    // Base version is resolved at divergence time, source and target at worldTime
    const [base, source, target] = await Promise.all([
      this.versionService.resolveVersion(entityType, entityId, baseBranchId, divergenceTime),
      this.versionService.resolveVersion(entityType, entityId, sourceBranchId, worldTime),
      this.versionService.resolveVersion(entityType, entityId, targetBranchId, worldTime),
    ]);

    return { base, source, target };
  }

  /**
   * Compare three versions to detect changes in source and target branches
   * relative to the common ancestor.
   *
   * This is the core of the 3-way merge algorithm. It performs a deep comparison
   * of all properties across the three versions, automatically resolving changes
   * where possible and detecting conflicts where both branches modified the same property.
   *
   * Merge Resolution Logic:
   * - If only source changed: auto-resolve to source value (accept incoming changes)
   * - If only target changed: auto-resolve to target value (keep existing changes)
   * - If both changed differently: conflict requiring manual resolution
   * - If both changed to same value: auto-resolve (both branches agree)
   * - If neither changed: keep base value (no changes needed)
   *
   * The ConflictDetector performs deep property-level analysis, handling:
   * - Nested object properties
   * - Array modifications
   * - Property deletions
   * - Property additions
   * - Type changes
   *
   * @example
   * ```typescript
   * const result = mergeService.compareVersions(
   *   { name: "Waterdeep", population: 1000 },  // base
   *   { name: "Waterdeep", population: 1500 },  // source changed population
   *   { name: "Waterdeep City", population: 1000 }  // target changed name
   * );
   * // result.success: true (both changes can be merged)
   * // result.mergedPayload: { name: "Waterdeep City", population: 1500 }
   * // result.conflicts: [] (no conflicts)
   * ```
   *
   * @param basePayload - Payload from common ancestor at divergence point
   * @param sourcePayload - Payload from source branch at merge time
   * @param targetPayload - Payload from target branch at merge time
   * @returns MergeResult with auto-resolved payload or conflicts requiring resolution
   */
  compareVersions(
    basePayload: Record<string, unknown> | null,
    sourcePayload: Record<string, unknown> | null,
    targetPayload: Record<string, unknown> | null
  ): MergeResult {
    // Use ConflictDetector to analyze the three versions
    const result = this.conflictDetector.detectPropertyConflicts(
      basePayload,
      sourcePayload,
      targetPayload
    );

    // Generate conflict details for UI display
    const conflictDetails: ConflictDetail[] = result.conflicts.map((conflict) => ({
      path: conflict.path,
      description: this.generateConflictDescription(conflict),
      suggestion: this.generateConflictSuggestion(conflict),
    }));

    return {
      success: !result.hasConflicts,
      conflicts: result.conflicts,
      mergedPayload: result.mergedPayload,
      conflictDetails,
    };
  }

  /**
   * Generate a human-readable description of a conflict for UI display.
   *
   * Creates user-friendly descriptions that explain what type of conflict occurred
   * and which properties are affected. These descriptions are used in the GraphQL API
   * to help users understand and resolve conflicts.
   *
   * @param conflict - The conflict to describe
   * @returns Human-readable description of the conflict
   */
  private generateConflictDescription(conflict: MergeConflict): string {
    const { path, type } = conflict;

    switch (type) {
      case ConflictType.BOTH_MODIFIED:
        return `Both branches modified "${path}" with different values`;
      case ConflictType.BOTH_DELETED:
        return `Both branches deleted "${path}"`;
      case ConflictType.MODIFIED_DELETED:
        return `Source branch modified "${path}" while target branch deleted it`;
      case ConflictType.DELETED_MODIFIED:
        return `Source branch deleted "${path}" while target branch modified it`;
      default:
        return `Conflict detected on "${path}"`;
    }
  }

  /**
   * Generate a suggested resolution for a conflict (if applicable).
   *
   * Provides intelligent suggestions for resolving certain types of conflicts based
   * on the conflict type and values. Not all conflicts have automatic suggestions,
   * as many require human judgment.
   *
   * @param conflict - The conflict to generate a suggestion for
   * @returns Suggested resolution strategy, or undefined if no suggestion available
   */
  private generateConflictSuggestion(conflict: MergeConflict): string | undefined {
    const { type } = conflict;

    switch (type) {
      case ConflictType.BOTH_DELETED:
        return 'Both branches deleted this property - safe to remove';
      case ConflictType.MODIFIED_DELETED:
        return 'Consider whether the modification is still relevant if the property was deleted';
      case ConflictType.DELETED_MODIFIED:
        return 'Consider whether the modification is still relevant if the property was deleted';
      default:
        return undefined;
    }
  }

  /**
   * Execute a merge operation, creating new versions in the target branch.
   *
   * This is the main entry point for performing a complete branch merge. It implements
   * a two-pass algorithm that ensures all conflicts are resolved before making any
   * database changes, providing strong consistency guarantees.
   *
   * Two-Pass Algorithm:
   * PASS 1 (Analysis):
   * - Discover all entities that exist in source or target branches
   * - For each entity, perform 3-way merge to detect conflicts
   * - Collect all conflicts and merge data
   * - NO database writes occur in this pass
   *
   * PASS 2 (Execution):
   * - Validate ALL conflicts have resolutions
   * - Create new versions in target branch atomically
   * - Record merge history
   * - Create audit log entries
   *
   * The entire operation is wrapped in a database transaction for atomicity. If any
   * step fails or conflicts remain unresolved, the entire operation rolls back.
   *
   * Validation:
   * - Validates commonAncestorId is the actual common ancestor
   * - Validates all conflicts have resolutions before any DB writes
   * - Skips entities with no changes (payload identical to target)
   * - Skips entities that don't exist in any branch
   *
   * @example
   * ```typescript
   * const result = await mergeService.executeMerge({
   *   sourceBranchId: 'feature-123',
   *   targetBranchId: 'main',
   *   commonAncestorId: 'main',
   *   worldTime: new Date('2024-01-15T10:00:00Z'),
   *   resolutions: [
   *     {
   *       entityType: 'settlement',
   *       entityId: 'settlement-1',
   *       path: 'population',
   *       resolvedValue: '5000'
   *     }
   *   ],
   *   user: authenticatedUser
   * });
   * // result.success: true
   * // result.versionsCreated: 5
   * // result.mergedEntityIds: ['settlement:1', 'structure:2', ...]
   * ```
   *
   * @param params - Merge execution parameters including branches, resolutions, and user
   * @returns Result with success status, versions created count, and merged entity IDs
   * @throws {BadRequestException} If branches have no common ancestor
   * @throws {BadRequestException} If provided commonAncestorId is invalid
   * @throws {BadRequestException} If unresolved conflicts remain
   */
  async executeMerge(params: ExecuteMergeParams): Promise<ExecuteMergeResult> {
    const { sourceBranchId, targetBranchId, commonAncestorId, worldTime, resolutions, user } =
      params;

    // Validate that the commonAncestorId is actually a valid common ancestor
    const actualCommonAncestor = await this.findCommonAncestor(sourceBranchId, targetBranchId);
    if (!actualCommonAncestor) {
      throw new BadRequestException(
        `Cannot merge: branches ${sourceBranchId} and ${targetBranchId} do not have a common ancestor.`
      );
    }
    if (actualCommonAncestor.id !== commonAncestorId) {
      throw new BadRequestException(
        `Invalid commonAncestorId: provided ${commonAncestorId} but actual common ancestor is ${actualCommonAncestor.id}`
      );
    }

    // Use Prisma transaction for atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      // Discover all entities that exist in source or target branches
      const entityIds = await this.discoverEntitiesForMerge(
        sourceBranchId,
        targetBranchId,
        worldTime,
        tx
      );

      // PASS 1: Analyze entities and collect conflicts (no DB writes)
      interface EntityMergeData {
        entityType: string;
        entityId: string;
        finalPayload: Record<string, unknown>;
        conflictsResolved: number;
        targetPayload: Record<string, unknown> | null;
      }

      const entitiesToMerge: EntityMergeData[] = [];
      const allConflicts: Array<{
        entityType: string;
        entityId: string;
        conflicts: MergeConflict[];
      }> = [];

      for (const { entityType, entityId } of entityIds) {
        // Get three versions for 3-way merge
        const versions = await this.getEntityVersionsForMerge(
          entityType,
          entityId,
          sourceBranchId,
          targetBranchId,
          commonAncestorId,
          worldTime
        );

        // Skip if entity doesn't exist in any branch
        if (!versions.base && !versions.source && !versions.target) {
          continue;
        }

        // Decompress payloads
        const basePayload = versions.base
          ? await this.versionService.decompressVersion(versions.base)
          : null;
        const sourcePayload = versions.source
          ? await this.versionService.decompressVersion(versions.source)
          : null;
        const targetPayload = versions.target
          ? await this.versionService.decompressVersion(versions.target)
          : null;

        // Perform 3-way merge to detect conflicts
        const mergeResult = this.compareVersions(basePayload, sourcePayload, targetPayload);

        // Collect conflicts for validation
        if (mergeResult.conflicts.length > 0) {
          allConflicts.push({
            entityType,
            entityId,
            conflicts: mergeResult.conflicts,
          });
        }

        // Apply manual conflict resolutions if provided
        let finalPayload = mergeResult.mergedPayload;
        if (mergeResult.conflicts.length > 0) {
          finalPayload = this.applyConflictResolutions(
            mergeResult.mergedPayload || targetPayload || sourcePayload || {},
            mergeResult.conflicts,
            resolutions,
            entityType,
            entityId
          );
        }

        // Skip if no changes (payload identical to target)
        if (
          finalPayload &&
          targetPayload &&
          JSON.stringify(finalPayload) === JSON.stringify(targetPayload)
        ) {
          continue;
        }

        // Store merge data for second pass
        if (finalPayload) {
          entitiesToMerge.push({
            entityType,
            entityId,
            finalPayload,
            conflictsResolved: mergeResult.conflicts.length,
            targetPayload,
          });
        }
      }

      // Validate all conflicts were resolved BEFORE any database writes
      const unresolvedConflicts = this.findUnresolvedConflicts(allConflicts, resolutions);
      if (unresolvedConflicts.length > 0) {
        throw new BadRequestException(
          `Cannot execute merge: ${unresolvedConflicts.length} conflicts remain unresolved. ` +
            `Please provide resolutions for all conflicts.`
        );
      }

      // PASS 2: Create versions now that validation passed
      const mergedEntityIds: string[] = [];
      let versionsCreated = 0;

      for (const entity of entitiesToMerge) {
        await this.versionService.createVersion(
          {
            entityType: entity.entityType,
            entityId: entity.entityId,
            branchId: targetBranchId,
            validFrom: worldTime,
            validTo: null,
            payload: entity.finalPayload,
            comment: `Merged from branch ${sourceBranchId}`,
          },
          user
        );

        versionsCreated++;
        mergedEntityIds.push(`${entity.entityType}:${entity.entityId}`);

        // Create audit log entry
        await this.audit.log(
          'version',
          `${entity.entityType}:${entity.entityId}`,
          'MERGE',
          user.id,
          {
            sourceBranchId,
            targetBranchId,
            commonAncestorId,
            worldTime: worldTime.toISOString(),
            conflictsResolved: entity.conflictsResolved,
          }
        );
      }

      // Record merge history
      await tx.mergeHistory.create({
        data: {
          sourceBranchId,
          targetBranchId,
          commonAncestorId,
          worldTime,
          mergedBy: user.id,
          conflictsCount: allConflicts.reduce((sum, e) => sum + e.conflicts.length, 0),
          entitiesMerged: versionsCreated,
          resolutionsData: resolutions as unknown as Prisma.InputJsonValue,
          metadata: {},
        },
      });

      return { versionsCreated, mergedEntityIds };
    });

    return {
      success: true,
      versionsCreated: result.versionsCreated,
      mergedEntityIds: result.mergedEntityIds,
    };
  }

  /**
   * Discover all entities that exist in either source or target branch at the given world time.
   * This includes entities that may have been deleted in one branch but still exist in the other.
   *
   * The discovery process finds ALL entities that need to be considered for the merge, including:
   * - Entities that exist in both branches (may have changes)
   * - Entities that exist only in source (new in source, or deleted in target)
   * - Entities that exist only in target (new in target, or deleted in source)
   *
   * This comprehensive discovery ensures that deletions are properly handled during the merge.
   *
   * Algorithm:
   * 1. Query all versions in source branch valid at worldTime
   * 2. Query all versions in target branch valid at worldTime
   * 3. Combine and deduplicate by entityType:entityId
   * 4. Return unique list of entities to consider for merge
   *
   * @param sourceBranchId - ID of source branch
   * @param targetBranchId - ID of target branch
   * @param worldTime - World time at which to discover entities
   * @param tx - Prisma transaction client for consistent reads
   * @returns Array of unique entity identifiers that need merge consideration
   */
  private async discoverEntitiesForMerge(
    sourceBranchId: string,
    targetBranchId: string,
    worldTime: Date,
    tx: Prisma.TransactionClient
  ): Promise<Array<{ entityType: string; entityId: string }>> {
    // Get all versions from both branches up to worldTime
    const [sourceVersions, targetVersions] = await Promise.all([
      tx.version.findMany({
        where: {
          branchId: sourceBranchId,
          validFrom: { lte: worldTime },
          OR: [{ validTo: null }, { validTo: { gte: worldTime } }],
        },
        select: { entityType: true, entityId: true },
        distinct: ['entityType', 'entityId'],
      }),
      tx.version.findMany({
        where: {
          branchId: targetBranchId,
          validFrom: { lte: worldTime },
          OR: [{ validTo: null }, { validTo: { gte: worldTime } }],
        },
        select: { entityType: true, entityId: true },
        distinct: ['entityType', 'entityId'],
      }),
    ]);

    // Combine and deduplicate
    const entitySet = new Set<string>();
    const entities: Array<{ entityType: string; entityId: string }> = [];

    for (const v of [...sourceVersions, ...targetVersions]) {
      const key = `${v.entityType}:${v.entityId}`;
      if (!entitySet.has(key)) {
        entitySet.add(key);
        entities.push({ entityType: v.entityType, entityId: v.entityId });
      }
    }

    return entities;
  }

  /**
   * Apply manual conflict resolutions to a payload.
   * Each resolution specifies a JSON path and the resolved value to use.
   *
   * This method takes a payload and applies user-provided conflict resolutions to it,
   * modifying the values at the specified paths. The resolved values are provided as
   * JSON strings and are parsed before being applied.
   *
   * Algorithm:
   * 1. Build a resolution map for quick lookup by path
   * 2. Filter resolutions for the current entity (by type and ID)
   * 3. For each conflict, apply the corresponding resolution if provided
   * 4. Parse JSON string values before setting them
   * 5. Return the modified payload
   *
   * @param payload - The base payload to apply resolutions to
   * @param conflicts - List of conflicts for this entity
   * @param resolutions - User-provided conflict resolutions
   * @param entityType - Type of entity being resolved
   * @param entityId - ID of entity being resolved
   * @returns New payload with conflict resolutions applied
   */
  private applyConflictResolutions(
    payload: Record<string, unknown>,
    conflicts: MergeConflict[],
    resolutions: ConflictResolution[],
    entityType: string,
    entityId: string
  ): Record<string, unknown> {
    const result = { ...payload };

    // Build resolution map for quick lookup
    const resolutionMap = new Map<string, string>();
    for (const resolution of resolutions) {
      if (resolution.entityType === entityType && resolution.entityId === entityId) {
        resolutionMap.set(resolution.path, resolution.resolvedValue);
      }
    }

    // Apply each resolution
    for (const conflict of conflicts) {
      const resolvedValue = resolutionMap.get(conflict.path);
      if (resolvedValue !== undefined) {
        // Parse the resolved value (it's a JSON string)
        const parsedValue = JSON.parse(resolvedValue);

        // Set the value at the specified path
        this.setValueAtPath(result, conflict.path, parsedValue);
      }
    }

    return result;
  }

  /**
   * Set a value at a nested path in an object (e.g., "resources.gold" = 100).
   *
   * This utility method supports setting deeply nested properties using dot notation.
   * It creates intermediate objects as needed if they don't exist.
   *
   * @example
   * ```typescript
   * const obj = {};
   * setValueAtPath(obj, "resources.gold", 100);
   * // obj is now { resources: { gold: 100 } }
   * ```
   *
   * @param obj - The object to modify
   * @param path - Dot-separated path to the property (e.g., "settlement.resources.gold")
   * @param value - The value to set at the specified path
   */
  private setValueAtPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      // Type assertion needed because we know this will be an object due to the initialization above
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Find conflicts that have not been resolved by the provided resolutions.
   *
   * This validation method checks that every conflict has a corresponding resolution
   * in the provided resolutions array. This ensures that all conflicts are explicitly
   * handled before proceeding with the merge.
   *
   * Algorithm:
   * 1. Build a set of resolution keys for O(1) lookup
   * 2. For each conflict, check if a matching resolution exists
   * 3. Return list of conflicts without resolutions
   *
   * Resolution keys are formatted as: "entityType:entityId:path"
   *
   * @param allConflicts - All conflicts discovered across all entities
   * @param resolutions - User-provided conflict resolutions
   * @returns Array of conflicts that do not have corresponding resolutions
   */
  private findUnresolvedConflicts(
    allConflicts: Array<{ entityType: string; entityId: string; conflicts: MergeConflict[] }>,
    resolutions: ConflictResolution[]
  ): MergeConflict[] {
    const unresolved: MergeConflict[] = [];

    // Build resolution set for quick lookup
    const resolutionSet = new Set<string>();
    for (const resolution of resolutions) {
      resolutionSet.add(`${resolution.entityType}:${resolution.entityId}:${resolution.path}`);
    }

    // Check each conflict
    for (const { entityType, entityId, conflicts } of allConflicts) {
      for (const conflict of conflicts) {
        const key = `${entityType}:${entityId}:${conflict.path}`;
        if (!resolutionSet.has(key)) {
          unresolved.push(conflict);
        }
      }
    }

    return unresolved;
  }

  /**
   * Cherry-pick a specific version from one branch to another.
   *
   * This operation applies a single version change from a source branch to a target branch.
   * Unlike a full merge which compares against a common ancestor, cherry-pick performs a
   * simpler 2-way comparison:
   * - If the entity doesn't exist in target → apply source version directly
   * - If the entity exists in target and differs → detect conflicts
   * - Conflicts must be resolved manually before the version can be created
   *
   * Similar to `git cherry-pick`, this allows selectively applying specific changes
   * between branches without merging the entire branch history.
   *
   * Algorithm:
   * 1. Validate source version exists
   * 2. Validate target branch exists
   * 3. Decompress source version payload
   * 4. Resolve target version at source version's world time
   * 5. If target version exists:
   *    - Perform 2-way conflict detection (no common ancestor)
   *    - Apply resolutions if provided
   *    - Return conflict info if unresolved
   * 6. If no conflicts or target doesn't exist:
   *    - Create new version in target branch
   *    - Record audit log
   * 7. Return success result with created version
   *
   * Conflict Detection for Cherry-Pick:
   * Unlike 3-way merge, cherry-pick uses an empty base (no common ancestor), so any
   * property that differs between source and target is considered a conflict.
   *
   * @example
   * ```typescript
   * // Cherry-pick a specific version
   * const result = await mergeService.cherryPickVersion(
   *   'version-abc-123',
   *   'main',
   *   authenticatedUser,
   *   [] // No resolutions - will return conflicts if any
   * );
   *
   * if (result.hasConflict) {
   *   // Handle conflicts - retry with resolutions
   * } else {
   *   // Version successfully cherry-picked
   *   console.log(`Created version: ${result.versionCreated.id}`);
   * }
   * ```
   *
   * @param sourceVersionId - ID of the version to cherry-pick
   * @param targetBranchId - ID of the branch to apply the version to
   * @param user - User performing the cherry-pick operation
   * @param resolutions - Optional conflict resolutions (required if conflicts exist)
   * @returns Result indicating success, conflicts, and created version
   * @throws {NotFoundException} If source version does not exist
   * @throws {BadRequestException} If target branch does not exist
   * @throws {BadRequestException} If conflicts remain unresolved when resolutions provided
   */
  async cherryPickVersion(
    sourceVersionId: string,
    targetBranchId: string,
    user: AuthenticatedUser,
    resolutions: ConflictResolution[] = []
  ): Promise<CherryPickResult> {
    // Step 1: Validate source version exists
    const sourceVersion = await this.prisma.version.findUnique({
      where: { id: sourceVersionId },
    });

    if (!sourceVersion) {
      throw new NotFoundException(`Version ${sourceVersionId} not found`);
    }

    // Step 2: Validate target branch exists
    const targetBranch = await this.prisma.branch.findUnique({
      where: { id: targetBranchId },
    });

    if (!targetBranch) {
      throw new BadRequestException(`Target branch ${targetBranchId} not found`);
    }

    // Step 3: Get source payload
    const sourcePayload = await this.versionService.decompressVersion(sourceVersion);

    // Step 4: Get state of entity in target branch at source version's world time
    // This ensures we're comparing the same point in time across branches
    const targetVersion = await this.versionService.resolveVersion(
      sourceVersion.entityType,
      sourceVersion.entityId,
      targetBranchId,
      sourceVersion.validFrom // Use source version's world time for comparison
    );

    // Step 5: Detect conflicts if target has a version
    let conflicts: MergeConflict[] = [];
    let finalPayload = sourcePayload;

    if (targetVersion) {
      // Target branch has this entity - check for conflicts
      const targetPayload = await this.versionService.decompressVersion(targetVersion);

      // Use ConflictDetector to compare source and target
      // For cherry-pick, we use an empty base since there's no common ancestor
      // Any property that differs between source and target is a conflict
      const result = this.conflictDetector.detectPropertyConflicts(
        {}, // base (empty - no common ancestor for cherry-pick)
        sourcePayload, // source (what we want to apply)
        targetPayload // target (current state in target branch)
      );

      conflicts = result.conflicts;

      if (conflicts.length > 0 && resolutions.length > 0) {
        // Conflicts detected and resolutions were provided - apply them
        // Apply resolutions
        finalPayload = this.applyConflictResolutions(
          sourcePayload,
          conflicts,
          resolutions,
          sourceVersion.entityType,
          sourceVersion.entityId
        );

        // Verify all conflicts were resolved
        const unresolvedConflicts = this.findUnresolvedConflicts(
          [{ entityType: sourceVersion.entityType, entityId: sourceVersion.entityId, conflicts }],
          resolutions
        );

        if (unresolvedConflicts.length > 0) {
          throw new BadRequestException(
            `Cannot cherry-pick: ${unresolvedConflicts.length} conflict(s) remain unresolved, ` +
              `but not all conflicts have been resolved. Please provide resolutions for all conflicts.`
          );
        }
      }
    }

    // Step 6: If conflicts exist but not resolved, return conflict information
    if (conflicts.length > 0 && resolutions.length === 0) {
      return {
        success: false,
        hasConflict: true,
        conflicts,
      };
    }

    // Step 7: Create new version in target branch
    const createdVersion = await this.versionService.createVersion(
      {
        entityType: sourceVersion.entityType,
        entityId: sourceVersion.entityId,
        branchId: targetBranchId,
        validFrom: sourceVersion.validFrom,
        validTo: null,
        payload: finalPayload,
        comment: `Cherry-picked from version ${sourceVersionId}`,
      },
      user
    );

    // Step 8: Create audit log entry
    await this.audit.log(
      'version',
      `${sourceVersion.entityType}:${sourceVersion.entityId}`,
      'CHERRY_PICK',
      user.id,
      {
        sourceVersionId,
        sourceBranchId: sourceVersion.branchId,
        targetBranchId,
        worldTime: sourceVersion.validFrom.toISOString(),
        conflictsResolved: conflicts.length,
      }
    );

    return {
      success: true,
      hasConflict: false,
      versionCreated: createdVersion,
    };
  }
}
