import { afterEach, describe, it, expect, vi } from 'vitest';

import type { FlowNodeData, FlowEdgeData } from './graph-layout';
import {
  getUpstreamNodes,
  getDownstreamNodes,
  calculateSelectionState,
  applySelectionStyles,
  applySelectionEdgeStyles,
} from './graph-selection';

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * Test suite for graph selection utilities
 *
 * Tests dependency graph selection, highlighting, and traversal logic.
 * Part of TICKET-021 Stage 8: Selection and Highlighting
 */

// Helper to create a test node
function createTestNode(id: string): {
  id: string;
  data: FlowNodeData;
  position: { x: number; y: number };
} {
  return {
    id,
    data: {
      label: `Node ${id}`,
      nodeType: 'VARIABLE' as const,
      entityId: `entity-${id}`,
    },
    position: { x: 0, y: 0 },
  };
}

// Helper to create a test edge with proper FlowEdgeData structure
function createTestEdge(source: string, target: string): FlowEdgeData {
  return {
    id: `${source}-${target}`,
    source,
    target,
    data: {
      edgeType: 'READS' as const,
    },
  };
}

describe('getUpstreamNodes', () => {
  it('should return empty set for node with no incoming edges', () => {
    const edges = [createTestEdge('A', 'B'), createTestEdge('B', 'C')];

    const upstream = getUpstreamNodes('A', edges);

    expect(upstream.size).toBe(0);
  });

  it('should return direct upstream dependencies', () => {
    const edges = [createTestEdge('A', 'B'), createTestEdge('C', 'B')];

    const upstream = getUpstreamNodes('B', edges);

    expect(upstream.size).toBe(2);
    expect(upstream.has('A')).toBe(true);
    expect(upstream.has('C')).toBe(true);
  });

  it('should traverse multiple levels of dependencies', () => {
    const edges = [createTestEdge('A', 'B'), createTestEdge('B', 'C'), createTestEdge('D', 'B')];

    const upstream = getUpstreamNodes('C', edges);

    expect(upstream.size).toBe(3);
    expect(upstream.has('A')).toBe(true);
    expect(upstream.has('B')).toBe(true);
    expect(upstream.has('D')).toBe(true);
  });

  it('should handle cycles without infinite loop', () => {
    const edges = [createTestEdge('A', 'B'), createTestEdge('B', 'C'), createTestEdge('C', 'A')];

    const upstream = getUpstreamNodes('A', edges);

    expect(upstream.size).toBe(2);
    expect(upstream.has('B')).toBe(true);
    expect(upstream.has('C')).toBe(true);
  });

  it('should respect maxDepth parameter', () => {
    const edges = [createTestEdge('A', 'B'), createTestEdge('B', 'C'), createTestEdge('C', 'D')];

    const upstream = getUpstreamNodes('D', edges, 1);

    // Should only get direct dependencies (C)
    expect(upstream.size).toBe(1);
    expect(upstream.has('C')).toBe(true);
    expect(upstream.has('B')).toBe(false);
  });

  it('should not include the source node itself', () => {
    const edges = [createTestEdge('A', 'B'), createTestEdge('B', 'C')];

    const upstream = getUpstreamNodes('C', edges);

    expect(upstream.has('C')).toBe(false);
  });
});

