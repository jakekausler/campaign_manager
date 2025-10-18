import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useMemo } from 'react';

/**
 * Placeholder types for Settlement mutations until code generation runs.
 * TODO: Replace with generated types from @/__generated__/graphql once backend is fixed.
 */

export interface CreateSettlementInput {
  kingdomId: string;
  locationId: string;
  name: string;
  level?: number;
  branchId?: string;
}

export interface UpdateSettlementInput {
  name?: string;
  level?: number;
  branchId?: string;
  expectedVersion?: number;
  worldTime?: string;
}

export interface Settlement {
  id: string;
  kingdomId: string;
  locationId: string;
  name: string;
  level: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  version: number;
}

/**
 * GraphQL mutation to create a new settlement.
 */
export const CREATE_SETTLEMENT = gql`
  mutation CreateSettlement($input: CreateSettlementInput!) {
    createSettlement(input: $input) {
      id
      kingdomId
      locationId
      name
      level
      createdAt
      updatedAt
      version
    }
  }
`;

/**
 * GraphQL mutation to update an existing settlement.
 */
export const UPDATE_SETTLEMENT = gql`
  mutation UpdateSettlement($id: ID!, $input: UpdateSettlementInput!) {
    updateSettlement(id: $id, input: $input) {
      id
      kingdomId
      locationId
      name
      level
      updatedAt
      version
    }
  }
`;

/**
 * GraphQL mutation to delete a settlement (soft delete).
 */
export const DELETE_SETTLEMENT = gql`
  mutation DeleteSettlement($id: ID!, $branchId: String) {
    deleteSettlement(id: $id, branchId: $branchId) {
      id
      deletedAt
      version
    }
  }
`;

/**
 * GraphQL mutation to archive a settlement.
 */
export const ARCHIVE_SETTLEMENT = gql`
  mutation ArchiveSettlement($id: ID!, $branchId: String) {
    archiveSettlement(id: $id, branchId: $branchId) {
      id
      deletedAt
      version
    }
  }
`;

/**
 * GraphQL mutation to restore an archived settlement.
 */
export const RESTORE_SETTLEMENT = gql`
  mutation RestoreSettlement($id: ID!, $branchId: String) {
    restoreSettlement(id: $id, branchId: $branchId) {
      id
      deletedAt
      version
    }
  }
`;

/**
 * Hook to create a new settlement with optimistic updates.
 *
 * @param options - Apollo Client mutation options
 * @returns Mutation function and state
 *
 * @example
 * ```tsx
 * function CreateSettlementForm({ kingdomId }: { kingdomId: string }) {
 *   const { createSettlement, loading, error } = useCreateSettlement();
 *
 *   const handleSubmit = async (data: { name: string; locationId: string }) => {
 *     try {
 *       const settlement = await createSettlement({
 *         kingdomId,
 *         locationId: data.locationId,
 *         name: data.name,
 *         level: 1,
 *       });
 *       console.log('Created:', settlement);
 *     } catch (err) {
 *       console.error('Failed to create settlement:', err);
 *     }
 *   };
 *
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */
export function useCreateSettlement(
  options?: useMutation.Options<{ createSettlement: Settlement }, { input: CreateSettlementInput }>
) {
  const [mutate, result] = useMutation<
    { createSettlement: Settlement },
    { input: CreateSettlementInput }
  >(CREATE_SETTLEMENT, {
    ...options,
    // Refetch the settlementsByKingdom query to ensure cache consistency
    refetchQueries: ['SettlementsByKingdom'],
    update(cache, { data }, context) {
      if (!data?.createSettlement) return;

      // Call user-provided update function if exists
      if (options?.update) {
        options.update(cache, { data }, context);
      }
    },
  });

  return useMemo(
    () => ({
      createSettlement: async (input: CreateSettlementInput) => {
        const { data } = await mutate({ variables: { input } });
        return data?.createSettlement;
      },
      loading: result.loading,
      error: result.error,
      data: result.data?.createSettlement,
      reset: result.reset,
    }),
    [mutate, result.loading, result.error, result.data, result.reset]
  );
}

