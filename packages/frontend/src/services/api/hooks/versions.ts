import { gql } from '@apollo/client';
import {
  useQuery,
  useLazyQuery,
  useMutation,
  type QueryHookOptions,
  type LazyQueryHookOptions,
  type MutationHookOptions,
} from '@apollo/client/react';
import { useMemo } from 'react';

// TODO: Once code generation runs, import these types from generated file:
// import type {
//   EntityVersionsQuery,
//   EntityVersionsQueryVariables,
//   VersionDiffQuery,
//   VersionDiffQueryVariables,
//   RestoreVersionMutation,
//   RestoreVersionMutationVariables,
// } from '@/__generated__/graphql';

// Temporary placeholder types until code generation runs
export type Version = {
  id: string;
  entityType: string;
  entityId: string;
  branchId: string;
  validFrom: string;
  validTo?: string | null;
  payload: Record<string, unknown>;
  version: number;
  comment?: string | null;
  createdBy: string;
  createdAt: string;
};

export type VersionDiff = {
  added: Record<string, unknown>;
  modified: Record<string, { old: unknown; new: unknown }>;
  removed: Record<string, unknown>;
};

type EntityVersionsQuery = {
  entityVersions: Version[];
};

type EntityVersionsQueryVariables = {
  entityType: string;
  entityId: string;
  branchId: string;
};

type VersionDiffQuery = {
  versionDiff: VersionDiff;
};

type VersionDiffQueryVariables = {
  versionId1: string;
  versionId2: string;
};

type RestoreVersionInput = {
  versionId: string;
  branchId: string;
  worldTime?: Date | null;
  comment?: string | null;
};

type RestoreVersionMutation = {
  restoreVersion: Version;
};

type RestoreVersionMutationVariables = {
  input: RestoreVersionInput;
};

/**
 * GraphQL query to get version history for an entity.
 *
 * Fetches all versions of an entity within a specific branch, ordered by
 * validFrom (newest first). Payloads are automatically decompressed by the
 * backend before being returned.
 *
 * @param entityType - The type of entity (e.g., "settlement", "structure")
 * @param entityId - The ID of the entity
 * @param branchId - The branch ID to fetch versions from
 * @returns Array of Version objects with decompressed payloads
 */
export const ENTITY_VERSIONS = gql`
  query EntityVersions($entityType: String!, $entityId: ID!, $branchId: ID!) {
    entityVersions(entityType: $entityType, entityId: $entityId, branchId: $branchId) {
      id
      entityType
      entityId
      branchId
      validFrom
      validTo
      payload
      version
      comment
      createdBy
      createdAt
    }
  }
`;

/**
 * GraphQL query to compute diff between two versions.
 *
 * Compares two versions and returns structured diff showing added, modified,
 * and removed fields. Both versions must belong to the same campaign (checked
 * via authorization).
 *
 * @param versionId1 - The ID of the first version (older)
 * @param versionId2 - The ID of the second version (newer)
 * @returns VersionDiff with added/modified/removed fields
 */
export const VERSION_DIFF = gql`
  query VersionDiff($versionId1: ID!, $versionId2: ID!) {
    versionDiff(versionId1: $versionId1, versionId2: $versionId2) {
      added
      modified
      removed
    }
  }
`;

/**
 * GraphQL mutation to restore an entity to a previous version.
 *
 * Creates a new version with the payload from a historical version. This is
 * an immutable operation - the old versions are preserved and a new version
 * is created as the current state.
 *
 * @param input.versionId - The ID of the version to restore from
 * @param input.branchId - The branch to restore the version in
 * @param input.worldTime - Optional world-time for the restored version (defaults to now)
 * @param input.comment - Optional comment describing the restoration
 * @returns The newly created version
 */
export const RESTORE_VERSION = gql`
  mutation RestoreVersion($input: RestoreVersionInput!) {
    restoreVersion(input: $input) {
      id
      entityType
      entityId
      branchId
      validFrom
      validTo
      payload
      version
      comment
      createdBy
      createdAt
    }
  }
`;