describe('getDownstreamNodes', () => {
  it('should return empty set for node with no outgoing edges', () => {
    const edges = [createTestEdge('A', 'B'), createTestEdge('B', 'C')];

    const downstream = getDownstreamNodes('C', edges);

    expect(downstream.size).toBe(0);
  });

  it('should return direct downstream dependents', () => {
    const edges = [createTestEdge('A', 'B'), createTestEdge('A', 'C')];

    const downstream = getDownstreamNodes('A', edges);

    expect(downstream.size).toBe(2);
    expect(downstream.has('B')).toBe(true);
    expect(downstream.has('C')).toBe(true);
  });

  it('should traverse multiple levels of dependents', () => {
    const edges = [createTestEdge('A', 'B'), createTestEdge('B', 'C'), createTestEdge('B', 'D')];

    const downstream = getDownstreamNodes('A', edges);

    expect(downstream.size).toBe(3);
    expect(downstream.has('B')).toBe(true);
    expect(downstream.has('C')).toBe(true);
    expect(downstream.has('D')).toBe(true);
  });

  it('should handle cycles without infinite loop', () => {
    const edges = [createTestEdge('A', 'B'), createTestEdge('B', 'C'), createTestEdge('C', 'A')];

    const downstream = getDownstreamNodes('A', edges);

    expect(downstream.size).toBe(2);
    expect(downstream.has('B')).toBe(true);
    expect(downstream.has('C')).toBe(true);
  });

  it('should respect maxDepth parameter', () => {
    const edges = [createTestEdge('A', 'B'), createTestEdge('B', 'C'), createTestEdge('C', 'D')];

    const downstream = getDownstreamNodes('A', edges, 1);

    // Should only get direct dependents (B)
    expect(downstream.size).toBe(1);
    expect(downstream.has('B')).toBe(true);
    expect(downstream.has('C')).toBe(false);
  });

  it('should not include the source node itself', () => {
    const edges = [createTestEdge('A', 'B'), createTestEdge('B', 'C')];

    const downstream = getDownstreamNodes('A', edges);

    expect(downstream.has('A')).toBe(false);
  });
});

describe('calculateSelectionState', () => {
  it('should return empty arrays for empty selection', () => {
    const edges = [createTestEdge('A', 'B')];

    const state = calculateSelectionState([], edges);

    expect(state.selectedNodeIds).toEqual([]);
    expect(state.upstreamNodeIds).toEqual([]);
    expect(state.downstreamNodeIds).toEqual([]);
  });

  it('should calculate dependencies for single selected node', () => {
    const edges = [createTestEdge('A', 'B'), createTestEdge('B', 'C')];

    const state = calculateSelectionState(['B'], edges);

    expect(state.selectedNodeIds).toEqual(['B']);
    expect(state.upstreamNodeIds).toEqual(['A']);
    expect(state.downstreamNodeIds).toEqual(['C']);
  });

  it('should merge dependencies for multiple selected nodes', () => {
    const edges = [
      createTestEdge('A', 'B'),
      createTestEdge('B', 'C'),
      createTestEdge('D', 'E'),
      createTestEdge('E', 'F'),
    ];

    const state = calculateSelectionState(['B', 'E'], edges);

    expect(state.selectedNodeIds).toEqual(['B', 'E']);
    expect(state.upstreamNodeIds).toContain('A');
    expect(state.upstreamNodeIds).toContain('D');
    expect(state.downstreamNodeIds).toContain('C');
    expect(state.downstreamNodeIds).toContain('F');
  });

  it('should handle complex graph with overlapping dependencies', () => {
    const edges = [
      createTestEdge('A', 'B'),
      createTestEdge('A', 'C'),
      createTestEdge('B', 'D'),
      createTestEdge('C', 'D'),
    ];

    const state = calculateSelectionState(['D'], edges);

    expect(state.selectedNodeIds).toEqual(['D']);
    expect(state.upstreamNodeIds).toContain('A');
    expect(state.upstreamNodeIds).toContain('B');
    expect(state.upstreamNodeIds).toContain('C');
  });
});

