import { gql } from '@apollo/client';
import { useMutation, type MutationHookOptions } from '@apollo/client/react';
import { useMemo } from 'react';

/**
 * Placeholder types for FieldCondition mutations until code generation runs.
 * TODO: Replace with generated types from @/__generated__/graphql once code generation is set up.
 */

export interface CreateFieldConditionInput {
  entityType: string;
  entityId?: string | null;
  field: string;
  expression: Record<string, unknown>;
  description?: string | null;
  priority?: number;
}

export interface UpdateFieldConditionInput {
  expression?: Record<string, unknown>;
  description?: string | null;
  isActive?: boolean;
  priority?: number;
}

export interface FieldCondition {
  id: string;
  entityType: string;
  entityId?: string | null;
  field: string;
  expression: Record<string, unknown>;
  description?: string | null;
  isActive: boolean;
  priority: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  createdBy: string;
  updatedBy?: string | null;
}

/**
 * GraphQL mutation to create a new field condition.
 */
export const CREATE_FIELD_CONDITION = gql`
  mutation CreateFieldCondition($input: CreateFieldConditionInput!) {
    createFieldCondition(input: $input) {
      id
      entityType
      entityId
      field
      expression
      description
      isActive
      priority
      version
      createdAt
      updatedAt
      deletedAt
      createdBy
      updatedBy
    }
  }
`;

/**
 * GraphQL mutation to update an existing field condition.
 */
export const UPDATE_FIELD_CONDITION = gql`
  mutation UpdateFieldCondition($id: ID!, $input: UpdateFieldConditionInput!) {
    updateFieldCondition(id: $id, input: $input) {
      id
      entityType
      entityId
      field
      expression
      description
      isActive
      priority
      version
      createdAt
      updatedAt
      deletedAt
      createdBy
      updatedBy
    }
  }
`;

/**
 * GraphQL mutation to delete a field condition (soft delete).
 */
export const DELETE_FIELD_CONDITION = gql`
  mutation DeleteFieldCondition($id: ID!) {
    deleteFieldCondition(id: $id)
  }
`;

/**
 * Hook for creating a new field condition.
 *
 * @param options - Apollo mutation options
 * @returns Tuple with [createCondition function, mutation result]
 *
 * @example
 * ```tsx
 * function NewConditionForm({ entityType, entityId }: Props) {
 *   const { createCondition, loading, error } = useCreateFieldCondition();
 *
 *   const handleSave = async () => {
 *     try {
 *       const result = await createCondition({
 *         entityType,
 *         entityId,
 *         field: 'is_trade_hub',
 *         expression: { '==': [{ var: 'level' }, 3] },
 *         description: 'Settlement is a trade hub when level equals 3',
 *         priority: 10
 *       });
 *       console.log('Created condition:', result);
 *     } catch (err) {
 *       console.error('Failed to create condition:', err);
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleSave} disabled={loading}>
 *       {loading ? 'Creating...' : 'Create Condition'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useCreateFieldCondition(
  options?: MutationHookOptions<
    { createFieldCondition: FieldCondition },
    { input: CreateFieldConditionInput }
  >
) {
  const [mutate, result] = useMutation<
    { createFieldCondition: FieldCondition },
    { input: CreateFieldConditionInput }
  >(CREATE_FIELD_CONDITION, {
    ...options,
    refetchQueries: ['GetConditionsForEntity'], // Automatically refetch conditions list
  });

  return useMemo(
    () => ({
      createCondition: async (input: CreateFieldConditionInput) => {
        const response = await mutate({ variables: { input } });
        return response.data?.createFieldCondition;
      },
      loading: result.loading,
      error: result.error,
      data: result.data?.createFieldCondition,
    }),
    [mutate, result.loading, result.error, result.data]
  );
}

/**
 * Hook for updating an existing field condition.
 *
 * @param options - Apollo mutation options
 * @returns Tuple with [updateCondition function, mutation result]
 *
 * @example
 * ```tsx
 * function EditConditionForm({ conditionId }: Props) {
 *   const { updateCondition, loading, error } = useUpdateFieldCondition();
 *
 *   const handleSave = async (newExpression: JSONLogicExpression) => {
 *     try {
 *       const result = await updateCondition(conditionId, {
 *         expression: newExpression,
 *         description: 'Updated description',
 *       });
 *       console.log('Updated condition:', result);
 *     } catch (err) {
 *       console.error('Failed to update condition:', err);
 *     }
 *   };
 *
 *   return (
 *     <button onClick={() => handleSave(someExpression)} disabled={loading}>
 *       {loading ? 'Updating...' : 'Update Condition'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useUpdateFieldCondition(
  options?: MutationHookOptions<
    { updateFieldCondition: FieldCondition },
    { id: string; input: UpdateFieldConditionInput }
  >
) {
  const [mutate, result] = useMutation<
    { updateFieldCondition: FieldCondition },
    { id: string; input: UpdateFieldConditionInput }
  >(UPDATE_FIELD_CONDITION, {
    ...options,
    refetchQueries: ['GetConditionsForEntity'], // Automatically refetch conditions list
  });

  return useMemo(
    () => ({
      updateCondition: async (id: string, input: UpdateFieldConditionInput) => {
        const response = await mutate({ variables: { id, input } });
        return response.data?.updateFieldCondition;
      },
      loading: result.loading,
      error: result.error,
      data: result.data?.updateFieldCondition,
    }),
    [mutate, result.loading, result.error, result.data]
  );
}

/**
 * Hook for deleting a field condition (soft delete).
 *
 * @param options - Apollo mutation options
 * @returns Tuple with [deleteCondition function, mutation result]
 *
 * @example
 * ```tsx
 * function ConditionItem({ conditionId }: Props) {
 *   const { deleteCondition, loading, error } = useDeleteFieldCondition();
 *
 *   const handleDelete = async () => {
 *     try {
 *       const success = await deleteCondition(conditionId);
 *       if (success) {
 *         console.log('Condition deleted successfully');
 *       }
 *     } catch (err) {
 *       console.error('Failed to delete condition:', err);
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleDelete} disabled={loading}>
 *       {loading ? 'Deleting...' : 'Delete'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useDeleteFieldCondition(
  options?: MutationHookOptions<{ deleteFieldCondition: boolean }, { id: string }>
) {
  const [mutate, result] = useMutation<{ deleteFieldCondition: boolean }, { id: string }>(
    DELETE_FIELD_CONDITION,
    {
      ...options,
      refetchQueries: ['GetConditionsForEntity'], // Automatically refetch conditions list
    }
  );

  return useMemo(
    () => ({
      deleteCondition: async (id: string) => {
        const response = await mutate({ variables: { id } });
        return response.data?.deleteFieldCondition ?? false;
      },
      loading: result.loading,
      error: result.error,
      data: result.data?.deleteFieldCondition,
    }),
    [mutate, result.loading, result.error, result.data]
  );
}