/**
 * Hook to fetch version history for a specific entity.
 *
 * Uses cache-first fetch policy for performance. Versions are automatically
 * sorted by validFrom (newest first) on the backend.
 *
 * @param entityType - The type of entity (e.g., "settlement", "structure")
 * @param entityId - The ID of the entity
 * @param branchId - The branch ID to fetch versions from
 * @param options - Additional Apollo query options (skip, onCompleted, onError, etc.)
 * @returns Query result with versions data, loading state, and error state
 *
 * @example
 * ```tsx
 * function VersionHistory({ entityType, entityId, branchId }: Props) {
 *   const { versions, loading, error, refetch } = useEntityVersions(
 *     entityType,
 *     entityId,
 *     branchId
 *   );
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorAlert message={error.message} />;
 *   if (versions.length === 0) return <EmptyState />;
 *
 *   return (
 *     <ul>
 *       {versions.map(version => (
 *         <li key={version.id}>
 *           {new Date(version.createdAt).toLocaleString()}: {version.comment}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useEntityVersions(
  entityType: string,
  entityId: string,
  branchId: string,
  options?: Omit<QueryHookOptions<EntityVersionsQuery, EntityVersionsQueryVariables>, 'variables'>
) {
  const result = useQuery<EntityVersionsQuery, EntityVersionsQueryVariables>(ENTITY_VERSIONS, {
    variables: { entityType, entityId, branchId },
    fetchPolicy: 'cache-first', // Use cached data for performance
    ...options,
  });

  // Return a simplified data shape for easier consumption
  return useMemo(
    () => ({
      versions: result.data?.entityVersions ?? [],
      loading: result.loading,
      error: result.error,
      refetch: result.refetch,
      networkStatus: result.networkStatus,
    }),
    [result.data, result.loading, result.error, result.refetch, result.networkStatus]
  );
}

/**
 * Hook to compute diff between two versions (lazy query).
 *
 * This is a lazy query hook that doesn't execute immediately. Call the returned
 * `compareVersions` function to trigger diff computation. Always fetches fresh
 * data from the server (network-only policy).
 *
 * Useful for on-demand version comparison and displaying changes before restore
 * operations.
 *
 * @param options - Additional Apollo lazy query options (onCompleted, onError, etc.)
 * @returns Tuple with [compareVersions function, query result]
 *
 * @example
 * ```tsx
 * function VersionComparison({ versionId1, versionId2 }: Props) {
 *   const [compareVersions, { data, loading, error }] = useCompareVersions();
 *
 *   const handleCompare = async () => {
 *     await compareVersions({
 *       variables: {
 *         versionId1,
 *         versionId2
 *       }
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleCompare}>Compare Versions</button>
 *       {loading && <Spinner />}
 *       {error && <ErrorAlert message={error.message} />}
 *       {data && (
 *         <div>
 *           <h3>Added Fields</h3>
 *           <pre>{JSON.stringify(data.versionDiff.added, null, 2)}</pre>
 *           <h3>Modified Fields</h3>
 *           <pre>{JSON.stringify(data.versionDiff.modified, null, 2)}</pre>
 *           <h3>Removed Fields</h3>
 *           <pre>{JSON.stringify(data.versionDiff.removed, null, 2)}</pre>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useCompareVersions(
  options?: LazyQueryHookOptions<VersionDiffQuery, VersionDiffQueryVariables>
) {
  return useLazyQuery<VersionDiffQuery, VersionDiffQueryVariables>(VERSION_DIFF, {
    fetchPolicy: 'network-only', // Always fetch fresh diff results
    ...options,
  });
}

/**
 * Hook to restore an entity to a previous version.
 *
 * Creates a new version with the payload from a historical version. The
 * mutation uses optimistic updates and automatically invalidates the version
 * list cache to trigger a refetch.
 *
 * @param options - Additional Apollo mutation options (onCompleted, onError, etc.)
 * @returns Tuple with [restoreVersion function, mutation result]
 *
 * @example
 * ```tsx
 * function RestoreButton({ versionId, branchId }: Props) {
 *   const [restoreVersion, { loading, error }] = useRestoreVersion({
 *     onCompleted: (data) => {
 *       toast.success('Version restored successfully!');
 *     },
 *     onError: (error) => {
 *       toast.error(`Failed to restore: ${error.message}`);
 *     }
 *   });
 *
 *   const handleRestore = async () => {
 *     await restoreVersion({
 *       variables: {
 *         input: {
 *           versionId,
 *           branchId,
 *           comment: 'Restored from history'
 *         }
 *       }
 *     });
 *   };
 *
 *   return (
 *     <button onClick={handleRestore} disabled={loading}>
 *       {loading ? 'Restoring...' : 'Restore Version'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useRestoreVersion(
  options?: MutationHookOptions<RestoreVersionMutation, RestoreVersionMutationVariables>
) {
  const [mutate, result] = useMutation<RestoreVersionMutation, RestoreVersionMutationVariables>(
    RESTORE_VERSION,
    {
      // Refetch version history after restore
      refetchQueries: ['EntityVersions'],
      // Invalidate any cached version data
      awaitRefetchQueries: true,
      ...options,
    }
  );

  return [mutate, result] as const;
}
