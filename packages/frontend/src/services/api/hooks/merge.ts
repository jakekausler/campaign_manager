import { gql } from '@apollo/client';
import {
  useQuery,
  useMutation,
  type QueryHookOptions,
  type MutationHookOptions,
} from '@apollo/client/react';

// TODO: Once backend is fixed and code generation runs, import these types from generated file:
// import type {
//   PreviewMergeQuery,
//   PreviewMergeQueryVariables,
//   ExecuteMergeMutation,
//   ExecuteMergeMutationVariables,
// } from '@/__generated__/graphql';

// Temporary placeholder types until code generation runs

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

/**
 * Merge conflict information
 */
export type MergeConflict = {
  /** JSON path to the conflicting property (e.g., "resources.gold") */
  path: string;
  /** Type of conflict */
  type: string;
  /** Human-readable conflict description */
  description: string;
  /** Suggested resolution (if applicable) */
  suggestion?: string | null;
  /** Value from common ancestor (base), JSON-stringified */
  baseValue?: string | null;
  /** Value from source branch, JSON-stringified */
  sourceValue?: string | null;
  /** Value from target branch, JSON-stringified */
  targetValue?: string | null;
};

/**
 * Auto-resolved change information
 */
export type AutoResolvedChange = {
  /** JSON path to the auto-resolved property */
  path: string;
  /** Which branch value was used: "source", "target", "base", or "both" */
  resolvedTo: string;
  /** Value from common ancestor (base), JSON-stringified */
  baseValue?: string | null;
  /** Value from source branch, JSON-stringified */
  sourceValue?: string | null;
  /** Value from target branch, JSON-stringified */
  targetValue?: string | null;
  /** The resolved value, JSON-stringified */
  resolvedValue: string;
};

/**
 * Entity merge preview information
 */
export type EntityMergePreview = {
  /** Entity ID */
  entityId: string;
  /** Entity type (e.g., "settlement", "structure") */
  entityType: string;
  /** Conflicts for this entity */
  conflicts: MergeConflict[];
  /** Auto-resolved changes for this entity */
  autoResolvedChanges: AutoResolvedChange[];
};

/**
 * Complete merge preview
 */
export type MergePreview = {
  /** Source branch ID */
  sourceBranchId: string;
  /** Target branch ID */
  targetBranchId: string;
  /** Common ancestor branch ID */
  commonAncestorId?: string | null;
  /** Merge preview for each entity */
  entities: EntityMergePreview[];
  /** Total number of conflicts across all entities */
  totalConflicts: number;
  /** Total number of auto-resolved changes across all entities */
  totalAutoResolved: number;
  /** Whether merge requires manual conflict resolution */
  requiresManualResolution: boolean;
};

/**
 * Merge result information
 */
export type MergeResult = {
  /** Whether the merge was successful */
  success: boolean;
  /** Number of entity versions created in target branch */
  versionsCreated: number;
  /** IDs of entities that were merged */
  mergedEntityIds: string[];
  /** Error message if merge failed */
  error?: string | null;
};

/**
 * Input for previewing a merge operation
 */
export type PreviewMergeInput = {
  /** Source branch ID */
  sourceBranchId: string;
  /** Target branch ID */
  targetBranchId: string;
  /** World time at which to perform the merge */
  worldTime: string;
};

/**
 * Conflict resolution for a specific property
 */
export type ConflictResolution = {
  /** Entity ID */
  entityId: string;
  /** Entity type */
  entityType: string;
  /** JSON path to the property */
  path: string;
  /** Resolved value, JSON-stringified */
  resolvedValue: string;
};

/**
 * Input for executing a merge operation
 */
export type ExecuteMergeInput = {
  /** Source branch ID */
  sourceBranchId: string;
  /** Target branch ID */
  targetBranchId: string;
  /** World time at which to perform the merge */
  worldTime: string;
  /** Manual conflict resolutions */
  resolutions: ConflictResolution[];
};

