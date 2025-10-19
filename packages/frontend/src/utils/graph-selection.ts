import type { Node, Edge } from '@xyflow/react';

import type { FlowEdgeData, FlowNodeData } from './graph-layout';

/**
 * Selection state for nodes in the dependency graph.
 * Tracks which nodes are selected and which are highlighted as dependencies.
 */
export type SelectionState = {
  /** IDs of nodes directly selected by the user */
  selectedNodeIds: string[];
  /** IDs of upstream nodes (dependencies) */
  upstreamNodeIds: string[];
  /** IDs of downstream nodes (dependents) */
  downstreamNodeIds: string[];
};

/**
 * Get all upstream dependencies (nodes that the selected node depends on).
 *
 * Traverses the graph following edges where the selected node is the target.
 * This finds all nodes that the selected node reads from or depends on.
 *
 * @param nodeId - ID of the node to find dependencies for
 * @param edges - All edges in the graph
 * @param maxDepth - Maximum depth to traverse (default: Infinity for full traversal)
 * @returns Set of node IDs that are upstream dependencies
 */
export function getUpstreamNodes(
  nodeId: string,
  edges: Edge[],
  maxDepth: number = Infinity
): Set<string> {
  const upstream = new Set<string>();
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Skip if already visited or max depth reached
    if (visited.has(current.id) || current.depth >= maxDepth) {
      continue;
    }

    visited.add(current.id);

    // Find all edges where current node is the target
    const incomingEdges = edges.filter((edge) => edge.target === current.id);

    incomingEdges.forEach((edge) => {
      // Don't add the original node to its own upstream set
      if (edge.source !== nodeId) {
        upstream.add(edge.source);
      }
      queue.push({ id: edge.source, depth: current.depth + 1 });
    });
  }

  return upstream;
}

/**
 * Get all downstream dependents (nodes that depend on the selected node).
 *
 * Traverses the graph following edges where the selected node is the source.
 * This finds all nodes that read from or depend on the selected node.
 *
 * @param nodeId - ID of the node to find dependents for
 * @param edges - All edges in the graph
 * @param maxDepth - Maximum depth to traverse (default: Infinity for full traversal)
 * @returns Set of node IDs that are downstream dependents
 */
export function getDownstreamNodes(
  nodeId: string,
  edges: Edge[],
  maxDepth: number = Infinity
): Set<string> {
  const downstream = new Set<string>();
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Skip if already visited or max depth reached
    if (visited.has(current.id) || current.depth >= maxDepth) {
      continue;
    }

    visited.add(current.id);

    // Find all edges where current node is the source
    const outgoingEdges = edges.filter((edge) => edge.source === current.id);

    outgoingEdges.forEach((edge) => {
      // Don't add the original node to its own downstream set
      if (edge.target !== nodeId) {
        downstream.add(edge.target);
      }
      queue.push({ id: edge.target, depth: current.depth + 1 });
    });
  }

  return downstream;
}

/**
 * Calculate complete selection state including highlighted dependencies.
 *
 * For each selected node, finds all upstream and downstream dependencies
 * and combines them into a single selection state.
 *
 * @param selectedNodeIds - IDs of nodes selected by the user
 * @param edges - All edges in the graph
 * @returns Complete selection state with dependencies
 */
export function calculateSelectionState(selectedNodeIds: string[], edges: Edge[]): SelectionState {
  const allUpstream = new Set<string>();
  const allDownstream = new Set<string>();

  // Calculate dependencies for each selected node
  selectedNodeIds.forEach((nodeId) => {
    const upstream = getUpstreamNodes(nodeId, edges);
    const downstream = getDownstreamNodes(nodeId, edges);

    upstream.forEach((id) => allUpstream.add(id));
    downstream.forEach((id) => allDownstream.add(id));
  });

  return {
    selectedNodeIds,
    upstreamNodeIds: Array.from(allUpstream),
    downstreamNodeIds: Array.from(allDownstream),
  };
}

/**
 * Apply selection state to nodes by updating their styles.
 *
 * Modifies node styles to indicate:
 * - Selected nodes: Blue border and shadow
 * - Upstream nodes: Green border and reduced opacity
 * - Downstream nodes: Orange border and reduced opacity
 * - Unrelated nodes: Reduced opacity to de-emphasize
 *
 * @param nodes - All nodes in the graph
 * @param selectionState - Current selection state
 * @returns Nodes with updated styles
 */
export function applySelectionStyles(
  nodes: Node<FlowNodeData>[],
  selectionState: SelectionState
): Node<FlowNodeData>[] {
  const { selectedNodeIds, upstreamNodeIds, downstreamNodeIds } = selectionState;

  // If nothing is selected, return nodes as-is
  if (selectedNodeIds.length === 0) {
    return nodes;
  }

  return nodes.map((node) => {
    const isSelected = selectedNodeIds.includes(node.id);
    const isUpstream = upstreamNodeIds.includes(node.id);
    const isDownstream = downstreamNodeIds.includes(node.id);
    const isRelated = isSelected || isUpstream || isDownstream;

    // Base style changes
    const style: React.CSSProperties = {
      opacity: isRelated ? 1 : 0.3, // Dim unrelated nodes
    };

    // Selected nodes get blue border and shadow
    if (isSelected) {
      return {
        ...node,
        style: {
          ...style,
          border: '2px solid #3b82f6',
          boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.3)',
        },
        selected: true,
      };
    }

    // Upstream nodes get green border
    if (isUpstream) {
      return {
        ...node,
        style: {
          ...style,
          border: '2px solid #22c55e',
          boxShadow: '0 0 0 2px rgba(34, 197, 94, 0.2)',
        },
        selected: false,
      };
    }

    // Downstream nodes get orange border
    if (isDownstream) {
      return {
        ...node,
        style: {
          ...style,
          border: '2px solid #f97316',
          boxShadow: '0 0 0 2px rgba(249, 115, 22, 0.2)',
        },
        selected: false,
      };
    }

    // Unrelated nodes are dimmed
    return {
      ...node,
      style,
      selected: false,
    };
  });
}

/**
 * Apply selection state to edges by updating their styles.
 *
 * Modifies edge styles to indicate:
 * - Edges between selected/related nodes: Full opacity
 * - Edges to/from unrelated nodes: Reduced opacity
 *
 * @param edges - All edges in the graph
 * @param selectionState - Current selection state
 * @returns Edges with updated styles
 */
export function applySelectionEdgeStyles(
  edges: FlowEdgeData[],
  selectionState: SelectionState
): FlowEdgeData[] {
  const { selectedNodeIds, upstreamNodeIds, downstreamNodeIds } = selectionState;

  // If nothing is selected, return edges as-is
  if (selectedNodeIds.length === 0) {
    return edges;
  }

  const relatedNodeIds = new Set([...selectedNodeIds, ...upstreamNodeIds, ...downstreamNodeIds]);

  return edges.map((edge) => {
    const sourceRelated = relatedNodeIds.has(edge.source);
    const targetRelated = relatedNodeIds.has(edge.target);
    const isRelated = sourceRelated && targetRelated;

    return {
      ...edge,
      style: {
        ...edge.style,
        opacity: isRelated ? 1 : 0.2, // Dim unrelated edges
      },
    };
  });
}
