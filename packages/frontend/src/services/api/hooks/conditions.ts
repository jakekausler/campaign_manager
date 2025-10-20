import { gql } from '@apollo/client';
import {
  useQuery,
  useLazyQuery,
  type QueryHookOptions,
  type LazyQueryHookOptions,
} from '@apollo/client/react';
import { useMemo } from 'react';

// TODO: Once code generation runs, import these types from generated file:
// import type {
//   GetConditionsForEntityQuery,
//   GetConditionsForEntityQueryVariables,
//   EvaluateFieldConditionQuery,
//   EvaluateFieldConditionQueryVariables,
// } from '@/__generated__/graphql';

// Temporary placeholder types until code generation runs
type FieldCondition = {
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
};

type EvaluationTrace = {
  step: number;
  operation: string;
  input: unknown;
  output: unknown;
  description?: string | null;
};

type EvaluationResult = {
  value: unknown;
  success: boolean;
  trace: EvaluationTrace[];
  error?: string | null;
};

type GetConditionsForEntityQuery = {
  getConditionsForEntity: FieldCondition[];
};

type GetConditionsForEntityQueryVariables = {
  entityType: string;
  entityId: string;
  field?: string | null;
};

type EvaluateFieldConditionQuery = {
  evaluateFieldCondition: EvaluationResult;
};

type EvaluateFieldConditionQueryVariables = {
  input: {
    conditionId: string;
    context: Record<string, unknown>;
  };
};

/**
 * GraphQL query to get all field conditions for a specific entity.
 *
 * This query fetches all conditions that apply to an entity, optionally
 * filtered by a specific field name. Includes instance-level and type-level
 * conditions.
 *
 * @param entityType - The type of entity (e.g., "Settlement", "Structure")
 * @param entityId - The ID of the entity instance
 * @param field - Optional field name to filter conditions (e.g., "is_trade_hub")
 * @returns Array of FieldCondition objects
 */
export const GET_CONDITIONS_FOR_ENTITY = gql`
  query GetConditionsForEntity($entityType: String!, $entityId: ID!, $field: String) {
    getConditionsForEntity(entityType: $entityType, entityId: $entityId, field: $field) {
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
 * GraphQL query to evaluate a field condition with a given context.
 *
 * This query evaluates a condition's JSONLogic expression against provided
 * context data and returns the result along with a detailed evaluation trace
 * for debugging and explanation purposes.
 *
 * @param input.conditionId - The ID of the condition to evaluate
 * @param input.context - The context data to use for evaluation
 * @returns EvaluationResult with value, success status, trace, and optional error
 */
export const EVALUATE_FIELD_CONDITION = gql`
  query EvaluateFieldCondition($input: EvaluateConditionInput!) {
    evaluateFieldCondition(input: $input) {
      value
      success
      trace {
        step
        operation
        input
        output
        description
      }
      error
    }
  }
`;

/**
 * Hook to fetch all field conditions for a specific entity.
 *
 * Uses cache-first fetch policy for performance. Returns both instance-level
 * conditions (specific to the entity) and type-level conditions (apply to all
 * entities of that type).
 *
 * @param entityType - The type of entity (e.g., "Settlement", "Structure")
 * @param entityId - The ID of the entity instance
 * @param field - Optional field name to filter conditions
 * @param options - Additional Apollo query options (skip, onCompleted, onError, etc.)
 * @returns Query result with conditions data, loading state, and error state
 *
 * @example
 * ```tsx
 * function EntityConditionsList({ entityType, entityId }: Props) {
 *   const { conditions, loading, error, refetch } = useConditionsForEntity(
 *     entityType,
 *     entityId
 *   );
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorAlert message={error.message} />;
 *   if (conditions.length === 0) return <EmptyState />;
 *
 *   return (
 *     <ul>
 *       {conditions.map(condition => (
 *         <li key={condition.id}>
 *           {condition.field}: {condition.description}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useConditionsForEntity(
  entityType: string,
  entityId: string,
  field?: string | null,
  options?: Omit<
    QueryHookOptions<GetConditionsForEntityQuery, GetConditionsForEntityQueryVariables>,
    'variables'
  >
) {
  const result = useQuery<GetConditionsForEntityQuery, GetConditionsForEntityQueryVariables>(
    GET_CONDITIONS_FOR_ENTITY,
    {
      variables: { entityType, entityId, field: field ?? null },
      fetchPolicy: 'cache-first', // Use cached data for performance
      ...options,
    }
  );

  // Return a simplified data shape for easier consumption
  return useMemo(
    () => ({
      conditions: result.data?.getConditionsForEntity ?? [],
      loading: result.loading,
      error: result.error,
      refetch: result.refetch,
      networkStatus: result.networkStatus,
    }),
    [result.data, result.loading, result.error, result.refetch, result.networkStatus]
  );
}

/**
 * Hook to evaluate a field condition with custom context.
 *
 * This is a lazy query hook that doesn't execute immediately. Call the returned
 * `evaluate` function to trigger evaluation. Useful for on-demand condition
 * explanation and testing.
 *
 * Returns detailed evaluation trace that shows each step of the JSONLogic
 * evaluation process, which is helpful for debugging and explaining condition
 * results to users.
 *
 * @param options - Additional Apollo lazy query options (onCompleted, onError, etc.)
 * @returns Tuple with [evaluate function, query result]
 *
 * @example
 * ```tsx
 * function ConditionExplanation({ conditionId }: Props) {
 *   const [evaluate, { data, loading, error }] = useEvaluateCondition();
 *
 *   const handleExplain = async () => {
 *     await evaluate({
 *       variables: {
 *         input: {
 *           conditionId,
 *           context: { level: 3, population: 1500 }
 *         }
 *       }
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleExplain}>Explain Condition</button>
 *       {loading && <Spinner />}
 *       {error && <ErrorAlert message={error.message} />}
 *       {data && (
 *         <div>
 *           <p>Result: {JSON.stringify(data.evaluateFieldCondition.value)}</p>
 *           <p>Success: {data.evaluateFieldCondition.success}</p>
 *           <h3>Evaluation Trace:</h3>
 *           <ul>
 *             {data.evaluateFieldCondition.trace.map((step, idx) => (
 *               <li key={idx}>
 *                 Step {step.step}: {step.operation} - {step.description}
 *               </li>
 *             ))}
 *           </ul>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useEvaluateCondition(
  options?: LazyQueryHookOptions<EvaluateFieldConditionQuery, EvaluateFieldConditionQueryVariables>
) {
  return useLazyQuery<EvaluateFieldConditionQuery, EvaluateFieldConditionQueryVariables>(
    EVALUATE_FIELD_CONDITION,
    {
      fetchPolicy: 'network-only', // Always fetch fresh evaluation results
      ...options,
    }
  );
}