type PreviewMergeQuery = {
  previewMerge: MergePreview;
};

type PreviewMergeQueryVariables = {
  input: PreviewMergeInput;
};

type ExecuteMergeMutation = {
  executeMerge: MergeResult;
};

type ExecuteMergeMutationVariables = {
  input: ExecuteMergeInput;
};

/**
 * GraphQL query to preview a merge operation.
 *
 * This query analyzes the differences between two branches and returns
 * all conflicts and auto-resolved changes without actually performing
 * the merge operation.
 *
 * @example
 * Query:
 * ```graphql
 * query PreviewMerge($input: PreviewMergeInput!) {
 *   previewMerge(input: $input) {
 *     sourceBranchId
 *     targetBranchId
 *     commonAncestorId
 *     totalConflicts
 *     totalAutoResolved
 *     requiresManualResolution
 *     entities {
 *       entityId
 *       entityType
 *       conflicts {
 *         path
 *         type
 *         description
 *         suggestion
 *         baseValue
 *         sourceValue
 *         targetValue
 *       }
 *       autoResolvedChanges {
 *         path
 *         resolvedTo
 *         baseValue
 *         sourceValue
 *         targetValue
 *         resolvedValue
 *       }
 *     }
 *   }
 * }
 * ```
 */
export const PREVIEW_MERGE = gql`
  query PreviewMerge($input: PreviewMergeInput!) {
    previewMerge(input: $input) {
      sourceBranchId
      targetBranchId
      commonAncestorId
      totalConflicts
      totalAutoResolved
      requiresManualResolution
      entities {
        entityId
        entityType
        conflicts {
          path
          type
          description
          suggestion
          baseValue
          sourceValue
          targetValue
        }
        autoResolvedChanges {
          path
          resolvedTo
          baseValue
          sourceValue
          targetValue
          resolvedValue
        }
      }
    }
  }
`;

/**
 * GraphQL mutation to execute a merge operation.
 *
 * This mutation performs the actual merge, creating new versions in the
 * target branch for all modified entities. Requires all conflicts to be
 * resolved via the resolutions input.
 *
 * @example
 * Mutation:
 * ```graphql
 * mutation ExecuteMerge($input: ExecuteMergeInput!) {
 *   executeMerge(input: $input) {
 *     success
 *     versionsCreated
 *     mergedEntityIds
 *     error
 *   }
 * }
 * ```
 */
export const EXECUTE_MERGE = gql`
  mutation ExecuteMerge($input: ExecuteMergeInput!) {
    executeMerge(input: $input) {
      success
      versionsCreated
      mergedEntityIds
      error
    }
  }
`;