/**
 * Hook to update an existing settlement with optimistic updates.
 *
 * @param options - Apollo Client mutation options
 * @returns Mutation function and state
 *
 * @example
 * ```tsx
 * function SettlementEditor({ settlementId }: { settlementId: string }) {
 *   const { updateSettlement, loading, error } = useUpdateSettlement();
 *
 *   const handleSave = async (data: { name: string; level: number }) => {
 *     try {
 *       const updated = await updateSettlement(settlementId, data);
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
export function useUpdateSettlement(
  options?: useMutation.Options<
    { updateSettlement: Settlement },
    { id: string; input: UpdateSettlementInput }
  >
) {
  const [mutate, result] = useMutation<
    { updateSettlement: Settlement },
    { id: string; input: UpdateSettlementInput }
  >(UPDATE_SETTLEMENT, {
    ...options,
    update(cache, { data }, context) {
      if (!data?.updateSettlement) return;

      // Call user-provided update function if exists
      if (options?.update) {
        options.update(cache, { data }, context);
      }
    },
  });

  return useMemo(
    () => ({
      updateSettlement: async (id: string, input: UpdateSettlementInput) => {
        const { data } = await mutate({ variables: { id, input } });
        return data?.updateSettlement;
      },
      loading: result.loading,
      error: result.error,
      data: result.data?.updateSettlement,
      reset: result.reset,
    }),
    [mutate, result.loading, result.error, result.data, result.reset]
  );
}

/**
 * Hook to delete a settlement with optimistic updates.
 *
 * @param options - Apollo Client mutation options
 * @returns Mutation function and state
 *
 * @example
 * ```tsx
 * function DeleteSettlementButton({ settlementId }: { settlementId: string }) {
 *   const { deleteSettlement, loading } = useDeleteSettlement();
 *
 *   const handleDelete = async () => {
 *     if (!confirm('Are you sure?')) return;
 *     try {
 *       await deleteSettlement(settlementId);
 *     } catch (err) {
 *       console.error('Failed to delete:', err);
 *     }
 *   };
 *
 *   return <button onClick={handleDelete} disabled={loading}>Delete</button>;
 * }
 * ```
 */
export function useDeleteSettlement(
  options?: useMutation.Options<{ deleteSettlement: Settlement }, { id: string; branchId?: string }>
) {
  const [mutate, result] = useMutation<
    { deleteSettlement: Settlement },
    { id: string; branchId?: string }
  >(DELETE_SETTLEMENT, {
    ...options,
    // Refetch the settlementsByKingdom query to ensure removed settlement doesn't appear in lists
    refetchQueries: ['SettlementsByKingdom'],
    update(cache, { data }, context) {
      if (!data?.deleteSettlement || !context.variables) return;

      const settlementId = context.variables.id;

      // Evict the settlement from cache
      cache.evict({ id: cache.identify({ __typename: 'Settlement', id: settlementId }) });
      cache.gc();

      // Call user-provided update function if exists
      if (options?.update) {
        options.update(cache, { data }, context);
      }
    },
  });

  return useMemo(
    () => ({
      deleteSettlement: async (id: string, branchId?: string) => {
        const { data } = await mutate({ variables: { id, branchId } });
        return data?.deleteSettlement;
      },
      loading: result.loading,
      error: result.error,
      data: result.data?.deleteSettlement,
      reset: result.reset,
    }),
    [mutate, result.loading, result.error, result.data, result.reset]
  );
}

/**
 * Hook to archive a settlement.
 *
 * Archiving is similar to deleting but may have different business logic on the backend.
 *
 * @param options - Apollo Client mutation options
 * @returns Mutation function and state
 */
export function useArchiveSettlement(
  options?: useMutation.Options<
    { archiveSettlement: Settlement },
    { id: string; branchId?: string }
  >
) {
  const [mutate, result] = useMutation<
    { archiveSettlement: Settlement },
    { id: string; branchId?: string }
  >(ARCHIVE_SETTLEMENT, {
    ...options,
    update(cache, { data }, context) {
      if (!data?.archiveSettlement) return;

      // Update the deletedAt field in the cache
      cache.modify({
        id: cache.identify({ __typename: 'Settlement', id: data.archiveSettlement.id }),
        fields: {
          deletedAt() {
            return data.archiveSettlement.deletedAt;
          },
          version() {
            return data.archiveSettlement.version;
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
      archiveSettlement: async (id: string, branchId?: string) => {
        const { data } = await mutate({ variables: { id, branchId } });
        return data?.archiveSettlement;
      },
      loading: result.loading,
      error: result.error,
      data: result.data?.archiveSettlement,
      reset: result.reset,
    }),
    [mutate, result.loading, result.error, result.data, result.reset]
  );
}

/**
 * Hook to restore an archived settlement.
 *
 * @param options - Apollo Client mutation options
 * @returns Mutation function and state
 */
export function useRestoreSettlement(
  options?: useMutation.Options<
    { restoreSettlement: Settlement },
    { id: string; branchId?: string }
  >
) {
  const [mutate, result] = useMutation<
    { restoreSettlement: Settlement },
    { id: string; branchId?: string }
  >(RESTORE_SETTLEMENT, {
    ...options,
    update(cache, { data }, context) {
      if (!data?.restoreSettlement) return;

      // Update the deletedAt field in the cache (should be null after restore)
      cache.modify({
        id: cache.identify({ __typename: 'Settlement', id: data.restoreSettlement.id }),
        fields: {
          deletedAt() {
            return data.restoreSettlement.deletedAt;
          },
          version() {
            return data.restoreSettlement.version;
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
      restoreSettlement: async (id: string, branchId?: string) => {
        const { data } = await mutate({ variables: { id, branchId } });
        return data?.restoreSettlement;
      },
      loading: result.loading,
      error: result.error,
      data: result.data?.restoreSettlement,
      reset: result.reset,
    }),
    [mutate, result.loading, result.error, result.data, result.reset]
  );
}
