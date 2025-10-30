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

// Export types for convenience
export type {
  PreviewMergeQuery,
  PreviewMergeQueryVariables,
  ExecuteMergeMutation,
  ExecuteMergeMutationVariables,
};
