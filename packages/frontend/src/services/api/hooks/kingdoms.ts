import { gql } from '@apollo/client';
import { useQuery, type QueryHookOptions } from '@apollo/client/react';
import { useMemo } from 'react';

// Temporary placeholder types until code generation runs
type Kingdom = {
  id: string;
  campaignId: string;
  name: string;
  level: number;
  variables: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  archivedAt?: string | null;
};

type GetKingdomByIdQuery = {
  kingdom: Kingdom | null;
};

type GetKingdomByIdQueryVariables = {
  id: string;
};

/**
 * GraphQL query to get detailed information about a single kingdom.
 *
 * This query fetches a kingdom with all its details, including
 * basic info, level, variables, and timestamps.
 *
 * @param id - The ID of the kingdom to fetch
 * @returns Kingdom object with full details, or null if not found
 */
export const GET_KINGDOM_BY_ID = gql`
  query GetKingdomById($id: ID!) {
    kingdom(id: $id) {
      id
      campaignId
      name
      level
      variables
      version
      createdAt
      updatedAt
      deletedAt
      archivedAt
    }
  }
`;

/**
 * Custom hook to fetch a kingdom by ID.
 *
 * Features:
 * - Automatic loading and error states
 * - Refetch capability
 * - Memoized kingdom object
 *
 * @param kingdomId - The ID of the kingdom to fetch
 * @param options - Additional Apollo query options
 * @returns Object containing kingdom data, loading state, error, and refetch function
 *
 * @example
 * ```tsx
 * const { kingdom, loading, error, refetch } = useKingdomById('kingdom-123');
 *
 * if (loading) return <Skeleton />;
 * if (error) return <ErrorMessage error={error} />;
 * if (!kingdom) return <NotFound />;
 *
 * return <div>{kingdom.name} (Level {kingdom.level})</div>;
 * ```
 */
export function useKingdomById(
  kingdomId: string,
  options?: QueryHookOptions<GetKingdomByIdQuery, GetKingdomByIdQueryVariables>
) {
  const { data, loading, error, refetch } = useQuery<
    GetKingdomByIdQuery,
    GetKingdomByIdQueryVariables
  >(GET_KINGDOM_BY_ID, {
    variables: { id: kingdomId },
    skip: !kingdomId,
    ...options,
  });

  const kingdom = useMemo(() => data?.kingdom ?? null, [data]);

  return {
    kingdom,
    loading,
    error,
    refetch,
  };
}
