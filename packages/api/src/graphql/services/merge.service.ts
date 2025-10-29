import { Injectable } from '@nestjs/common';
import type { Branch as PrismaBranch, Version } from '@prisma/client';

import { BranchService } from './branch.service';
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
 * Service for handling branch merges with 3-way merge algorithm
 * and conflict detection/resolution.
 */
@Injectable()
export class MergeService {
  constructor(
    private readonly branchService: BranchService,
    private readonly versionService: VersionService
  ) {}

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
    // Fetch all three versions in parallel for performance
    const [base, source, target] = await Promise.all([
      this.versionService.resolveVersion(entityType, entityId, baseBranchId, worldTime),
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
    _basePayload: Record<string, unknown> | null,
    sourcePayload: Record<string, unknown> | null,
    _targetPayload: Record<string, unknown> | null
  ): MergeResult {
    // This is a placeholder implementation for Stage 1
    // Full implementation will be done in Stage 2 (Conflict Detection Logic)
    return {
      success: true,
      conflicts: [],
      mergedPayload: sourcePayload,
      conflictDetails: [],
    };
  }
}
