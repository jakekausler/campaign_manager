import type { Node, Edge } from '@xyflow/react';
import * as dagre from 'dagre';

import type {
  DependencyGraphResult,
  DependencyNode,
  DependencyEdge,
  DependencyNodeType,
  DependencyEdgeType,
} from '@/services/api/hooks';

/**
 * Node width and height for layout calculations
 */
const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

/**
 * Spacing between nodes in the layout
 */
const NODE_SPACING = {
  horizontal: 100, // Space between nodes horizontally
  vertical: 80, // Space between nodes vertically
};

/**
 * React Flow node data structure for dependency graph nodes.
 * Contains metadata from the backend plus visual information.
 */
export type FlowNodeData = {
  label: string;
  nodeType: DependencyNodeType;
  entityId: string;
  metadata?: Record<string, unknown> | null;
};

/**
 * React Flow edge data structure for dependency graph edges.
 * Contains relationship type and metadata.
 *
 * This extends React Flow's Edge type to include our custom data fields.
 */
export type FlowEdgeData = Edge<{
  edgeType: DependencyEdgeType;
  metadata?: Record<string, unknown> | null;
}>;

/**
 * Complete transformation result including nodes and edges
 */
export type TransformedGraphData = {
  nodes: Node<FlowNodeData>[];
  edges: FlowEdgeData[];
};

/**
 * Transform a DependencyNode to React Flow Node format.
 *
 * Maps backend node structure to React Flow's expected format with:
 * - Unique ID
 * - Type for custom rendering (lowercase)
 * - Position (to be calculated by layout algorithm)
 * - Data containing label and metadata
 * - Styling based on node type
 */
export function transformNode(node: DependencyNode): Node<FlowNodeData> {
  const label = node.label || node.entityId; // Fallback to entityId if no label

  // Map backend uppercase types to lowercase for React Flow node types
  const typeMap: Record<DependencyNodeType, string> = {
    VARIABLE: 'variable',
    CONDITION: 'condition',
    EFFECT: 'effect',
    ENTITY: 'entity',
  };

  return {
    id: node.id,
    type: typeMap[node.type], // Lowercase type for React Flow custom components
    position: { x: 0, y: 0 }, // Will be set by layout algorithm
    data: {
      label,
      nodeType: node.type, // Keep uppercase in data for display
      entityId: node.entityId,
      metadata: node.metadata,
    },
    // Note: backgroundColor style removed - custom node components handle their own colors
  };
}

/**
 * Transform a DependencyEdge to React Flow Edge format.
 *
 * Maps backend edge structure to React Flow's expected format with:
 * - Unique ID based on source and target
 * - Source and target node IDs
 * - Custom edge type for specialized rendering
 * - Data containing edge type and metadata
 * - Arrow marker at the end
 *
 * Edge types map to custom React Flow components:
 * - READS → 'reads' (ReadsEdge component)
 * - WRITES → 'writes' (WritesEdge component)
 * - DEPENDS_ON → 'dependson' (DependsOnEdge component)
 */
export function transformEdge(edge: DependencyEdge): FlowEdgeData {
  // Map backend uppercase types to lowercase for React Flow edge types
  const typeMap: Record<DependencyEdgeType, string> = {
    READS: 'reads',
    WRITES: 'writes',
    DEPENDS_ON: 'dependson',
  };

  // Define color based on edge type
  const edgeColor =
    edge.type === 'WRITES' ? '#f97316' : edge.type === 'DEPENDS_ON' ? '#a855f7' : '#64748b';

  return {
    id: `${edge.fromId}-${edge.toId}`,
    source: edge.fromId,
    target: edge.toId,
    type: typeMap[edge.type], // Lowercase type for React Flow custom components
    data: {
      edgeType: edge.type, // Keep uppercase in data for reference
      metadata: edge.metadata,
    },
    // markerEnd expects a string ID reference to an SVG marker definition
    // We'll use a template string to create a unique marker ID based on color
    markerEnd: `arrow-${edgeColor.replace('#', '')}`,
    style: {
      stroke: edgeColor,
    },
  };
}

/**
 * Apply automatic layout to nodes using Dagre algorithm.
 *
 * Dagre is a hierarchical graph layout algorithm that arranges nodes
 * in layers to minimize edge crossings and produce a readable layout.
 *
 * Layout direction: Top to bottom (TB)
 * - Variables and entities at the top
 * - Conditions in the middle
 * - Effects at the bottom
 *
 * @param nodes - Array of React Flow nodes (without positions)
 * @param edges - Array of React Flow edges
 * @returns Nodes with calculated positions
 */
export function applyAutoLayout(
  nodes: Node<FlowNodeData>[],
  edges: FlowEdgeData[]
): Node<FlowNodeData>[] {
  // Create a new directed graph
  const graph = new dagre.graphlib.Graph();

  // Configure graph layout options
  graph.setGraph({
    rankdir: 'TB', // Top to bottom layout
    align: 'UL', // Align nodes to upper-left within their rank
    nodesep: NODE_SPACING.horizontal, // Horizontal spacing between nodes
    ranksep: NODE_SPACING.vertical, // Vertical spacing between ranks
    marginx: 50, // Margin around the graph
    marginy: 50,
  });

  // Set default edge label (empty)
  graph.setDefaultEdgeLabel(() => ({}));

  // Add nodes to the graph with their dimensions
  nodes.forEach((node) => {
    graph.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  });

  // Add edges to the graph
  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  // Run the layout algorithm
  dagre.layout(graph);

  // Update node positions based on layout
  return nodes.map((node) => {
    const position = graph.node(node.id);

    return {
      ...node,
      position: {
        // Center the node on its calculated position
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      },
    };
  });
}

/**
 * Transform complete dependency graph to React Flow format with auto-layout.
 *
 * This is the main transformation function that:
 * 1. Transforms all nodes from backend format to React Flow format
 * 2. Transforms all edges from backend format to React Flow format
 * 3. Applies Dagre layout algorithm to position nodes
 *
 * @param graphData - Complete dependency graph from backend
 * @returns Object containing positioned nodes and styled edges ready for React Flow
 *
 * @example
 * ```tsx
 * const { graph } = useDependencyGraph(campaignId);
 * const { nodes, edges } = transformGraphToFlow(graph);
 *
 * return <ReactFlow nodes={nodes} edges={edges} />;
 * ```
 */
export function transformGraphToFlow(graphData: DependencyGraphResult): TransformedGraphData {
  // Transform nodes and edges to React Flow format
  const nodes = graphData.nodes.map(transformNode);
  const edges = graphData.edges.map(transformEdge);

  // Apply auto-layout to position nodes
  const positionedNodes = applyAutoLayout(nodes, edges);

  return {
    nodes: positionedNodes,
    edges,
  };
}
