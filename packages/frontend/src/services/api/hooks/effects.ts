import { gql } from '@apollo/client';
import { useQuery, type QueryHookOptions } from '@apollo/client/react';
import { useMemo } from 'react';

// TODO: Once code generation runs, import these types from generated file:
// import type {
//   GetEffectsForEntityQuery,
//   GetEffectsForEntityQueryVariables,
//   EffectTiming,
// } from '@/__generated__/graphql';

// Temporary placeholder types until code generation runs
export enum EffectTiming {
  PRE = 'PRE',
  ON_RESOLVE = 'ON_RESOLVE',
  POST = 'POST',
}

type EffectExecution = {
  id: string;
  effectId: string;
  executedAt: string;
  status: string;
  patchApplied: unknown;
  error?: string | null;
};

type Effect = {
  id: string;
  name: string;
  description?: string | null;
  effectType: string;
  payload: Record<string, unknown>;
  entityType: string;
  entityId: string;
  timing: EffectTiming;
  priority: number;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  executions?: EffectExecution[];
};

type GetEffectsForEntityQuery = {
  getEffectsForEntity: Effect[];
};

type GetEffectsForEntityQueryVariables = {
  entityType: string;
  entityId: string;
  timing: EffectTiming;
};

/**
 * GraphQL query to get all effects for a specific entity and timing phase.
 *
 * This query fetches all effects that belong to an entity at a specific timing
 * phase (PRE, ON_RESOLVE, POST). Each effect contains JSON Patch operations
 * that will be applied when the entity resolves.
 *
 * @param entityType - The type of entity (e.g., "encounter", "event")
 * @param entityId - The ID of the entity instance
 * @param timing - The timing phase to filter effects (PRE, ON_RESOLVE, POST)
 * @returns Array of Effect objects
 */
export const GET_EFFECTS_FOR_ENTITY = gql`
  query GetEffectsForEntity($entityType: String!, $entityId: ID!, $timing: EffectTiming!) {
    getEffectsForEntity(entityType: $entityType, entityId: $entityId, timing: $timing) {
      id
      name
      description
      effectType
      payload
      entityType
      entityId
      timing
      priority
      isActive
      version
      createdAt
      updatedAt
      deletedAt
    }
  }
`;

/**
 * GraphQL query to get all effects for an entity across all timing phases,
 * including execution history.
 *
 * This query is more comprehensive than GET_EFFECTS_FOR_ENTITY as it doesn't
 * filter by timing phase and includes the execution history for each effect.
 * Useful for displaying complete effect information in the entity inspector.
 *
 * @param entityType - The type of entity (e.g., "encounter", "event")
 * @param entityId - The ID of the entity instance
 * @returns Array of Effect objects with execution history
 */
export const GET_ALL_EFFECTS_FOR_ENTITY = gql`
  query GetAllEffectsForEntity($entityType: String!, $entityId: ID!) {
    getEffectsForEntity(entityType: $entityType, entityId: $entityId, timing: PRE) {
      id
      name
      description
      effectType
      payload
      entityType
      entityId
      timing
      priority
      isActive
      version
      createdAt
      updatedAt
      deletedAt
      executions {
        id
        effectId
        executedAt
        status
        patchApplied
        error
      }
    }
    onResolve: getEffectsForEntity(
      entityType: $entityType
      entityId: $entityId
      timing: ON_RESOLVE
    ) {
      id
      name
      description
      effectType
      payload
      entityType
      entityId
      timing
      priority
      isActive
      version
      createdAt
      updatedAt
      deletedAt
      executions {
        id
        effectId
        executedAt
        status
        patchApplied
        error
      }
    }
    post: getEffectsForEntity(entityType: $entityType, entityId: $entityId, timing: POST) {
      id
      name
      description
      effectType
      payload
      entityType
      entityId
      timing
      priority
      isActive
      version
      createdAt
      updatedAt
      deletedAt
      executions {
        id
        effectId
        executedAt
        status
        patchApplied
        error
      }
    }
  }
`;

