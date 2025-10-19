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
  type: string; // "point" | "region"
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
 * Hook for updating location geometry with optimistic updates and error handling.
 *
 * @example
 * ```tsx
 * const { updateGeometry, loading, error } = useUpdateLocationGeometry({
 *   onSuccess: (location) => console.log('Geometry saved:', location),
 *   onError: (err) => console.error('Save failed:', err),
 * });
 *
 * // Update a location's geometry
 * await updateGeometry({
 *   id: 'location-id',
 *   geoJson: { type: 'Point', coordinates: [0, 0] },
 *   branchId: 'branch-id',
 *   expectedVersion: 1,
 * });
 * ```
 */
export function useUpdateLocationGeometry(options?: {
  onSuccess?: (location: Location) => void;
  onError?: (error: Error) => void;
}) {
  const [mutate, { loading, error, data }] = useMutation<
    { updateLocationGeometry: Location },
    { id: string; input: UpdateLocationGeometryInput }
  >(UPDATE_LOCATION_GEOMETRY);

  const updateGeometry = useMemo(
    () => async (variables: { id: string } & UpdateLocationGeometryInput) => {
      const { id, ...input } = variables;

      try {
        const result = await mutate({
          variables: { id, input },
        });

        if (result.data?.updateLocationGeometry && options?.onSuccess) {
          options.onSuccess(result.data.updateLocationGeometry);
        }

        return result.data?.updateLocationGeometry ?? null;
      } catch (err) {
        if (options?.onError) {
          options.onError(err as Error);
        }
        throw err;
      }
    },
    [mutate, options]
  );

  return {
    updateGeometry,
    loading,
    error,
    location: data?.updateLocationGeometry ?? null,
  };
}
