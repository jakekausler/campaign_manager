import { gql } from '@apollo/client';
import { useQuery, type QueryHookOptions } from '@apollo/client/react';
import { useMemo } from 'react';

// TODO: Once backend is fixed and code generation runs, import these types from generated file:
// import type {
//   GetStructuresBySettlementQuery,
//   GetStructuresBySettlementQueryVariables,
//   GetStructureDetailsQuery,
//   GetStructureDetailsQueryVariables,
//   GetStructureConditionsQuery,
//   GetStructureConditionsQueryVariables,
// } from '@/__generated__/graphql';

// Temporary placeholder types until code generation runs
type Location = {
  id: string;
  worldId: string;
  type: string;
  name?: string | null;
  description?: string | null;
  parentLocationId?: string | null;
  geojson?: unknown | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  archivedAt?: string | null;
};

type Settlement = {
  id: string;
  name: string;
  level: number;
  locationId: string;
  location?: Location;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
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
  computedFields?: Record<string, unknown>;
  settlement?: Settlement;
  // Fields returned by GET_STRUCTURES_FOR_MAP query
  type?: string;
  level?: number;
};

type GetStructureDetailsQuery = {
  structure: Structure | null;
};

type GetStructureDetailsQueryVariables = {
  id: string;
};

type GetStructureConditionsQuery = {
  structure: Structure | null;
};

type GetStructureConditionsQueryVariables = {
  id: string;
};

type GetStructuresForMapQuery = {
  structuresBySettlement: Structure[];
};

type GetStructuresForMapQueryVariables = {
  settlementId: string;
};

/**
 * GraphQL query to get detailed information about a single structure.
 *
 * This query fetches a structure with all its details, including
 * basic info, position, orientation, archival status, and computed fields.
 *
 * @param id - The ID of the structure to fetch
 * @returns Structure object with full details, or null if not found
 */
export const GET_STRUCTURE_DETAILS = gql`
  query GetStructureDetails($id: ID!) {
    structure(id: $id) {
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
      computedFields
    }
  }
`;

/**
 * GraphQL query to get computed fields and conditions for a structure.
 *
 * This query fetches a structure along with its dynamically calculated
 * computed fields based on the condition system. The computedFields are
 * always fetched fresh from the backend (not cached) to ensure accuracy.
 *
 * @param id - The ID of the structure to fetch conditions for
 * @returns Structure object with computedFields, or null if not found
 */
export const GET_STRUCTURE_CONDITIONS = gql`
  query GetStructureConditions($id: ID!) {
    structure(id: $id) {
      id
      name
      computedFields
    }
  }
`;

/**
 * GraphQL query to get structures with settlement and location data for map rendering.
 *
 * This query fetches structures with their associated Settlement entities
 * (which include Location with GeoJSON geometry) for rendering on the map.
 *
 * @param settlementId - The ID of the settlement to query structures for
 * @returns Array of Structure objects with settlement and location data
 */
export const GET_STRUCTURES_FOR_MAP = gql`
  query GetStructuresForMap($settlementId: ID!) {
    structuresBySettlement(settlementId: $settlementId) {
      id
      name
      type
      level
      settlement {
        id
        name
        level
        location {
          id
          worldId
          type
          name
          description
          geojson
        }
      }
      createdAt
      updatedAt
      archivedAt
    }
  }
`;

