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
 */
export type FlowEdgeData = {
  edgeType: DependencyEdgeType;
  metadata?: Record<string, unknown> | null;
};

/**
 * Complete transformation result including nodes and edges
 */
export type TransformedGraphData = {
  nodes: Node<FlowNodeData>[];
  edges: Edge<FlowEdgeData>[];
};

/**
 * Get color scheme for a node based on its type.
 *
 * Color mapping:
 * - VARIABLE: Green (#22c55e) - represents data storage
 * - CONDITION: Blue (#3b82f6) - represents logic/rules
 * - EFFECT: Orange (#f97316) - represents side effects/actions
 * - ENTITY: Purple (#a855f7) - represents game entities
 */
function getNodeStyle(nodeType: DependencyNodeType): { backgroundColor: string; color: string } {
  switch (nodeType) {
    case 'VARIABLE':
      return { backgroundColor: '#22c55e', color: '#ffffff' }; // green-500
    case 'CONDITION':
      return { backgroundColor: '#3b82f6', color: '#ffffff' }; // blue-500
    case 'EFFECT':
      return { backgroundColor: '#f97316', color: '#ffffff' }; // orange-500
    case 'ENTITY':
      return { backgroundColor: '#a855f7', color: '#ffffff' }; // purple-500
    default:
      return { backgroundColor: '#6b7280', color: '#ffffff' }; // gray-500 fallback
  }
}

/**
 * Get edge style based on relationship type.
 *
 * Edge mapping:
 * - READS: Solid line - reading data
 * - WRITES: Dashed line - writing/mutating data
 * - DEPENDS_ON: Dotted line - dependency relationship
 */
function getEdgeStyle(edgeType: DependencyEdgeType): {
  strokeDasharray?: string;
  strokeWidth: number;
} {
  switch (edgeType) {
    case 'READS':
      return { strokeWidth: 2 }; // solid
    case 'WRITES':
      return { strokeDasharray: '5,5', strokeWidth: 2 }; // dashed
    case 'DEPENDS_ON':
      return { strokeDasharray: '2,2', strokeWidth: 2 }; // dotted
    default:
      return { strokeWidth: 1 };
  }
}

/**
 * Transform a DependencyNode to React Flow Node format.
 *
 * Maps backend node structure to React Flow's expected format with:
 * - Unique ID
 * - Type for custom rendering
 * - Position (to be calculated by layout algorithm)
 * - Data containing label and metadata
 * - Styling based on node type
 */
export function transformNode(node: DependencyNode): Node<FlowNodeData> {
  const style = getNodeStyle(node.type);
  const label = node.label || node.entityId; // Fallback to entityId if no label

  return {
    id: node.id,
    type: node.type.toLowerCase(), // 'variable', 'condition', 'effect', 'entity'
    position: { x: 0, y: 0 }, // Will be set by layout algorithm
    data: {
      label,
      nodeType: node.type,
      entityId: node.entityId,
      metadata: node.metadata,
    },
    style: {
      ...style,
      border: '2px solid rgba(0, 0, 0, 0.1)',
      borderRadius: '8px',
      padding: '10px',
      fontSize: '14px',
      fontWeight: 500,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    },
  };
}

/**
 * Transform a DependencyEdge to React Flow Edge format.
 *
 * Maps backend edge structure to React Flow's expected format with:
 * - Unique ID based on source and target
 * - Source and target node IDs
 * - Edge type for styling
 * - Animated attribute for visual feedback
 * - Styling based on relationship type
 */
export function transformEdge(edge: DependencyEdge): Edge<FlowEdgeData> {
  const style = getEdgeStyle(edge.type);

  return {
    id: `${edge.fromId}-${edge.toId}`,
    source: edge.fromId,
    target: edge.toId,
    type: 'smoothstep', // Use smooth step edges for better readability
    animated: edge.type === 'WRITES', // Animate write operations
    data: {
      edgeType: edge.type,
      metadata: edge.metadata,
    },
    style: {
      stroke: '#64748b', // slate-500
      ...style,
    },
    markerEnd: {
      type: 'arrowclosed' as const,
      width: 20,
      height: 20,
      color: '#64748b',
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
  edges: Edge<FlowEdgeData>[]
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