describe('applySelectionStyles', () => {
  const nodes = [
    createTestNode('A'),
    createTestNode('B'),
    createTestNode('C'),
    createTestNode('D'),
  ];

  it('should return nodes unchanged when nothing is selected', () => {
    const state = {
      selectedNodeIds: [],
      upstreamNodeIds: [],
      downstreamNodeIds: [],
    };

    const styled = applySelectionStyles(nodes, state);

    expect(styled).toEqual(nodes);
  });

  it('should apply blue border and shadow to selected nodes', () => {
    const state = {
      selectedNodeIds: ['B'],
      upstreamNodeIds: ['A'],
      downstreamNodeIds: ['C'],
    };

    const styled = applySelectionStyles(nodes, state);
    const selectedNode = styled.find((n) => n.id === 'B')!;

    expect(selectedNode.selected).toBe(true);
    expect(selectedNode.style?.border).toBe('2px solid #3b82f6');
    expect(selectedNode.style?.opacity).toBe(1);
  });

  it('should apply green border to upstream nodes', () => {
    const state = {
      selectedNodeIds: ['B'],
      upstreamNodeIds: ['A'],
      downstreamNodeIds: ['C'],
    };

    const styled = applySelectionStyles(nodes, state);
    const upstreamNode = styled.find((n) => n.id === 'A')!;

    expect(upstreamNode.selected).toBe(false);
    expect(upstreamNode.style?.border).toBe('2px solid #22c55e');
    expect(upstreamNode.style?.opacity).toBe(1);
  });

  it('should apply orange border to downstream nodes', () => {
    const state = {
      selectedNodeIds: ['B'],
      upstreamNodeIds: ['A'],
      downstreamNodeIds: ['C'],
    };

    const styled = applySelectionStyles(nodes, state);
    const downstreamNode = styled.find((n) => n.id === 'C')!;

    expect(downstreamNode.selected).toBe(false);
    expect(downstreamNode.style?.border).toBe('2px solid #f97316');
    expect(downstreamNode.style?.opacity).toBe(1);
  });

  it('should dim unrelated nodes', () => {
    const state = {
      selectedNodeIds: ['B'],
      upstreamNodeIds: ['A'],
      downstreamNodeIds: ['C'],
    };

    const styled = applySelectionStyles(nodes, state);
    const unrelatedNode = styled.find((n) => n.id === 'D')!;

    expect(unrelatedNode.selected).toBe(false);
    expect(unrelatedNode.style?.opacity).toBe(0.3);
  });
});

describe('applySelectionEdgeStyles', () => {
  const edges = [
    createTestEdge('A', 'B'),
    createTestEdge('B', 'C'),
    createTestEdge('C', 'D'),
    createTestEdge('X', 'Y'),
  ];

  it('should return edges unchanged when nothing is selected', () => {
    const state = {
      selectedNodeIds: [],
      upstreamNodeIds: [],
      downstreamNodeIds: [],
    };

    const styled = applySelectionEdgeStyles(edges, state);

    expect(styled).toEqual(edges);
  });

  it('should keep full opacity for edges between related nodes', () => {
    const state = {
      selectedNodeIds: ['B'],
      upstreamNodeIds: ['A'],
      downstreamNodeIds: ['C'],
    };

    const styled = applySelectionEdgeStyles(edges, state);
    const relatedEdge = styled.find((e) => e.id === 'A-B')!;

    expect(relatedEdge.style?.opacity).toBe(1);
  });

  it('should dim edges to/from unrelated nodes', () => {
    const state = {
      selectedNodeIds: ['B'],
      upstreamNodeIds: ['A'],
      downstreamNodeIds: ['C'],
    };

    const styled = applySelectionEdgeStyles(edges, state);
    const unrelatedEdge = styled.find((e) => e.id === 'X-Y')!;

    expect(unrelatedEdge.style?.opacity).toBe(0.2);
  });

  it('should dim edges if only one end is related', () => {
    const state = {
      selectedNodeIds: ['B'],
      upstreamNodeIds: ['A'],
      downstreamNodeIds: ['C'],
    };

    const styled = applySelectionEdgeStyles(edges, state);
    const partialEdge = styled.find((e) => e.id === 'C-D')!;

    // C is related but D is not, so edge should be dimmed
    expect(partialEdge.style?.opacity).toBe(0.2);
  });
});