/**
 * Hook to fetch detailed information about a single structure.
 *
 * Uses cache-first fetch policy for performance, with manual refetch available.
 * Includes computedFields for dynamic calculated values.
 *
 * @param structureId - The ID of the structure to fetch
 * @param options - Additional Apollo query options (skip, onCompleted, onError, etc.)
 * @returns Query result with structure data, loading state, and error state
 *
 * @example
 * ```tsx
 * function StructureDetailsPage({ structureId }: { structureId: string }) {
 *   const { structure, loading, error, refetch } = useStructureDetails(structureId);
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorAlert message={error.message} />;
 *   if (!structure) return <NotFound />;
 *
 *   return (
 *     <div>
 *       <h1>{structure.name}</h1>
 *       <p>Type: {structure.typeId}</p>
 *       <p>Position: ({structure.x}, {structure.y})</p>
 *       <p>Orientation: {structure.orientation}°</p>
 *       <button onClick={() => refetch()}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useStructureDetails(
  structureId: string,
  options?: Omit<
    QueryHookOptions<GetStructureDetailsQuery, GetStructureDetailsQueryVariables>,
    'variables'
  >
) {
  const result = useQuery<GetStructureDetailsQuery, GetStructureDetailsQueryVariables>(
    GET_STRUCTURE_DETAILS,
    {
      variables: { id: structureId },
      fetchPolicy: 'cache-first', // Use cache by default, manual refetch available
      ...options,
    }
  );

  return useMemo(
    () => ({
      structure: result.data?.structure ?? null,
      loading: result.loading,
      error: result.error,
      refetch: result.refetch,
      networkStatus: result.networkStatus,
    }),
    [result.data, result.loading, result.error, result.refetch, result.networkStatus]
  );
}

/**
 * Hook to fetch computed fields and conditions for a structure.
 *
 * Uses cache-and-network fetch policy to ensure fresh computed field data.
 * Since computed fields can change based on time-travel and other dynamic factors,
 * they should always be fetched fresh from the backend.
 *
 * @param structureId - The ID of the structure to fetch conditions for
 * @param options - Additional Apollo query options (skip, onCompleted, onError, etc.)
 * @returns Query result with structure conditions data, loading state, and error state
 *
 * @example
 * ```tsx
 * function StructureConditionsPanel({ structureId }: { structureId: string }) {
 *   const { structure, loading, error, refetch } = useStructureConditions(structureId);
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorAlert message={error.message} />;
 *   if (!structure?.computedFields) return <EmptyState message="No computed fields" />;
 *
 *   return (
 *     <div>
 *       <h2>Computed Fields for {structure.name}</h2>
 *       <pre>{JSON.stringify(structure.computedFields, null, 2)}</pre>
 *       <button onClick={() => refetch()}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useStructureConditions(
  structureId: string,
  options?: Omit<
    QueryHookOptions<GetStructureConditionsQuery, GetStructureConditionsQueryVariables>,
    'variables'
  >
) {
  const result = useQuery<GetStructureConditionsQuery, GetStructureConditionsQueryVariables>(
    GET_STRUCTURE_CONDITIONS,
    {
      variables: { id: structureId },
      fetchPolicy: 'cache-and-network', // Always fetch fresh computed fields
      ...options,
    }
  );

  return useMemo(
    () => ({
      structure: result.data?.structure ?? null,
      computedFields: result.data?.structure?.computedFields ?? null,
      loading: result.loading,
      error: result.error,
      refetch: result.refetch,
      networkStatus: result.networkStatus,
    }),
    [result.data, result.loading, result.error, result.refetch, result.networkStatus]
  );
}

/**
 * Hook to fetch structures with settlement and location data for map rendering.
 *
 * Uses cache-and-network fetch policy to ensure fresh data while showing cached results immediately.
 * Fetches structures with their associated Settlement entities (including Location with GeoJSON geometry).
 *
 * @param settlementId - The ID of the settlement to query structures for
 * @param options - Additional Apollo query options (skip, onCompleted, onError, etc.)
 * @returns Query result with structures data (with settlement and location), loading state, and error state
 *
 * @example
 * ```tsx
 * function StructuresMapLayer({ settlementId }: { settlementId: string }) {
 *   const { structures, loading, error } = useStructuresForMap(settlementId);
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorAlert message={error.message} />;
 *   if (!structures || structures.length === 0) return null;
 *
 *   return (
 *     <>
 *       {structures.map(structure => (
 *         <StructureMarker
 *           key={structure.id}
 *           structure={structure}
 *           location={structure.settlement?.location}
 *         />
 *       ))}
 *     </>
 *   );
 * }
 * ```
 */
export function useStructuresForMap(
  settlementId: string,
  options?: Omit<
    QueryHookOptions<GetStructuresForMapQuery, GetStructuresForMapQueryVariables>,
    'variables'
  >
) {
  const result = useQuery<GetStructuresForMapQuery, GetStructuresForMapQueryVariables>(
    GET_STRUCTURES_FOR_MAP,
    {
      variables: { settlementId },
      fetchPolicy: 'cache-and-network', // Show cached data immediately, but fetch fresh data
      ...options,
    }
  );

  return useMemo(
    () => ({
      structures: result.data?.structuresBySettlement ?? [],
      loading: result.loading,
      error: result.error,
      refetch: result.refetch,
      networkStatus: result.networkStatus,
    }),
    [result.data, result.loading, result.error, result.refetch, result.networkStatus]
  );
}
