import type { Node } from '@xyflow/react';
import { describe, it, expect } from 'vitest';

import {
  createEmptyFilters,
  hasActiveFilters,
  detectCycles,
  filterNodes,
  filterEdges,
  getNodeTypeCount,
  getEdgeTypeCount,
  type GraphFilters,
} from './graph-filters';
import type { FlowNodeData, FlowEdgeData } from './graph-layout';

describe('graph-filters', () => {
  // Test data - nodes
  const mockNodes: Node<FlowNodeData>[] = [
    {
      id: 'node-1',
      type: 'variable',
      position: { x: 0, y: 0 },
      data: { label: 'Player Health', nodeType: 'VARIABLE', entityId: 'var-1' },
    },
    {
      id: 'node-2',
      type: 'condition',
      position: { x: 100, y: 0 },
      data: { label: 'Low Health Check', nodeType: 'CONDITION', entityId: 'cond-1' },
    },
    {
      id: 'node-3',
      type: 'effect',
      position: { x: 200, y: 0 },
      data: { label: 'Heal Effect', nodeType: 'EFFECT', entityId: 'eff-1' },
    },
    {
      id: 'node-4',
      type: 'entity',
      position: { x: 300, y: 0 },
      data: { label: 'Player Entity', nodeType: 'ENTITY', entityId: 'ent-1' },
    },
  ];

  // Test data - edges
  const mockEdges: FlowEdgeData[] = [
    {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      type: 'reads',
      data: { edgeType: 'READS' as const },
    },
    {
      id: 'edge-2',
      source: 'node-2',
      target: 'node-3',
      type: 'writes',
      data: { edgeType: 'WRITES' as const },
    },
    {
      id: 'edge-3',
      source: 'node-3',
      target: 'node-1',
      type: 'dependson',
      data: { edgeType: 'DEPENDS_ON' as const },
    },
  ];

  describe('createEmptyFilters', () => {
    it('should create empty filter configuration', () => {
      const filters = createEmptyFilters();

      expect(filters.searchQuery).toBe('');
      expect(filters.nodeTypes.size).toBe(0);
      expect(filters.edgeTypes.size).toBe(0);
      expect(filters.showCyclesOnly).toBe(false);
      expect(filters.showSelectedOnly).toBe(false);
    });
  });

  describe('hasActiveFilters', () => {
    it('should return false for empty filters', () => {
      const filters = createEmptyFilters();
      expect(hasActiveFilters(filters)).toBe(false);
    });

    it('should return true when search query is set', () => {
      const filters: GraphFilters = {
        ...createEmptyFilters(),
        searchQuery: 'health',
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it('should return true when node type filter is set', () => {
      const filters: GraphFilters = {
        ...createEmptyFilters(),
        nodeTypes: new Set(['VARIABLE']),
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it('should return true when edge type filter is set', () => {
      const filters: GraphFilters = {
        ...createEmptyFilters(),
        edgeTypes: new Set(['READS']),
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it('should return true when showCyclesOnly is true', () => {
      const filters: GraphFilters = {
        ...createEmptyFilters(),
        showCyclesOnly: true,
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it('should return true when showSelectedOnly is true', () => {
      const filters: GraphFilters = {
        ...createEmptyFilters(),
        showSelectedOnly: true,
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });
  });

  describe('detectCycles', () => {
    it('should detect cycles in a simple cycle', () => {
      const cycleNodes = detectCycles(mockNodes, mockEdges);

      // All nodes are part of a cycle: node-1 -> node-2 -> node-3 -> node-1
      expect(cycleNodes.size).toBeGreaterThan(0);
      expect(cycleNodes.has('node-1')).toBe(true);
      expect(cycleNodes.has('node-2')).toBe(true);
      expect(cycleNodes.has('node-3')).toBe(true);
    });

    it('should return empty set for acyclic graph', () => {
      const acyclicEdges: FlowEdgeData[] = [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
          type: 'reads',
          data: { edgeType: 'READS' as const },
        },
        {
          id: 'edge-2',
          source: 'node-2',
          target: 'node-3',
          type: 'writes',
          data: { edgeType: 'WRITES' as const },
        },
        // No edge back to node-1, so no cycle
      ];

      const cycleNodes = detectCycles(mockNodes, acyclicEdges);
      expect(cycleNodes.size).toBe(0);
    });

    it('should return empty set for graph with no edges', () => {
      const cycleNodes = detectCycles(mockNodes, []);
      expect(cycleNodes.size).toBe(0);
    });

    it('should handle disconnected subgraphs', () => {
      const nodes: Node<FlowNodeData>[] = [
        {
          id: 'a',
          type: 'variable',
          position: { x: 0, y: 0 },
          data: { label: 'A', nodeType: 'VARIABLE', entityId: 'a' },
        },
        {
          id: 'b',
          type: 'variable',
          position: { x: 0, y: 0 },
          data: { label: 'B', nodeType: 'VARIABLE', entityId: 'b' },
        },
        {
          id: 'c',
          type: 'variable',
          position: { x: 0, y: 0 },
          data: { label: 'C', nodeType: 'VARIABLE', entityId: 'c' },
        },
        {
          id: 'd',
          type: 'variable',
          position: { x: 0, y: 0 },
          data: { label: 'D', nodeType: 'VARIABLE', entityId: 'd' },
        },
      ];

      const edges: FlowEdgeData[] = [
        { id: 'e1', source: 'a', target: 'b', type: 'reads', data: { edgeType: 'READS' as const } },
        { id: 'e2', source: 'b', target: 'a', type: 'reads', data: { edgeType: 'READS' as const } }, // Cycle: a <-> b
        { id: 'e3', source: 'c', target: 'd', type: 'reads', data: { edgeType: 'READS' as const } }, // No cycle
      ];

      const cycleNodes = detectCycles(nodes, edges);
      expect(cycleNodes.has('a')).toBe(true);
      expect(cycleNodes.has('b')).toBe(true);
      expect(cycleNodes.has('c')).toBe(false);
      expect(cycleNodes.has('d')).toBe(false);
    });
  });

  describe('filterNodes', () => {
    it('should return all nodes with empty filters', () => {
      const filters = createEmptyFilters();
      const filtered = filterNodes(mockNodes, mockEdges, filters);

      expect(filtered).toHaveLength(4);
    });

    it('should filter nodes by search query (case-insensitive)', () => {
      const filters: GraphFilters = {
        ...createEmptyFilters(),
        searchQuery: 'health',
      };
      const filtered = filterNodes(mockNodes, mockEdges, filters);

      expect(filtered).toHaveLength(2); // "Player Health" and "Low Health Check"
      expect(filtered.map((n) => n.id)).toContain('node-1');
      expect(filtered.map((n) => n.id)).toContain('node-2');
    });

    it('should filter nodes by node type', () => {
      const filters: GraphFilters = {
        ...createEmptyFilters(),
        nodeTypes: new Set(['VARIABLE', 'CONDITION']),
      };
      const filtered = filterNodes(mockNodes, mockEdges, filters);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((n) => n.id)).toContain('node-1');
      expect(filtered.map((n) => n.id)).toContain('node-2');
    });

    it('should filter nodes by cycles', () => {
      const filters: GraphFilters = {
        ...createEmptyFilters(),
        showCyclesOnly: true,
      };
      const filtered = filterNodes(mockNodes, mockEdges, filters);

      // All nodes except node-4 are in a cycle
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((n) => n.id !== 'node-4')).toBe(true);
    });

    it('should filter nodes by selection (show selected and connected)', () => {
      const filters: GraphFilters = {
        ...createEmptyFilters(),
        showSelectedOnly: true,
      };
      const selectedNodeIds = ['node-1'];
      const filtered = filterNodes(mockNodes, mockEdges, filters, selectedNodeIds);

      // node-1 is selected, node-2 and node-3 are connected
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.map((n) => n.id)).toContain('node-1');
      expect(filtered.map((n) => n.id)).toContain('node-2'); // Connected via edge-1
      expect(filtered.map((n) => n.id)).toContain('node-3'); // Connected via edge-3
    });

    it('should combine multiple filters', () => {
      const filters: GraphFilters = {
        searchQuery: 'health',
        nodeTypes: new Set(['VARIABLE']),
        edgeTypes: new Set(),
        showCyclesOnly: false,
        showSelectedOnly: false,
      };
      const filtered = filterNodes(mockNodes, mockEdges, filters);

      // Only "Player Health" matches both search and type filter
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('node-1');
    });
  });

  describe('filterEdges', () => {
    it('should return all edges when all nodes are visible', () => {
      const visibleNodeIds = new Set(mockNodes.map((n) => n.id));
      const filters = createEmptyFilters();
      const filtered = filterEdges(mockEdges, visibleNodeIds, filters);

      expect(filtered).toHaveLength(3);
    });

    it('should filter edges when source node is not visible', () => {
      const visibleNodeIds = new Set(['node-2', 'node-3', 'node-4']);
      const filters = createEmptyFilters();
      const filtered = filterEdges(mockEdges, visibleNodeIds, filters);

      // edge-1 (node-1 -> node-2) and edge-3 (node-3 -> node-1) are filtered out
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('edge-2'); // node-2 -> node-3
    });

    it('should filter edges when target node is not visible', () => {
      const visibleNodeIds = new Set(['node-1', 'node-2']);
      const filters = createEmptyFilters();
      const filtered = filterEdges(mockEdges, visibleNodeIds, filters);

      // edge-2 (node-2 -> node-3) and edge-3 (node-3 -> node-1) are filtered out
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('edge-1'); // node-1 -> node-2
    });

    it('should filter edges by edge type', () => {
      const visibleNodeIds = new Set(mockNodes.map((n) => n.id));
      const filters: GraphFilters = {
        ...createEmptyFilters(),
        edgeTypes: new Set(['READS', 'WRITES']),
      };
      const filtered = filterEdges(mockEdges, visibleNodeIds, filters);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((e) => e.id)).toContain('edge-1');
      expect(filtered.map((e) => e.id)).toContain('edge-2');
      expect(filtered.map((e) => e.id)).not.toContain('edge-3'); // DEPENDS_ON filtered out
    });

    it('should return empty array when no nodes are visible', () => {
      const visibleNodeIds = new Set<string>();
      const filters = createEmptyFilters();
      const filtered = filterEdges(mockEdges, visibleNodeIds, filters);

      expect(filtered).toHaveLength(0);
    });
  });

  describe('getNodeTypeCount', () => {
    it('should count VARIABLE nodes correctly', () => {
      const count = getNodeTypeCount(mockNodes, 'VARIABLE');
      expect(count).toBe(1);
    });

    it('should count CONDITION nodes correctly', () => {
      const count = getNodeTypeCount(mockNodes, 'CONDITION');
      expect(count).toBe(1);
    });

    it('should count EFFECT nodes correctly', () => {
      const count = getNodeTypeCount(mockNodes, 'EFFECT');
      expect(count).toBe(1);
    });

    it('should count ENTITY nodes correctly', () => {
      const count = getNodeTypeCount(mockNodes, 'ENTITY');
      expect(count).toBe(1);
    });

    it('should return 0 for node types not in the graph', () => {
      const nodes: Node<FlowNodeData>[] = [
        {
          id: 'n1',
          type: 'variable',
          position: { x: 0, y: 0 },
          data: { label: 'V1', nodeType: 'VARIABLE', entityId: 'v1' },
        },
      ];
      const count = getNodeTypeCount(nodes, 'CONDITION');
      expect(count).toBe(0);
    });
  });

  describe('getEdgeTypeCount', () => {
    it('should count READS edges correctly', () => {
      const count = getEdgeTypeCount(mockEdges, 'READS');
      expect(count).toBe(1);
    });

    it('should count WRITES edges correctly', () => {
      const count = getEdgeTypeCount(mockEdges, 'WRITES');
      expect(count).toBe(1);
    });

    it('should count DEPENDS_ON edges correctly', () => {
      const count = getEdgeTypeCount(mockEdges, 'DEPENDS_ON');
      expect(count).toBe(1);
    });

    it('should return 0 for edge types not in the graph', () => {
      const edges: FlowEdgeData[] = [
        { id: 'e1', source: 'a', target: 'b', type: 'reads', data: { edgeType: 'READS' as const } },
      ];
      const count = getEdgeTypeCount(edges, 'WRITES');
      expect(count).toBe(0);
    });

    it('should handle edges without data', () => {
      const edges: FlowEdgeData[] = [{ id: 'e1', source: 'a', target: 'b', type: 'reads' }];
      const count = getEdgeTypeCount(edges, 'READS');
      expect(count).toBe(0); // No data.edgeType, so not counted
    });
  });
});
