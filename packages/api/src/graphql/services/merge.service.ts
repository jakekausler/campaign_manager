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
 */
@Injectable()
export class MergeService {
  private readonly conflictDetector: ConflictDetector;

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
   * Algorithm:
   * 1. Get full ancestry chain for both branches (root to branch)
   * 2. Find the last (most recent) common branch in both chains
   *
   * @param sourceBranchId - ID of the source branch
   * @param targetBranchId - ID of the target branch
   * @returns The common ancestor branch, or null if no common ancestor exists
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
   * Algorithm:
   * 1. Find which branch(es) are direct descendants of the common ancestor
   * 2. Use the divergedAt time from the descendant branch(es)
   * 3. If both branches diverged from the common ancestor, use the earlier divergence time
   *
   * @param sourceBranchId - ID of source branch
   * @param targetBranchId - ID of target branch
   * @param baseBranchId - ID of common ancestor branch
   * @returns The divergence time to use for resolving the base version
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
   * - base: version from common ancestor
   * - source: version from source branch
   * - target: version from target branch
   *
   * Any of these may be null if the entity doesn't exist in that branch
   * at the given world time.
   *
   * @param entityType - Type of entity (e.g., "settlement", "structure")
   * @param entityId - ID of the entity
   * @param sourceBranchId - ID of source branch
   * @param targetBranchId - ID of target branch
   * @param baseBranchId - ID of common ancestor branch
   * @param worldTime - World time at which to resolve versions
   * @returns Object containing base, source, and target versions
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
   * This is the core of the 3-way merge algorithm:
   * - If only source changed: auto-resolve to source value
   * - If only target changed: auto-resolve to target value
   * - If both changed: conflict requiring manual resolution
   * - If neither changed: keep base value
   *
   * @param basePayload - Payload from common ancestor
   * @param sourcePayload - Payload from source branch
   * @param targetPayload - Payload from target branch
   * @returns MergeResult with auto-resolved payload or conflicts
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
   * Generate a human-readable description of a conflict
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
   * Generate a suggested resolution for a conflict (if applicable)
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
   * This method uses a two-pass approach for efficiency and correctness:
   * PASS 1: Analyze all entities, detect conflicts, collect merge data
   * PASS 2: After validation, create versions atomically
   *
   * Steps:
   * 1. Discovers all entities that exist in source or target branches
   * 2. For each entity, performs 3-way merge to detect conflicts (no DB writes)
   * 3. Validates ALL conflicts have resolutions before any DB writes
   * 4. Creates new versions in target branch for all affected entities
   * 5. Records merge history and audit log entries
   *
   * The entire operation is wrapped in a database transaction for atomicity.
   *
   * @param params - Merge execution parameters
   * @returns Result with success status, versions created count, and merged entity IDs
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
   * Set a value at a nested path in an object (e.g., "resources.gold" = 100)
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
   * @param sourceVersionId - ID of the version to cherry-pick
   * @param targetBranchId - ID of the branch to apply the version to
   * @param user - User performing the cherry-pick operation
   * @param resolutions - Optional conflict resolutions (required if conflicts exist)
   * @returns Result indicating success, conflicts, and created version
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
