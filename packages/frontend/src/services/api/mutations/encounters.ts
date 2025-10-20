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
