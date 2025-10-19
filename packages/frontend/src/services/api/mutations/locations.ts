import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useMemo } from 'react';

/**
 * Location mutation types and hooks
 * Provides GraphQL mutations for updating location geometry.
 */

export interface UpdateLocationGeometryInput {
  geoJson: unknown; // GeoJSON geometry object (Point, Polygon, or MultiPolygon)
  branchId: string;
  expectedVersion: number;
  srid?: number;
  worldTime?: string;
}

export interface Location {
  id: string;
  worldId: string;
  type: 'point' | 'region';
  name?: string | null;
  description?: string | null;
  parentLocationId?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  archivedAt?: string | null;
}

/**
 * GraphQL mutation to update location geometry.
 * Used when drawing or editing point locations or polygon regions on the map.
 */
export const UPDATE_LOCATION_GEOMETRY = gql`
  mutation UpdateLocationGeometry($id: ID!, $input: UpdateLocationGeometryInput!) {
    updateLocationGeometry(id: $id, input: $input) {
      id
      worldId
      type
      name
      description
      parentLocationId
      version
      updatedAt
    }
  }
`;

/**
 * Hook to update location geometry with cache invalidation.
 *
 * @param options - Apollo Client mutation options
 * @returns Mutation function and state
 *
 * @example
 * ```tsx
 * function EditGeometryForm({ locationId }: { locationId: string }) {
 *   const { updateLocationGeometry, loading, error } = useUpdateLocationGeometry();
 *
 *   const handleSave = async (geoJson: unknown, branchId: string, version: number) => {
 *     try {
 *       const location = await updateLocationGeometry(locationId, {
 *         geoJson,
 *         branchId,
 *         expectedVersion: version,
 *       });
 *       console.log('Updated:', location);
 *     } catch (err) {
 *       console.error('Failed to update geometry:', err);
 *     }
 *   };
 *
 *   return <form onSubmit={handleSave}>...</form>;
 * }
 * ```
 */
export function useUpdateLocationGeometry(
  options?: useMutation.Options<
    { updateLocationGeometry: Location },
    { id: string; input: UpdateLocationGeometryInput }
  >
) {
  const [mutate, result] = useMutation<
    { updateLocationGeometry: Location },
    { id: string; input: UpdateLocationGeometryInput }
  >(UPDATE_LOCATION_GEOMETRY, {
    ...options,
    // Refetch the locationsByWorld query to ensure cache consistency
    refetchQueries: ['LocationsByWorld'],
    update(cache, { data }, context) {
      if (!data?.updateLocationGeometry) return;

      // Call user-provided update function if exists
      if (options?.update) {
        options.update(cache, { data }, context);
      }
    },
  });

  return useMemo(
    () => ({
      updateLocationGeometry: async (
        id: string,
        input: UpdateLocationGeometryInput
      ): Promise<Location | undefined> => {
        const { data } = await mutate({ variables: { id, input } });
        return data?.updateLocationGeometry;
      },
      loading: result.loading,
      error: result.error,
      data: result.data?.updateLocationGeometry,
      reset: result.reset,
    }),
    [mutate, result.loading, result.error, result.data, result.reset]
  );
}
