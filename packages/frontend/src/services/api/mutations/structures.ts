import { gql, type Reference } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useMemo } from 'react';

/**
 * Placeholder types for Structure mutations until code generation runs.
 * TODO: Replace with generated types from @/__generated__/graphql once backend is fixed.
 */

export interface CreateStructureInput {
  settlementId: string;
  type: string;
  name: string;
  x: number;
  y: number;
  level?: number;
  branchId?: string;
}

export interface UpdateStructureInput {
  name?: string;
  type?: string;
  x?: number;
  y?: number;
  level?: number;
  variables?: Record<string, unknown>;
  branchId?: string;
  expectedVersion?: number;
  worldTime?: string;
}

export interface Structure {
  id: string;
  settlementId: string;
  type: string;
  name: string;
  x: number;
  y: number;
  level: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  version: number;
}

/**
 * GraphQL mutation to create a new structure.
 */
export const CREATE_STRUCTURE = gql`
  mutation CreateStructure($input: CreateStructureInput!) {
    createStructure(input: $input) {
      id
      settlementId
      type
      name
      x
      y
      level
      createdAt
      updatedAt
      version
    }
  }
`;

/**
 * GraphQL mutation to update an existing structure.
 */
export const UPDATE_STRUCTURE = gql`
  mutation UpdateStructure($id: ID!, $input: UpdateStructureInput!) {
    updateStructure(id: $id, input: $input) {
      id
      settlementId
      type
      name
      x
      y
      level
      updatedAt
      version
    }
  }
`;

/**
 * GraphQL mutation to delete a structure (soft delete).
 */
export const DELETE_STRUCTURE = gql`
  mutation DeleteStructure($id: ID!, $branchId: String) {
    deleteStructure(id: $id, branchId: $branchId) {
      id
      deletedAt
      version
    }
  }
`;

/**
 * GraphQL mutation to archive a structure.
 */
export const ARCHIVE_STRUCTURE = gql`
  mutation ArchiveStructure($id: ID!, $branchId: String) {
    archiveStructure(id: $id, branchId: $branchId) {
      id
      deletedAt
      version
    }
  }
`;

/**
 * GraphQL mutation to restore an archived structure.
 */
export const RESTORE_STRUCTURE = gql`
  mutation RestoreStructure($id: ID!, $branchId: String) {
    restoreStructure(id: $id, branchId: $branchId) {
      id
      deletedAt
      version
    }
  }
`;

/**
 * Hook to create a new structure with optimistic updates.
 *
 * @param options - Apollo Client mutation options
 * @returns Mutation function and state
 *
 * @example
 * ```tsx
 * function CreateStructureForm({ settlementId }: { settlementId: string }) {
 *   const { createStructure, loading, error } = useCreateStructure();
 *
 *   const handleSubmit = async (data: { name: string; type: string; x: number; y: number }) => {
 *     try {
 *       const structure = await createStructure({
 *         settlementId,
 *         type: data.type,
 *         name: data.name,
 *         x: data.x,
 *         y: data.y,
 *         level: 1,
 *       });
 *       console.log('Created:', structure);
 *     } catch (err) {
 *       console.error('Failed to create structure:', err);
 *     }
 *   };
 *
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */
export function useCreateStructure(
  options?: useMutation.Options<{ createStructure: Structure }, { input: CreateStructureInput }>
) {
  const [mutate, result] = useMutation<
    { createStructure: Structure },
    { input: CreateStructureInput }
  >(CREATE_STRUCTURE, {
    ...options,
    // Refetch the structuresBySettlement query to ensure cache consistency
    refetchQueries: ['StructuresBySettlement'],
    update(cache, { data }, context) {
      if (!data?.createStructure) return;

      const newStructure = data.createStructure;

      // Update the structures field on the Settlement object
      const settlementId = newStructure.settlementId;
      cache.modify({
        id: cache.identify({ __typename: 'Settlement', id: settlementId }),
        fields: {
          structures(existingStructures = [], { toReference }) {
            const newStructureRef = toReference({
              __typename: 'Structure',
              id: newStructure.id,
            });
            return [...(existingStructures as Reference[]), newStructureRef as Reference];
          },
        },
      });

      // Call user-provided update function if exists
      if (options?.update) {
        options.update(cache, { data }, context);
      }
    },
  });

  return useMemo(
    () => ({
      createStructure: async (input: CreateStructureInput) => {
        const { data } = await mutate({ variables: { input } });
        return data?.createStructure;
      },
      loading: result.loading,
      error: result.error,
      data: result.data?.createStructure,
      reset: result.reset,
    }),
    [mutate, result.loading, result.error, result.data, result.reset]
  );
}