/**
 * Hook to fetch effects for a specific entity and timing phase.
 *
 * Uses cache-first fetch policy for performance. Returns effects sorted by
 * priority (lower values execute first).
 *
 * @param entityType - The type of entity (e.g., "encounter", "event")
 * @param entityId - The ID of the entity instance
 * @param timing - The timing phase to filter effects (PRE, ON_RESOLVE, POST)
 * @param options - Additional Apollo query options (skip, onCompleted, onError, etc.)
 * @returns Query result with effects data, loading state, and error state
 *
 * @example
 * ```tsx
 * function EntityEffectsList({ entityType, entityId, timing }: Props) {
 *   const { effects, loading, error, refetch } = useEffectsForEntity(
 *     entityType,
 *     entityId,
 *     EffectTiming.ON_RESOLVE
 *   );
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorAlert message={error.message} />;
 *   if (effects.length === 0) return <EmptyState />;
 *
 *   return (
 *     <ul>
 *       {effects.map(effect => (
 *         <li key={effect.id}>
 *           {effect.name} (Priority: {effect.priority})
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useEffectsForEntity(
  entityType: string,
  entityId: string,
  timing: EffectTiming,
  options?: Omit<
    QueryHookOptions<GetEffectsForEntityQuery, GetEffectsForEntityQueryVariables>,
    'variables'
  >
) {
  const result = useQuery<GetEffectsForEntityQuery, GetEffectsForEntityQueryVariables>(
    GET_EFFECTS_FOR_ENTITY,
    {
      variables: { entityType, entityId, timing },
      fetchPolicy: 'cache-first', // Use cached data for performance
      ...options,
    }
  );

  // Return a simplified data shape for easier consumption
  return useMemo(
    () => ({
      effects: result.data?.getEffectsForEntity ?? [],
      loading: result.loading,
      error: result.error,
      refetch: result.refetch,
      networkStatus: result.networkStatus,
    }),
    [result.data, result.loading, result.error, result.refetch, result.networkStatus]
  );
}

/**
 * Hook to fetch all effects for an entity across all timing phases.
 *
 * This hook fetches effects from all three timing phases (PRE, ON_RESOLVE, POST)
 * in a single query and returns them grouped by phase. Also includes execution
 * history for each effect.
 *
 * Uses cache-first fetch policy for performance.
 *
 * @param entityType - The type of entity (e.g., "encounter", "event")
 * @param entityId - The ID of the entity instance
 * @param options - Additional Apollo query options (skip, onCompleted, onError, etc.)
 * @returns Query result with effects grouped by timing phase, loading state, and error state
 *
 * @example
 * ```tsx
 * function EntityAllEffects({ entityType, entityId }: Props) {
 *   const { preEffects, onResolveEffects, postEffects, loading, error } =
 *     useAllEffectsForEntity(entityType, entityId);
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorAlert message={error.message} />;
 *
 *   return (
 *     <div>
 *       <h2>Pre-Resolution Effects</h2>
 *       <EffectsList effects={preEffects} />
 *
 *       <h2>On Resolution Effects</h2>
 *       <EffectsList effects={onResolveEffects} />
 *
 *       <h2>Post-Resolution Effects</h2>
 *       <EffectsList effects={postEffects} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useAllEffectsForEntity(
  entityType: string,
  entityId: string,
  options?: Omit<
    QueryHookOptions<
      {
        getEffectsForEntity: Effect[];
        onResolve: Effect[];
        post: Effect[];
      },
      { entityType: string; entityId: string }
    >,
    'variables'
  >
) {
  const result = useQuery<
    {
      getEffectsForEntity: Effect[];
      onResolve: Effect[];
      post: Effect[];
    },
    { entityType: string; entityId: string }
  >(GET_ALL_EFFECTS_FOR_ENTITY, {
    variables: { entityType, entityId },
    fetchPolicy: 'cache-first', // Use cached data for performance
    ...options,
  });

  // Return a simplified data shape for easier consumption
  return useMemo(
    () => ({
      preEffects: result.data?.getEffectsForEntity ?? [],
      onResolveEffects: result.data?.onResolve ?? [],
      postEffects: result.data?.post ?? [],
      allEffects: [
        ...(result.data?.getEffectsForEntity ?? []),
        ...(result.data?.onResolve ?? []),
        ...(result.data?.post ?? []),
      ],
      loading: result.loading,
      error: result.error,
      refetch: result.refetch,
      networkStatus: result.networkStatus,
    }),
    [result.data, result.loading, result.error, result.refetch, result.networkStatus]
  );
}
