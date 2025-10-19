import { gql } from '@apollo/client';
import { useQuery, type QueryHookOptions } from '@apollo/client/react';
import { useMemo } from 'react';

// TODO: Once backend is fixed and code generation runs, import these types from generated file:
// import type {
//   GetLocationsByWorldQuery,
//   GetLocationsByWorldQueryVariables,
//   GetLocationDetailsQuery,
//   GetLocationDetailsQueryVariables,
// } from '@/__generated__/graphql';

// Temporary placeholder types until code generation runs
type Location = {
  id: string;
  worldId: string;
  type: string; // "point" | "region"
  name?: string | null;
  description?: string | null;
  parentLocationId?: string | null;
  geojson?: unknown | null; // GeoJSON geometry
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  archivedAt?: string | null;
};

type GetLocationsByWorldQuery = {
  locationsByWorld: Location[];
};

type GetLocationsByWorldQueryVariables = {
  worldId: string;
};

type GetLocationDetailsQuery = {
  location: Location | null;
};

type GetLocationDetailsQueryVariables = {
  id: string;
};

/**
 * GraphQL query to get all locations for a specific world.
 *
 * This query fetches a list of locations with their basic information,
 * including ID, name, type, and GeoJSON geometry for map rendering.
 *
 * @param worldId - The ID of the world to query locations for
 * @returns Array of Location objects with geometry
 */
export const GET_LOCATIONS_BY_WORLD = gql`
  query GetLocationsByWorld($worldId: ID!) {
    locationsByWorld(worldId: $worldId) {
      id
      worldId
      type
      name
      description
      parentLocationId
      geojson
      createdAt
      updatedAt
      deletedAt
      archivedAt
    }
  }
`;

/**
 * GraphQL query to get detailed information about a single location.
 *
 * This query fetches a location with all its details, including
 * basic info, type, geometry, and hierarchical relationships.
 *
 * @param id - The ID of the location to fetch
 * @returns Location object with full details, or null if not found
 */
export const GET_LOCATION_DETAILS = gql`
  query GetLocationDetails($id: ID!) {
    location(id: $id) {
      id
      worldId
      type
      name
      description
      parentLocationId
      geojson
      createdAt
      updatedAt
      deletedAt
      archivedAt
    }
  }
`;

/**
 * Hook to fetch all locations for a specific world.
 *
 * Uses cache-and-network fetch policy to ensure fresh data while showing cached results immediately.
 * Cache is keyed by worldId as configured in Apollo Client.
 *
 * @param worldId - The ID of the world to query locations for
 * @param options - Additional Apollo query options (skip, onCompleted, onError, etc.)
 * @returns Query result with locations data, loading state, and error state
 *
 * @example
 * ```tsx
 * function WorldLocationsMap({ worldId }: { worldId: string }) {
 *   const { locations, loading, error } = useLocationsByWorld(worldId);
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorAlert message={error.message} />;
 *   if (!locations || locations.length === 0) return <EmptyState />;
 *
 *   return (
 *     <Map>
 *       {locations.map(location => (
 *         <LocationMarker key={location.id} location={location} />
 *       ))}
 *     </Map>
 *   );
 * }
 * ```
 */
export function useLocationsByWorld(
  worldId: string,
  options?: Omit<
    QueryHookOptions<GetLocationsByWorldQuery, GetLocationsByWorldQueryVariables>,
    'variables'
  >
) {
  const result = useQuery<GetLocationsByWorldQuery, GetLocationsByWorldQueryVariables>(
    GET_LOCATIONS_BY_WORLD,
    {
      variables: { worldId },
      fetchPolicy: 'cache-and-network', // Show cached data immediately, but fetch fresh data
      ...options,
    }
  );

  // Return a simplified data shape for easier consumption
  return useMemo(
    () => ({
      locations: result.data?.locationsByWorld ?? [],
      loading: result.loading,
      error: result.error,
      refetch: result.refetch,
      networkStatus: result.networkStatus,
    }),
    [result.data, result.loading, result.error, result.refetch, result.networkStatus]
  );
}

/**
 * Hook to fetch detailed information about a single location.
 *
 * Uses cache-first fetch policy for performance, with manual refetch available.
 * Includes GeoJSON geometry for map rendering.
 *
 * @param locationId - The ID of the location to fetch
 * @param options - Additional Apollo query options (skip, onCompleted, onError, etc.)
 * @returns Query result with location data, loading state, and error state
 *
 * @example
 * ```tsx
 * function LocationDetailsPage({ locationId }: { locationId: string }) {
 *   const { location, loading, error, refetch } = useLocationDetails(locationId);
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorAlert message={error.message} />;
 *   if (!location) return <NotFound />;
 *
 *   return (
 *     <div>
 *       <h1>{location.name || 'Unnamed Location'}</h1>
 *       <p>Type: {location.type}</p>
 *       <p>{location.description}</p>
 *       <button onClick={() => refetch()}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useLocationDetails(
  locationId: string,
  options?: Omit<
    QueryHookOptions<GetLocationDetailsQuery, GetLocationDetailsQueryVariables>,
    'variables'
  >
) {
  const result = useQuery<GetLocationDetailsQuery, GetLocationDetailsQueryVariables>(
    GET_LOCATION_DETAILS,
    {
      variables: { id: locationId },
      fetchPolicy: 'cache-first', // Use cache by default, manual refetch available
      ...options,
    }
  );

  return useMemo(
    () => ({
      location: result.data?.location ?? null,
      loading: result.loading,
      error: result.error,
      refetch: result.refetch,
      networkStatus: result.networkStatus,
    }),
    [result.data, result.loading, result.error, result.refetch, result.networkStatus]
  );
}
