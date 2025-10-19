import type { Node, Edge } from '@xyflow/react';

import type { DependencyEdgeType, DependencyNodeType } from '@/services/api/hooks';

import type { FlowNodeData } from './graph-layout';

/**
 * Filter configuration for the dependency graph visualization.
 * Allows filtering by node types, edge types, search query, and cycle detection.
 */
export type GraphFilters = {
  /** Search query to filter nodes by label (case-insensitive) */
  searchQuery: string;
  /** Set of node types to show (empty set = show all) */
  nodeTypes: Set<DependencyNodeType>;
  /** Set of edge types to show (empty set = show all) */
  edgeTypes: Set<DependencyEdgeType>;
  /** If true, show only nodes involved in cycles */
  showCyclesOnly: boolean;
  /** If true, show only selected nodes and their connected nodes */
  showSelectedOnly: boolean;
};

/**
 * Creates an empty filter configuration (shows everything).
 */
export function createEmptyFilters(): GraphFilters {
  return {
    searchQuery: '',
    nodeTypes: new Set(),
    edgeTypes: new Set(),
    showCyclesOnly: false,
    showSelectedOnly: false,
  };
}

/**
 * Checks if any filters are active.
 * @param filters - The filter configuration
 * @returns True if any filters are active, false otherwise
 */
export function hasActiveFilters(filters: GraphFilters): boolean {
  return (
    filters.searchQuery !== '' ||
    filters.nodeTypes.size > 0 ||
    filters.edgeTypes.size > 0 ||
    filters.showCyclesOnly ||
    filters.showSelectedOnly
  );
}

/**
 * Detects cycles in the dependency graph using depth-first search.
 * Returns the set of node IDs that are part of any cycle.
 *
 * @param nodes - The graph nodes
 * @param edges - The graph edges
 * @returns Set of node IDs that are part of cycles
 *
 * @example
 * ```ts
 * const cycleNodeIds = detectCycles(nodes, edges);
 * const nodesInCycles = nodes.filter(n => cycleNodeIds.has(n.id));
 * ```
 */
export function detectCycles(nodes: Node<FlowNodeData>[], edges: Edge[]): Set<string> {
  const cycleNodes = new Set<string>();
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  // Build adjacency list
  const adjacencyList = new Map<string, string[]>();
  for (const node of nodes) {
    adjacencyList.set(node.id, []);
  }
  for (const edge of edges) {
    const neighbors = adjacencyList.get(edge.source);
    if (neighbors) {
      neighbors.push(edge.target);
    }
  }

  // DFS to detect cycles
  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        if (dfs(neighborId)) {
          cycleNodes.add(nodeId);
          return true;
        }
      } else if (recursionStack.has(neighborId)) {
        // Cycle detected - add all nodes in recursion stack
        cycleNodes.add(nodeId);
        cycleNodes.add(neighborId);
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  // Run DFS from each unvisited node
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  }

  return cycleNodes;
}

/**
 * Filters nodes based on the current filter configuration.
 *
 * @param nodes - All nodes in the graph
 * @param edges - All edges in the graph
 * @param filters - The filter configuration
 * @param selectedNodeIds - Currently selected node IDs (for "show selected only" filter)
 * @returns Filtered array of nodes
 */
export function filterNodes(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  filters: GraphFilters,
  selectedNodeIds: string[] = []
): Node<FlowNodeData>[] {
  // Start with all nodes
  let filteredNodes = nodes;

  // Filter by search query (case-insensitive)
  if (filters.searchQuery.trim() !== '') {
    const query = filters.searchQuery.toLowerCase();
    filteredNodes = filteredNodes.filter((node) => node.data.label.toLowerCase().includes(query));
  }

  // Filter by node type
  if (filters.nodeTypes.size > 0) {
    filteredNodes = filteredNodes.filter((node) => filters.nodeTypes.has(node.data.nodeType));
  }

  // Filter by cycles
  if (filters.showCyclesOnly) {
    const cycleNodeIds = detectCycles(nodes, edges);
    filteredNodes = filteredNodes.filter((node) => cycleNodeIds.has(node.id));
  }

  // Filter by selection and connected nodes
  if (filters.showSelectedOnly && selectedNodeIds.length > 0) {
    // Get all connected node IDs (upstream and downstream)
    const connectedNodeIds = new Set<string>(selectedNodeIds);

    // Add all nodes connected by edges (in either direction)
    for (const edge of edges) {
      if (connectedNodeIds.has(edge.source)) {
        connectedNodeIds.add(edge.target);
      }
      if (connectedNodeIds.has(edge.target)) {
        connectedNodeIds.add(edge.source);
      }
    }

    filteredNodes = filteredNodes.filter((node) => connectedNodeIds.has(node.id));
  }

  return filteredNodes;
}

/**
 * Filters edges based on the current filter configuration.
 * Only shows edges where both source and target nodes are visible.
 *
 * @param edges - All edges in the graph
 * @param visibleNodeIds - Set of visible node IDs (after node filtering)
 * @param filters - The filter configuration
 * @returns Filtered array of edges
 */
export function filterEdges(
  edges: Edge[],
  visibleNodeIds: Set<string>,
  filters: GraphFilters
): Edge[] {
  let filteredEdges = edges;

  // Only show edges where both nodes are visible
  filteredEdges = filteredEdges.filter(
    (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
  );

  // Filter by edge type
  if (filters.edgeTypes.size > 0) {
    filteredEdges = filteredEdges.filter((edge) => {
      const edgeType = edge.data?.edgeType;
      return edgeType && filters.edgeTypes.has(edgeType);
    });
  }

  return filteredEdges;
}

/**
 * Gets the count of nodes that match a specific node type.
 * Used for displaying filter counts in the UI.
 *
 * @param nodes - All nodes in the graph
 * @param nodeType - The node type to count
 * @returns Number of nodes of that type
 */
export function getNodeTypeCount(
  nodes: Node<FlowNodeData>[],
  nodeType: DependencyNodeType
): number {
  return nodes.filter((node) => node.data.nodeType === nodeType).length;
}

/**
 * Gets the count of edges that match a specific edge type.
 * Used for displaying filter counts in the UI.
 *
 * @param edges - All edges in the graph
 * @param edgeType - The edge type to count
 * @returns Number of edges of that type
 */
export function getEdgeTypeCount(edges: Edge[], edgeType: DependencyEdgeType): number {
  return edges.filter((edge) => edge.data?.edgeType === edgeType).length;
}
