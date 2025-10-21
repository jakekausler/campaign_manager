import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useMemo, useCallback } from 'react';

/**
 * Placeholder types for Encounter mutations until code generation runs.
 * TODO: Replace with generated types from @/__generated__/graphql once backend is fixed.
 */

export interface UpdateEncounterInput {
  name?: string;
  description?: string;
  scheduledAt?: string;
  resolvedAt?: string;
  isResolved?: boolean;
  difficulty?: number;
  variables?: Record<string, unknown>;
}

export interface Encounter {
  id: string;
  campaignId: string;
  locationId?: string | null;
  name: string;
  description?: string | null;
  difficulty?: number | null;
  scheduledAt?: string | null;
  isResolved: boolean;
  resolvedAt?: string | null;
  variables: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  archivedAt?: string | null;
}

/**
 * GraphQL mutation to update an existing encounter.
 *
 * Supports updating encounter fields including scheduledAt for drag-to-reschedule functionality.
 */
export const UPDATE_ENCOUNTER = gql`
  mutation UpdateEncounter($id: ID!, $input: UpdateEncounterInput!) {
    updateEncounter(id: $id, input: $input) {
      id
      campaignId
      locationId
      name
      description
      difficulty
      scheduledAt
      isResolved
      resolvedAt
      variables
      updatedAt
    }
  }
`;

/**
 * Hook to update an encounter with optimistic UI updates.
 *
 * Provides a mutation function to update encounter fields, including scheduledAt
 * for drag-to-reschedule operations on the timeline.
 *
 * @returns Object with updateEncounter mutation function, loading state, and error state
 *
 * @example
 * ```tsx
 * function EncounterReschedule({ encounterId }: { encounterId: string }) {
 *   const { updateEncounter, loading, error } = useUpdateEncounter();
 *
 *   const handleReschedule = async (newDate: Date) => {
 *     try {
 *       await updateEncounter(encounterId, {
 *         scheduledAt: newDate.toISOString(),
 *       });
 *       toast.success('Encounter rescheduled');
 *     } catch (err) {
 *       toast.error('Failed to reschedule encounter');
 *     }
 *   };
 *
 *   return (
 *     <button onClick={() => handleReschedule(new Date())} disabled={loading}>
 *       Reschedule Encounter
 *     </button>
 *   );
 * }
 * ```
 */
export function useUpdateEncounter() {
  const [mutate, { loading, error, data }] = useMutation<
    { updateEncounter: Encounter },
    { id: string; input: UpdateEncounterInput }
  >(UPDATE_ENCOUNTER, {
    // Refetch queries that display encounters after mutation
    refetchQueries: ['GetEncountersByCampaign'],
    // Use cache-and-network to ensure fresh data
    fetchPolicy: 'network-only',
  });

  // Wrap mutation in a more convenient API
  const updateEncounter = useCallback(
    async (id: string, input: UpdateEncounterInput): Promise<Encounter> => {
      const result = await mutate({
        variables: { id, input },
      });

      if (!result.data) {
        throw new Error('Failed to update encounter');
      }

      return result.data.updateEncounter;
    },
    [mutate]
  );

  // Return memoized result
  return useMemo(
    () => ({
      updateEncounter,
      loading,
      error,
      data: data?.updateEncounter,
    }),
    [updateEncounter, loading, error, data]
  );
}

/**
 * EffectExecutionSummary - Summary of effects executed during a phase
 */
export interface EffectExecutionSummary {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    effectId: string;
    success: boolean;
    error?: string | null;
  }>;
  executionOrder?: string[] | null;
}

/**
 * EncounterResolutionResult - Result of resolving an encounter with effect execution
 */
export interface EncounterResolutionResult {
  encounter: Encounter;
  pre: EffectExecutionSummary;
  onResolve: EffectExecutionSummary;
  post: EffectExecutionSummary;
}

/**
 * GraphQL mutation to resolve an encounter with 3-phase effect execution.
 *
 * Executes effects in order: PRE → ON_RESOLVE → POST
 * Marks the encounter as resolved and sets resolvedAt timestamp.
 */
export const RESOLVE_ENCOUNTER = gql`
  mutation ResolveEncounter($id: ID!) {
    resolveEncounter(id: $id) {
      encounter {
        id
        campaignId
        locationId
        name
        description
        difficulty
        scheduledAt
        isResolved
        resolvedAt
        variables
        updatedAt
      }
      pre {
        total
        succeeded
        failed
        results {
          effectId
          success
          error
        }
        executionOrder
      }
      onResolve {
        total
        succeeded
        failed
        results {
          effectId
          success
          error
        }
        executionOrder
      }
      post {
        total
        succeeded
        failed
        results {
          effectId
          success
          error
        }
        executionOrder
      }
    }
  }
`;

/**
 * Hook to resolve an encounter with automatic effect execution.
 *
 * Provides a mutation function to resolve an encounter, which triggers
 * 3-phase effect execution (PRE → ON_RESOLVE → POST). The encounter is
 * marked as resolved and the resolvedAt timestamp is set.
 *
 * @returns Object with resolveEncounter mutation function, loading state, error state, and result data
 *
 * @example
 * ```tsx
 * function EncounterResolution({ encounterId }: { encounterId: string }) {
 *   const { resolveEncounter, loading, error, data } = useResolveEncounter();
 *
 *   const handleResolve = async () => {
 *     try {
 *       const result = await resolveEncounter(encounterId);
 *       console.log(`Resolved encounter ${result.encounter.id}`);
 *       console.log(`PRE: ${result.pre.succeeded}/${result.pre.total} effects succeeded`);
 *       console.log(`ON_RESOLVE: ${result.onResolve.succeeded}/${result.onResolve.total} effects succeeded`);
 *       console.log(`POST: ${result.post.succeeded}/${result.post.total} effects succeeded`);
 *       toast.success('Encounter resolved successfully');
 *     } catch (err) {
 *       toast.error('Failed to resolve encounter');
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleResolve} disabled={loading}>
 *       {loading ? 'Resolving...' : 'Resolve Encounter'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useResolveEncounter() {
  const [mutate, { loading, error, data }] = useMutation<
    { resolveEncounter: EncounterResolutionResult },
    { id: string }
  >(RESOLVE_ENCOUNTER, {
    // Refetch queries that display encounters after resolution
    refetchQueries: ['GetEncountersByCampaign', 'GetEncounterById'],
    // Use network-only to ensure fresh data
    fetchPolicy: 'network-only',
  });

  // Wrap mutation in a more convenient API
  const resolveEncounter = useCallback(
    async (id: string): Promise<EncounterResolutionResult> => {
      const result = await mutate({
        variables: { id },
      });

      if (!result.data) {
        throw new Error('Failed to resolve encounter');
      }

      return result.data.resolveEncounter;
    },
    [mutate]
  );

  // Return memoized result
  return useMemo(
    () => ({
      resolveEncounter,
      loading,
      error,
      data: data?.resolveEncounter,
    }),
    [resolveEncounter, loading, error, data]
  );
}