/**
 * React hook to preview a merge operation.
 *
 * Analyzes differences between two branches and returns all conflicts
 * and auto-resolved changes without actually performing the merge.
 *
 * @param input - Merge preview input (sourceBranchId, targetBranchId, worldTime)
 * @param options - Additional Apollo query options
 * @returns Query result with merge preview data, loading state, and error
 *
 * @example
 * ```typescript
 * function MergePreviewDialog({ sourceBranchId, targetBranchId }: Props) {
 *   const { campaign } = useCampaignStore();
 *   const { data, loading, error } = usePreviewMerge({
 *     sourceBranchId,
 *     targetBranchId,
 *     worldTime: campaign.currentWorldTime
 *   });
 *
 *   if (loading) return <div>Analyzing merge...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   const preview = data?.previewMerge;
 *   if (!preview) return null;
 *
 *   return (
 *     <div>
 *       <h2>Merge Preview</h2>
 *       <p>Total conflicts: {preview.totalConflicts}</p>
 *       <p>Auto-resolved: {preview.totalAutoResolved}</p>
 *       {preview.requiresManualResolution && (
 *         <p>Manual resolution required</p>
 *       )}
 *       {preview.entities.map(entity => (
 *         <EntityPreview key={entity.entityId} entity={entity} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePreviewMerge(
  input: PreviewMergeInput,
  options?: Omit<QueryHookOptions<PreviewMergeQuery, PreviewMergeQueryVariables>, 'variables'>
) {
  return useQuery<PreviewMergeQuery, PreviewMergeQueryVariables>(PREVIEW_MERGE, {
    ...options,
    variables: { input },
    skip: !input.sourceBranchId || !input.targetBranchId || !input.worldTime || options?.skip,
  });
}

/**
 * React hook to execute a merge operation.
 *
 * Performs the actual merge, creating new versions in the target branch
 * for all modified entities. Requires all conflicts to be resolved.
 *
 * @param options - Additional Apollo mutation options
 * @returns Mutation function and result state
 *
 * @example
 * ```typescript
 * function MergeExecutionDialog({ preview }: Props) {
 *   const [executeMerge, { loading, data, error }] = useExecuteMerge({
 *     onCompleted: (result) => {
 *       console.log(`Merge complete! Created ${result.executeMerge.versionsCreated} versions`);
 *       // Refetch branch data to show updated state
 *     },
 *     refetchQueries: ['GetBranchHierarchy', 'GetBranch'],
 *     awaitRefetchQueries: true,
 *   });
 *
 *   const handleExecute = async (resolutions: ConflictResolution[]) => {
 *     await executeMerge({
 *       variables: {
 *         input: {
 *           sourceBranchId: preview.sourceBranchId,
 *           targetBranchId: preview.targetBranchId,
 *           worldTime: currentWorldTime,
 *           resolutions,
 *         }
 *       }
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={() => handleExecute(resolvedConflicts)} disabled={loading}>
 *         {loading ? 'Merging...' : 'Execute Merge'}
 *       </button>
 *       {error && <div>Error: {error.message}</div>}
 *       {data?.executeMerge.success && (
 *         <div>Success! {data.executeMerge.versionsCreated} versions created</div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useExecuteMerge(
  options?: MutationHookOptions<ExecuteMergeMutation, ExecuteMergeMutationVariables>
) {
  return useMutation<ExecuteMergeMutation, ExecuteMergeMutationVariables>(EXECUTE_MERGE, options);
}

/**
 * Cherry-pick result information
 */
export type CherryPickResult = {
  /** Whether the cherry-pick was successful */
  success: boolean;
  /** Whether conflicts were detected */
  hasConflict: boolean;
  /** Conflicts detected during cherry-pick (if any) */
  conflicts?: MergeConflict[];
  /** ID of the version created in target branch (if no conflicts) */
  versionId?: string;
  /** Error message if cherry-pick failed */
  error?: string;
};

/**
 * Input for cherry-picking a version
 */
export type CherryPickVersionInput = {
  /** ID of the version to cherry-pick */
  sourceVersionId: string;
  /** ID of the branch to apply the version to */
  targetBranchId: string;
  /** Manual resolutions for conflicts (required if conflicts exist) */
  resolutions?: ConflictResolution[];
};

type CherryPickVersionMutation = {
  cherryPickVersion: CherryPickResult;
};

type CherryPickVersionMutationVariables = {
  input: CherryPickVersionInput;
};

/**
 * GraphQL mutation to cherry-pick a specific version.
 *
 * This mutation selectively applies a single version from one branch to
 * another branch. If conflicts are detected, they must be resolved via
 * the resolutions input before the version can be applied.
 *
 * @example
 * Mutation:
 * ```graphql
 * mutation CherryPickVersion($input: CherryPickVersionInput!) {
 *   cherryPickVersion(input: $input) {
 *     success
 *     hasConflict
 *     conflicts {
 *       path
 *       type
 *       description
 *       suggestion
 *       baseValue
 *       sourceValue
 *       targetValue
 *     }
 *     versionId
 *     error
 *   }
 * }
 * ```
 */
