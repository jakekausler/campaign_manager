import { gql } from '@apollo/client';
import { useQuery, type QueryHookOptions } from '@apollo/client/react';
import { useMemo } from 'react';

// TODO: Once codegen runs successfully, import generated types:
// import type {
//   GetEncountersByCampaignQuery,
//   GetEncountersByCampaignQueryVariables,
// } from '@/__generated__/graphql';

// Temporary placeholder types until code generation runs
type Encounter = {
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
};

type GetEncountersByCampaignQuery = {
  encountersByCampaign: Encounter[];
};

type GetEncountersByCampaignQueryVariables = {
  campaignId: string;
};

/**
 * GraphQL query to get all encounters for a specific campaign.
 *
 * This query fetches a list of encounters with their resolution information,
 * including difficulty rating, resolution status, and resolution timestamp.
 *
 * @param campaignId - The ID of the campaign to query encounters for
 * @returns Array of Encounter objects
 */
export const GET_ENCOUNTERS_BY_CAMPAIGN = gql`
  query GetEncountersByCampaign($campaignId: ID!) {
    encountersByCampaign(campaignId: $campaignId) {
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
      createdAt
      updatedAt
      deletedAt
      archivedAt
    }
  }
`;

/**
 * Hook to fetch all encounters for a specific campaign.
 *
 * Uses cache-and-network fetch policy to ensure fresh data while showing cached results immediately.
 * Returns encounters with resolution information for timeline visualization.
 *
 * @param campaignId - The ID of the campaign to query encounters for
 * @param options - Additional Apollo query options (skip, onCompleted, onError, etc.)
 * @returns Query result with encounters data, loading state, and error state
 *
 * @example
 * ```tsx
 * function CampaignEncountersList({ campaignId }: { campaignId: string }) {
 *   const { encounters, loading, error } = useEncountersByCampaign(campaignId);
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorAlert message={error.message} />;
 *   if (!encounters || encounters.length === 0) return <EmptyState />;
 *
 *   return (
 *     <ul>
 *       {encounters.map(encounter => (
 *         <li key={encounter.id}>
 *           {encounter.name} - {encounter.isResolved ? 'Resolved' : 'Unresolved'}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useEncountersByCampaign(
  campaignId: string,
  options?: Omit<
    QueryHookOptions<GetEncountersByCampaignQuery, GetEncountersByCampaignQueryVariables>,
    'variables'
  >
) {
  const result = useQuery<GetEncountersByCampaignQuery, GetEncountersByCampaignQueryVariables>(
    GET_ENCOUNTERS_BY_CAMPAIGN,
    {
      variables: { campaignId },
      fetchPolicy: 'cache-and-network', // Show cached data immediately, but fetch fresh data
      ...options,
    }
  );

  // Return a simplified data shape for easier consumption
  return useMemo(
    () => ({
      encounters: result.data?.encountersByCampaign ?? [],
      loading: result.loading,
      error: result.error,
      refetch: result.refetch,
      networkStatus: result.networkStatus,
    }),
    [result.data, result.loading, result.error, result.refetch, result.networkStatus]
  );
}
