import { gql } from '@apollo/client';
import { useQuery, type QueryHookOptions } from '@apollo/client/react';
import { useMemo } from 'react';

// TODO: Once code generation runs, import these types from generated file:
// import type {
//   GetDependencyGraphQuery,
//   GetDependencyGraphQueryVariables,
// } from '@/__generated__/graphql';

// Temporary placeholder types until code generation runs
type DependencyNodeType = 'VARIABLE' | 'CONDITION' | 'EFFECT' | 'ENTITY';
type DependencyEdgeType = 'READS' | 'WRITES' | 'DEPENDS_ON';

type DependencyNode = {
  id: string;
  type: DependencyNodeType;
  entityId: string;
  metadata?: Record<string, unknown> | null;
  label?: string | null;
};

type DependencyEdge = {
  fromId: string;
  toId: string;
  type: DependencyEdgeType;
  metadata?: Record<string, unknown> | null;
};

type DependencyGraphStats = {
  nodeCount: number;
  edgeCount: number;
  variableCount: number;
  conditionCount: number;
  effectCount: number;
  entityCount: number;
};

type DependencyGraphResult = {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  stats: DependencyGraphStats;
  campaignId: string;
  branchId: string;
  builtAt: string;
};

type GetDependencyGraphQuery = {
  getDependencyGraph: DependencyGraphResult;
};

type GetDependencyGraphQueryVariables = {
  campaignId: string;
  branchId?: string;
};

/**
 * GraphQL query to get the complete dependency graph for a campaign and branch.
 *
 * This query fetches all nodes (variables, conditions, effects, entities) and edges
 * (reads, writes, depends_on relationships) in the dependency graph, along with
 * statistics about the graph structure.
 *
 * @see DependencyGraphResolver.getDependencyGraph in packages/api/src/graphql/resolvers/dependency-graph.resolver.ts
 */
export const GET_DEPENDENCY_GRAPH = gql`
  query GetDependencyGraph($campaignId: ID!, $branchId: String = "main") {
    getDependencyGraph(campaignId: $campaignId, branchId: $branchId) {
      nodes {
        id
        type
        entityId
        metadata
        label
      }
      edges {
        fromId
        toId
        type
        metadata
      }
      stats {
        nodeCount
        edgeCount
        variableCount
        conditionCount
        effectCount
        entityCount
      }
      campaignId
      branchId
      builtAt
    }
  }
`;

/**
 * Hook to fetch the dependency graph for a campaign and branch.
 *
 * Returns the complete dependency graph including all nodes, edges, and statistics.
 * The graph can be used to visualize relationships between variables, conditions,
 * effects, and entities in the campaign.
 *
 * @param campaignId - The ID of the campaign
 * @param branchId - The branch ID (defaults to "main" on the backend if not provided)
 * @param options - Additional Apollo query options
 *
 * @returns Object containing:
 *   - graph: The complete dependency graph data
 *   - loading: Loading state
 *   - error: Error object if query failed
 *   - refetch: Function to manually refetch the graph
 *
 * @example
 * ```tsx
 * const { graph, loading, error } = useDependencyGraph(campaignId);
 *
 * if (loading) return <Spinner />;
 * if (error) return <Error message={error.message} />;
 *
 * return (
 *   <FlowChart
 *     nodes={graph.nodes}
 *     edges={graph.edges}
 *     stats={graph.stats}
 *   />
 * );
 * ```
 */
export function useDependencyGraph(
  campaignId: string,
  branchId?: string,
  options?: QueryHookOptions<GetDependencyGraphQuery, GetDependencyGraphQueryVariables>
) {
  const { data, loading, error, refetch } = useQuery<
    GetDependencyGraphQuery,
    GetDependencyGraphQueryVariables
  >(GET_DEPENDENCY_GRAPH, {
    variables: {
      campaignId,
      ...(branchId && { branchId }),
    },
    // Cache and network strategy: prioritize network to get latest graph state
    fetchPolicy: 'cache-and-network',
    // Only refetch on explicit user action (not on window focus)
    notifyOnNetworkStatusChange: true,
    ...options,
  });

  const graph = useMemo(() => data?.getDependencyGraph ?? null, [data]);

  return {
    graph,
    loading,
    error,
    refetch,
  };
}

/**
 * Export types for use in other components
 */
export type {
  DependencyNode,
  DependencyEdge,
  DependencyNodeType,
  DependencyEdgeType,
  DependencyGraphStats,
  DependencyGraphResult,
};