export const CHERRY_PICK_VERSION = gql`
  mutation CherryPickVersion($input: CherryPickVersionInput!) {
    cherryPickVersion(input: $input) {
      success
      hasConflict
      conflicts {
        path
        type
        description
        suggestion
        baseValue
        sourceValue
        targetValue
      }
      versionId
      error
    }
  }
`;

/**
 * React hook to cherry-pick a specific version to another branch.
 *
 * Selectively applies a single entity version from one branch to another.
 * If conflicts are detected, they must be resolved before the operation
 * completes successfully.
 *
 * @param options - Additional Apollo mutation options
 * @returns Mutation function and result state
 *
 * @example
 * ```typescript
 * function VersionHistoryItem({ version, targetBranch }: Props) {
 *   const [cherryPick, { loading, data, error }] = useCherryPickVersion({
 *     onCompleted: (result) => {
 *       if (result.cherryPickVersion.success && !result.cherryPickVersion.hasConflict) {
 *         console.log(`Cherry-pick complete! Version ID: ${result.cherryPickVersion.versionId}`);
 *       } else if (result.cherryPickVersion.hasConflict) {
 *         console.log(`Conflicts detected: ${result.cherryPickVersion.conflicts?.length}`);
 *         // Open conflict resolution dialog
 *       }
 *     },
 *     refetchQueries: ['GetBranchVersions', 'GetBranch'],
 *     awaitRefetchQueries: true,
 *   });
 *
 *   const handleCherryPick = async (resolutions?: ConflictResolution[]) => {
 *     await cherryPick({
 *       variables: {
 *         input: {
 *           sourceVersionId: version.id,
 *           targetBranchId: targetBranch.id,
 *           resolutions,
 *         }
 *       }
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={() => handleCherryPick()} disabled={loading}>
 *         {loading ? 'Cherry-picking...' : 'Cherry-Pick to Branch'}
 *       </button>
 *       {error && <div>Error: {error.message}</div>}
 *       {data?.cherryPickVersion.hasConflict && (
 *         <ConflictResolutionDialog
 *           conflicts={data.cherryPickVersion.conflicts || []}
 *           onResolve={(resolutions) => handleCherryPick(resolutions)}
 *         />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useCherryPickVersion(
  options?: MutationHookOptions<CherryPickVersionMutation, CherryPickVersionMutationVariables>
) {
  return useMutation<CherryPickVersionMutation, CherryPickVersionMutationVariables>(
    CHERRY_PICK_VERSION,
    options
  );
}

/**
 * Branch information nested in merge history
 */
export type BranchInfo = {
  /** Branch ID */
  id: string;
  /** Branch name */
  name: string;
  /** Branch description */
  description?: string;
  /** Parent branch ID */
  parentId?: string;
  /** Campaign ID */
  campaignId: string;
  /** World time when branch diverged from parent */
  divergedAt?: string;
  /** Branch color for UI visualization */
  color?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Soft deletion timestamp */
  deletedAt?: string;
};

/**
 * Merge history entry information
 */
export type MergeHistoryEntry = {
  /** Unique identifier for this merge history entry */
  id: string;
  /** ID of the source branch that was merged from */
  sourceBranchId: string;
  /** Source branch that was merged from */
  sourceBranch: BranchInfo;
  /** ID of the target branch that was merged into */
  targetBranchId: string;
  /** Target branch that was merged into */
  targetBranch: BranchInfo;
  /** ID of the common ancestor branch at time of merge */
  commonAncestorId: string;
  /** World time at which the merge was performed */
  worldTime: string;
  /** ID of the user who performed the merge */
  mergedBy: string;
  /** System timestamp when merge completed */
  mergedAt: string;
  /** Number of conflicts that were manually resolved */
  conflictsCount: number;
  /** Number of entities that had versions created */
  entitiesMerged: number;
  /** Conflict resolutions applied (for audit trail) */
  resolutionsData: Record<string, unknown>;
  /** Additional context (merge strategy, notes, etc.) */
  metadata: Record<string, unknown>;
};

