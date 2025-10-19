/**
 * World Time Hooks
 *
 * GraphQL hooks for querying and managing world time for campaigns.
 * World time is used for viewing historical states of the game world.
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

/**
 * GraphQL query to get current world time for a campaign
 */
export const GET_CURRENT_WORLD_TIME = gql`
  query GetCurrentWorldTime($campaignId: ID!) {
    getCurrentWorldTime(campaignId: $campaignId)
  }
`;

/**
 * Hook to query current world time for a campaign
 *
 * @param campaignId - ID of the campaign to query
 * @param options - Apollo query options
 * @returns Current world time as Date, loading state, error, and refetch function
 *
 * @example
 * ```tsx
 * const { currentTime, loading, error, refetch } = useCurrentWorldTime(campaignId);
 * if (loading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage message={error.message} />;
 * return <div>Current time: {currentTime?.toISOString()}</div>;
 * ```
 */
export function useCurrentWorldTime(campaignId: string | undefined) {
  const { data, loading, error, refetch, networkStatus } = useQuery<{
    getCurrentWorldTime: string | null;
  }>(GET_CURRENT_WORLD_TIME, {
    variables: { campaignId },
    skip: !campaignId,
    fetchPolicy: 'cache-and-network', // Always get fresh data for time
    notifyOnNetworkStatusChange: true,
  });

  return {
    currentTime: data?.getCurrentWorldTime ? new Date(data.getCurrentWorldTime) : null,
    loading,
    error,
    refetch,
    networkStatus,
  };
}