/**
 * Hook to update an existing structure with optimistic updates.
 *
 * @param options - Apollo Client mutation options
 * @returns Mutation function and state
 *
 * @example
 * ```tsx
 * function StructureEditor({ structureId }: { structureId: string }) {
 *   const { updateStructure, loading, error } = useUpdateStructure();
 *
 *   const handleSave = async (data: { name: string; level: number }) => {
 *     try {
 *       const updated = await updateStructure(structureId, data);
 *       console.log('Updated:', updated);
 *     } catch (err) {
 *       console.error('Failed to update:', err);
 *     }
 *   };
 *
 *   return <form onSubmit={handleSave}>...</form>;
 * }
 * ```
 */
export function useUpdateStructure(
  options?: useMutation.Options<
    { updateStructure: Structure },
    { id: string; input: UpdateStructureInput }
  >
) {
  const [mutate, result] = useMutation<
    { updateStructure: Structure },
    { id: string; input: UpdateStructureInput }
  >(UPDATE_STRUCTURE, {
    ...options,
    update(cache, { data }, context) {
      if (!data?.updateStructure) return;

      // Call user-provided update function if exists
      if (options?.update) {
        options.update(cache, { data }, context);
      }
    },
  });

  return useMemo(
    () => ({
      updateStructure: async (id: string, input: UpdateStructureInput) => {
        const { data } = await mutate({ variables: { id, input } });
        return data?.updateStructure;
      },
      loading: result.loading,
      error: result.error,
      data: result.data?.updateStructure,
      reset: result.reset,
    }),
    [mutate, result.loading, result.error, result.data, result.reset]
  );
}

/**
 * Hook to delete a structure with optimistic updates.
 *
 * @param options - Apollo Client mutation options
 * @returns Mutation function and state
 *
 * @example
 * ```tsx
 * function DeleteStructureButton({ structureId }: { structureId: string }) {
 *   const { deleteStructure, loading } = useDeleteStructure();
 *
 *   const handleDelete = async () => {
 *     if (!confirm('Are you sure?')) return;
 *     try {
 *       await deleteStructure(structureId);
 *     } catch (err) {
 *       console.error('Failed to delete:', err);
 *     }
 *   };
 *
 *   return <button onClick={handleDelete} disabled={loading}>Delete</button>;
 * }
 * ```
 */