type GetMergeHistoryQuery = {
  getMergeHistory: MergeHistoryEntry[];
};

type GetMergeHistoryQueryVariables = {
  branchId: string;
};

/**
 * GraphQL query to retrieve merge history for a branch.
 *
 * Returns all merge operations where the specified branch was either
 * the source or target, sorted by most recent first.
 *
 * @example
 * Query:
 * ```graphql
 * query GetMergeHistory($branchId: ID!) {
 *   getMergeHistory(branchId: $branchId) {
 *     id
 *     sourceBranchId
 *     sourceBranch {
 *       id
 *       name
 *       color
 *     }
 *     targetBranchId
 *     targetBranch {
 *       id
 *       name
 *       color
 *     }
 *     commonAncestorId
 *     worldTime
 *     mergedBy
 *     mergedAt
 *     conflictsCount
 *     entitiesMerged
 *     resolutionsData
 *     metadata
 *   }
 * }
 * ```
 */
export const GET_MERGE_HISTORY = gql`
  query GetMergeHistory($branchId: ID!) {
    getMergeHistory(branchId: $branchId) {
      id
      sourceBranchId
      sourceBranch {
        id
        name
        description
        parentId
        campaignId
        divergedAt
        color
        createdAt
        deletedAt
      }
      targetBranchId
      targetBranch {
        id
        name
        description
        parentId
        campaignId
        divergedAt
        color
        createdAt
        deletedAt
      }
      commonAncestorId
      worldTime
      mergedBy
      mergedAt
      conflictsCount
      entitiesMerged
      resolutionsData
      metadata
    }
  }
`;

/**
 * React hook to retrieve merge history for a specific branch.
 *
 * Returns all merge operations where the branch was either the source
 * or target, including full details about conflicts, resolutions, and
 * affected entities.
 *
 * @param branchId - ID of the branch to get merge history for
 * @param options - Additional Apollo query options
 * @returns Query result with merge history data, loading state, and error
 *
 * @example
 * ```typescript
 * function MergeHistoryPanel({ branchId }: Props) {
 *   const { data, loading, error } = useGetMergeHistory(branchId, {
 *     pollInterval: 30000, // Refresh every 30 seconds
 *   });
 *
 *   if (loading) return <div>Loading merge history...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   const history = data?.getMergeHistory ?? [];
 *
 *   return (
 *     <div>
 *       <h2>Merge History</h2>
 *       {history.length === 0 ? (
 *         <p>No merge operations yet</p>
 *       ) : (
 *         <ul>
 *           {history.map(entry => (
 *             <li key={entry.id}>
 *               <strong>{entry.sourceBranch.name}</strong> → <strong>{entry.targetBranch.name}</strong>
 *               <br />
 *               {new Date(entry.mergedAt).toLocaleString()}
 *               <br />
 *               {entry.entitiesMerged} entities merged, {entry.conflictsCount} conflicts resolved
 *             </li>
 *           ))}
 *         </ul>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useGetMergeHistory(
  branchId: string,
  options?: Omit<QueryHookOptions<GetMergeHistoryQuery, GetMergeHistoryQueryVariables>, 'variables'>
) {
  return useQuery<GetMergeHistoryQuery, GetMergeHistoryQueryVariables>(GET_MERGE_HISTORY, {
    ...options,
    variables: { branchId },
    skip: !branchId || options?.skip,
  });
}

// Export types for convenience
export type {
  PreviewMergeQuery,
  PreviewMergeQueryVariables,
  ExecuteMergeMutation,
  ExecuteMergeMutationVariables,
  CherryPickVersionMutation,
  CherryPickVersionMutationVariables,
  GetMergeHistoryQuery,
  GetMergeHistoryQueryVariables,
};
