import { gql } from '@apollo/client';
import { useQuery, type QueryHookOptions } from '@apollo/client/react';
import { useMemo } from 'react';

// TODO: Once backend is fixed and code generation runs, import these types from generated file:
// import type {
//   GetSettlementsByKingdomQuery,
//   GetSettlementsByKingdomQueryVariables,
//   GetSettlementDetailsQuery,
//   GetSettlementDetailsQueryVariables,
//   GetSettlementStructuresQuery,
//   GetSettlementStructuresQueryVariables,
// } from '@/__generated__/graphql';

// Temporary placeholder types until code generation runs
type Settlement = {
  id: string;
  name: string;
  level: number;
  x: number;
  y: number;
  z: number;
  campaignId: string;
  kingdomId: string;
  ownerId: string;
  isArchived: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  computedFields?: Record<string, unknown>;
  structures?: Structure[];
};

type Structure = {
  id: string;
  name: string;
  typeId: string;
  settlementId: string;
  x: number;
  y: number;
  orientation: number;
  isArchived: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type GetSettlementsByKingdomQuery = {
  settlementsByKingdom: Settlement[];
};

type GetSettlementsByKingdomQueryVariables = {
  kingdomId: string;
};

type GetSettlementDetailsQuery = {
  settlement: Settlement | null;
};

type GetSettlementDetailsQueryVariables = {
  id: string;
};

type GetSettlementStructuresQuery = {
  settlement: Settlement | null;
};

type GetSettlementStructuresQueryVariables = {
  id: string;
};

/**
 * GraphQL query to get all settlements for a specific kingdom.
 *
 * This query fetches a list of settlements with their basic information,
 * including ID, name, level, position coordinates, and ownership details.
 *
 * @param kingdomId - The ID of the kingdom to query settlements for
 * @returns Array of Settlement objects
 */
export const GET_SETTLEMENTS_BY_KINGDOM = gql`
  query GetSettlementsByKingdom($kingdomId: ID!) {
    settlementsByKingdom(kingdomId: $kingdomId) {
      id
      name
      level
      x
      y
      z
      campaignId
      kingdomId
      ownerId
      isArchived
      archivedAt
      createdAt
      updatedAt
    }
  }
`;

/**
 * GraphQL query to get detailed information about a single settlement.
 *
 * This query fetches a settlement with all its details, including
 * basic info, position, ownership, archival status, and computed fields.
 *
 * @param id - The ID of the settlement to fetch
 * @returns Settlement object with full details, or null if not found
 */
export const GET_SETTLEMENT_DETAILS = gql`
  query GetSettlementDetails($id: ID!) {
    settlement(id: $id) {
      id
      name
      level
      x
      y
      z
      campaignId
      kingdomId
      ownerId
      isArchived
      archivedAt
      createdAt
      updatedAt
      computedFields
    }
  }
`;

/**
 * GraphQL query to get structures within a settlement.
 *
 * This query fetches a settlement along with all its structures.
 * The structures field uses DataLoader on the backend for efficient batching.
 *
 * @param id - The ID of the settlement to fetch structures for
 * @returns Settlement object with structures array, or null if not found
 */
export const GET_SETTLEMENT_STRUCTURES = gql`
  query GetSettlementStructures($id: ID!) {
    settlement(id: $id) {
      id
      name
      structures {
        id
        name
        typeId
        settlementId
        x
        y
        orientation
        isArchived
        archivedAt
        createdAt
        updatedAt
      }
    }
  }
`;

/**
 * Hook to fetch all settlements for a specific kingdom.
 *
 * Uses cache-and-network fetch policy to ensure fresh data while showing cached results immediately.
 * Cache is keyed by kingdomId as configured in Apollo Client.
 *
 * @param kingdomId - The ID of the kingdom to query settlements for
 * @param options - Additional Apollo query options (skip, onCompleted, onError, etc.)
 * @returns Query result with settlements data, loading state, and error state
 *
 * @example
 * ```tsx
 * function KingdomSettlementsList({ kingdomId }: { kingdomId: string }) {
 *   const { data, loading, error } = useSettlementsByKingdom(kingdomId);
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorAlert message={error.message} />;
 *   if (!data?.settlements) return <EmptyState />;
 *
 *   return (
 *     <ul>
 *       {data.settlements.map(settlement => (
 *         <li key={settlement.id}>{settlement.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useSettlementsByKingdom(
  kingdomId: string,
  options?: Omit<
    QueryHookOptions<GetSettlementsByKingdomQuery, GetSettlementsByKingdomQueryVariables>,
    'variables'
  >
) {
  const result = useQuery<GetSettlementsByKingdomQuery, GetSettlementsByKingdomQueryVariables>(
    GET_SETTLEMENTS_BY_KINGDOM,
    {
      variables: { kingdomId },
      fetchPolicy: 'cache-and-network', // Show cached data immediately, but fetch fresh data
      ...options,
    }
  );

  // Return a simplified data shape for easier consumption
  return useMemo(
    () => ({
      settlements: result.data?.settlementsByKingdom ?? [],
      loading: result.loading,
      error: result.error,
      refetch: result.refetch,
      networkStatus: result.networkStatus,
    }),
    [result.data, result.loading, result.error, result.refetch, result.networkStatus]
  );
}

/**
 * Hook to fetch detailed information about a single settlement.
 *
 * Uses cache-first fetch policy for performance, with manual refetch available.
 * Includes computedFields for dynamic calculated values.
 *
 * @param settlementId - The ID of the settlement to fetch
 * @param options - Additional Apollo query options (skip, onCompleted, onError, etc.)
 * @returns Query result with settlement data, loading state, and error state
 *
 * @example
 * ```tsx
 * function SettlementDetailsPage({ settlementId }: { settlementId: string }) {
 *   const { settlement, loading, error, refetch } = useSettlementDetails(settlementId);
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorAlert message={error.message} />;
 *   if (!settlement) return <NotFound />;
 *
 *   return (
 *     <div>
 *       <h1>{settlement.name}</h1>
 *       <p>Level: {settlement.level}</p>
 *       <p>Position: ({settlement.x}, {settlement.y}, {settlement.z})</p>
 *       <button onClick={() => refetch()}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSettlementDetails(
  settlementId: string,
  options?: Omit<
    QueryHookOptions<GetSettlementDetailsQuery, GetSettlementDetailsQueryVariables>,
    'variables'
  >
) {
  const result = useQuery<GetSettlementDetailsQuery, GetSettlementDetailsQueryVariables>(
    GET_SETTLEMENT_DETAILS,
    {
      variables: { id: settlementId },
      fetchPolicy: 'cache-first', // Use cache by default, manual refetch available
      ...options,
    }
  );

  return useMemo(
    () => ({
      settlement: result.data?.settlement ?? null,
      loading: result.loading,
      error: result.error,
      refetch: result.refetch,
      networkStatus: result.networkStatus,
    }),
    [result.data, result.loading, result.error, result.refetch, result.networkStatus]
  );
}

/**
 * Hook to fetch structures within a settlement.
 *
 * Uses cache-and-network fetch policy to ensure fresh structure data.
 * The backend uses DataLoader for efficient batching when multiple settlements
 * are queried simultaneously.
 *
 * @param settlementId - The ID of the settlement to fetch structures for
 * @param options - Additional Apollo query options (skip, onCompleted, onError, etc.)
 * @returns Query result with structures data, loading state, and error state
 *
 * @example
 * ```tsx
 * function SettlementStructuresList({ settlementId }: { settlementId: string }) {
 *   const { structures, loading, error } = useStructuresBySettlement(settlementId);
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorAlert message={error.message} />;
 *   if (!structures || structures.length === 0) return <EmptyState />;
 *
 *   return (
 *     <ul>
 *       {structures.map(structure => (
 *         <li key={structure.id}>{structure.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useStructuresBySettlement(
  settlementId: string,
  options?: Omit<
    QueryHookOptions<GetSettlementStructuresQuery, GetSettlementStructuresQueryVariables>,
    'variables'
  >
) {
  const result = useQuery<GetSettlementStructuresQuery, GetSettlementStructuresQueryVariables>(
    GET_SETTLEMENT_STRUCTURES,
    {
      variables: { id: settlementId },
      fetchPolicy: 'cache-and-network', // Show cached data immediately, but fetch fresh data
      ...options,
    }
  );

  return useMemo(
    () => ({
      structures: result.data?.settlement?.structures ?? [],
      settlementName: result.data?.settlement?.name ?? null,
      loading: result.loading,
      error: result.error,
      refetch: result.refetch,
      networkStatus: result.networkStatus,
    }),
    [result.data, result.loading, result.error, result.refetch, result.networkStatus]
  );
}