export function useDeleteStructure(
  options?: useMutation.Options<{ deleteStructure: Structure }, { id: string; branchId?: string }>
) {
  const [mutate, result] = useMutation<
    { deleteStructure: Structure },
    { id: string; branchId?: string }
  >(DELETE_STRUCTURE, {
    ...options,
    // Refetch the structuresBySettlement query to ensure removed structure doesn't appear in lists
    refetchQueries: ['StructuresBySettlement'],
    update(cache, { data }, context) {
      if (!data?.deleteStructure || !context.variables) return;

      const structureId = context.variables.id;

      // Read the structure from cache to get the settlementId before evicting
      const structureRef = cache.identify({ __typename: 'Structure', id: structureId });
      const structure = structureRef
        ? cache.readFragment<Structure>({
            id: structureRef,
            fragment: gql`
              fragment StructureSettlement on Structure {
                settlementId
              }
            `,
          })
        : null;

      // Remove from Settlement.structures field if we have the settlementId
      if (structure?.settlementId) {
        cache.modify({
          id: cache.identify({ __typename: 'Settlement', id: structure.settlementId }),
          fields: {
            structures(existingStructures = [], { readField }) {
              return (existingStructures as Reference[]).filter(
                (ref) => readField('id', ref) !== structureId
              );
            },
          },
        });
      }

      // Evict the structure from cache
      cache.evict({ id: structureRef });
      cache.gc();

      // Call user-provided update function if exists
      if (options?.update) {
        options.update(cache, { data }, context);
      }
    },
  });

  return useMemo(
    () => ({
      deleteStructure: async (id: string, branchId?: string) => {
        const { data } = await mutate({ variables: { id, branchId } });
        return data?.deleteStructure;
      },
      loading: result.loading,
      error: result.error,
      data: result.data?.deleteStructure,
      reset: result.reset,
    }),
    [mutate, result.loading, result.error, result.data, result.reset]
  );
}

/**
 * Hook to archive a structure.
 *
 * Archiving is similar to deleting but may have different business logic on the backend.
 *
 * @param options - Apollo Client mutation options
 * @returns Mutation function and state
 */
export function useArchiveStructure(
  options?: useMutation.Options<{ archiveStructure: Structure }, { id: string; branchId?: string }>
) {
  const [mutate, result] = useMutation<
    { archiveStructure: Structure },
    { id: string; branchId?: string }
  >(ARCHIVE_STRUCTURE, {
    ...options,
    update(cache, { data }, context) {
      if (!data?.archiveStructure) return;

      // Update the deletedAt field in the cache
      cache.modify({
        id: cache.identify({ __typename: 'Structure', id: data.archiveStructure.id }),
        fields: {
          deletedAt() {
            return data.archiveStructure.deletedAt;
          },
          version() {
            return data.archiveStructure.version;
          },
        },
      });

      // Call user-provided update function if exists
      if (options?.update) {
        options.update(cache, { data }, context);
      }
    },
  });

  return useMemo(
    () => ({
      archiveStructure: async (id: string, branchId?: string) => {
        const { data } = await mutate({ variables: { id, branchId } });
        return data?.archiveStructure;
      },
      loading: result.loading,
      error: result.error,
      data: result.data?.archiveStructure,
      reset: result.reset,
    }),
    [mutate, result.loading, result.error, result.data, result.reset]
  );
}

/**
 * Hook to restore an archived structure.
 *
 * @param options - Apollo Client mutation options
 * @returns Mutation function and state
 */
export function useRestoreStructure(
  options?: useMutation.Options<{ restoreStructure: Structure }, { id: string; branchId?: string }>
) {
  const [mutate, result] = useMutation<
    { restoreStructure: Structure },
    { id: string; branchId?: string }
  >(RESTORE_STRUCTURE, {
    ...options,
    update(cache, { data }, context) {
      if (!data?.restoreStructure) return;

      // Update the deletedAt field in the cache (should be null after restore)
      cache.modify({
        id: cache.identify({ __typename: 'Structure', id: data.restoreStructure.id }),
        fields: {
          deletedAt() {
            return data.restoreStructure.deletedAt;
          },
          version() {
            return data.restoreStructure.version;
          },
        },
      });

      // Call user-provided update function if exists
      if (options?.update) {
        options.update(cache, { data }, context);
      }
    },
  });

  return useMemo(
    () => ({
      restoreStructure: async (id: string, branchId?: string) => {
        const { data } = await mutate({ variables: { id, branchId } });
        return data?.restoreStructure;
      },
      loading: result.loading,
      error: result.error,
      data: result.data?.restoreStructure,
      reset: result.reset,
    }),
    [mutate, result.loading, result.error, result.data, result.reset]
  );
}
