import type { Node, Edge } from '@xyflow/react';
import { describe, it, expect } from 'vitest';

import type { DependencyNode, DependencyEdge, DependencyGraphResult } from '@/services/api/hooks';

import {
  transformNode,
  transformEdge,
  transformGraphToFlow,
  applyAutoLayout,
  type FlowNodeData,
  type FlowEdgeData,
} from './graph-layout';

describe('graph-layout utilities', () => {
  describe('transformNode', () => {
    it('should transform a VARIABLE node correctly', () => {
      const backendNode: DependencyNode = {
        id: 'var-1',
        type: 'VARIABLE',
        entityId: 'state-var-123',
        label: 'Player Health',
        metadata: { someKey: 'someValue' },
      };

      const result = transformNode(backendNode);

      expect(result.id).toBe('var-1');
      expect(result.type).toBe('variable');
      expect(result.data.label).toBe('Player Health');
      expect(result.data.nodeType).toBe('VARIABLE');
      expect(result.data.entityId).toBe('state-var-123');
      expect(result.data.metadata).toEqual({ someKey: 'someValue' });
      // Note: backgroundColor is now handled by custom node components, not inline styles
      expect(result.style?.backgroundColor).toBeUndefined();
    });

    it('should transform a CONDITION node correctly', () => {
      const backendNode: DependencyNode = {
        id: 'cond-1',
        type: 'CONDITION',
        entityId: 'condition-456',
        label: 'Is Player Alive',
        metadata: null,
      };

      const result = transformNode(backendNode);

      expect(result.id).toBe('cond-1');
      expect(result.type).toBe('condition');
      expect(result.data.label).toBe('Is Player Alive');
      expect(result.data.nodeType).toBe('CONDITION');
      // Note: backgroundColor is now handled by custom node components, not inline styles
      expect(result.style?.backgroundColor).toBeUndefined();
    });

    it('should transform an EFFECT node correctly', () => {
      const backendNode: DependencyNode = {
        id: 'effect-1',
        type: 'EFFECT',
        entityId: 'effect-789',
        label: 'Heal Player',
      };

      const result = transformNode(backendNode);

      expect(result.type).toBe('effect');
      expect(result.data.nodeType).toBe('EFFECT');
      // Note: backgroundColor is now handled by custom node components, not inline styles
      expect(result.style?.backgroundColor).toBeUndefined();
    });

    it('should transform an ENTITY node correctly', () => {
      const backendNode: DependencyNode = {
        id: 'entity-1',
        type: 'ENTITY',
        entityId: 'settlement-abc',
        label: 'Waterdeep',
      };

      const result = transformNode(backendNode);

      expect(result.type).toBe('entity');
      expect(result.data.nodeType).toBe('ENTITY');
      // Note: backgroundColor is now handled by custom node components, not inline styles
      expect(result.style?.backgroundColor).toBeUndefined();
    });

    it('should fallback to entityId when label is not provided', () => {
      const backendNode: DependencyNode = {
        id: 'var-2',
        type: 'VARIABLE',
        entityId: 'state-var-999',
        label: null,
      };

      const result = transformNode(backendNode);

      expect(result.data.label).toBe('state-var-999');
    });

    it('should set initial position to (0, 0)', () => {
      const backendNode: DependencyNode = {
        id: 'var-1',
        type: 'VARIABLE',
        entityId: 'state-var-123',
        label: 'Test',
      };

      const result = transformNode(backendNode);

      expect(result.position).toEqual({ x: 0, y: 0 });
    });
  });

  describe('transformEdge', () => {
    it('should transform a READS edge correctly', () => {
      const backendEdge: DependencyEdge = {
        fromId: 'cond-1',
        toId: 'var-1',
        type: 'READS',
        metadata: { someKey: 'someValue' },
      };

      const result = transformEdge(backendEdge);

      expect(result.id).toBe('cond-1-var-1');
      expect(result.source).toBe('cond-1');
      expect(result.target).toBe('var-1');
      expect(result.type).toBe('smoothstep');
      expect(result.animated).toBe(false);
      expect(result.data?.edgeType).toBe('READS');
      expect(result.style?.strokeDasharray).toBeUndefined(); // solid line
    });

    it('should transform a WRITES edge correctly and animate it', () => {
      const backendEdge: DependencyEdge = {
        fromId: 'effect-1',
        toId: 'var-1',
        type: 'WRITES',
        metadata: null,
      };

      const result = transformEdge(backendEdge);

      expect(result.id).toBe('effect-1-var-1');
      expect(result.animated).toBe(true); // WRITES edges are animated
      expect(result.data?.edgeType).toBe('WRITES');
      expect(result.style?.strokeDasharray).toBe('5,5'); // dashed line
    });

    it('should transform a DEPENDS_ON edge correctly', () => {
      const backendEdge: DependencyEdge = {
        fromId: 'cond-2',
        toId: 'cond-1',
        type: 'DEPENDS_ON',
      };

      const result = transformEdge(backendEdge);

      expect(result.id).toBe('cond-2-cond-1');
      expect(result.animated).toBe(false);
      expect(result.data?.edgeType).toBe('DEPENDS_ON');
      expect(result.style?.strokeDasharray).toBe('2,2'); // dotted line
    });

    it('should add arrow markers to all edges', () => {
      const backendEdge: DependencyEdge = {
        fromId: 'a',
        toId: 'b',
        type: 'READS',
      };

      const result = transformEdge(backendEdge);

      expect(result.markerEnd).toBeDefined();
      if (result.markerEnd && typeof result.markerEnd === 'object' && 'type' in result.markerEnd) {
        expect(result.markerEnd.type).toBe('arrowclosed');
      }
    });
  });

  describe('applyAutoLayout', () => {
    it('should position nodes using dagre layout', () => {
      const nodes: Node<FlowNodeData>[] = [
        {
          id: 'a',
          type: 'variable',
          position: { x: 0, y: 0 },
          data: { label: 'A', nodeType: 'VARIABLE', entityId: 'a' },
        },
        {
          id: 'b',
          type: 'condition',
          position: { x: 0, y: 0 },
          data: { label: 'B', nodeType: 'CONDITION', entityId: 'b' },
        },
      ];

      const edges: Edge<FlowEdgeData>[] = [
        {
          id: 'a-b',
          source: 'a',
          target: 'b',
          data: { edgeType: 'READS' },
        },
      ];

      const result = applyAutoLayout(nodes, edges);

      // Check that positions have been updated (no longer both at 0,0)
      expect(result).toHaveLength(2);
      expect(result[0].position).not.toEqual({ x: 0, y: 0 });
      expect(result[1].position).not.toEqual({ x: 0, y: 0 });

      // Check that positions are numbers
      expect(typeof result[0].position.x).toBe('number');
      expect(typeof result[0].position.y).toBe('number');
      expect(typeof result[1].position.x).toBe('number');
      expect(typeof result[1].position.y).toBe('number');
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
          type: 'condition',
          position: { x: 0, y: 0 },
          data: { label: 'C', nodeType: 'CONDITION', entityId: 'c' },
        },
      ];

      // Two disconnected edges: a->b and c (standalone)
      const edges: Edge<FlowEdgeData>[] = [
        {
          id: 'a-b',
          source: 'a',
          target: 'b',
          data: { edgeType: 'READS' },
        },
      ];

      const result = applyAutoLayout(nodes, edges);

      // Should handle all nodes without errors
      expect(result).toHaveLength(3);
      expect(result.every((node) => typeof node.position.x === 'number')).toBe(true);
      expect(result.every((node) => typeof node.position.y === 'number')).toBe(true);
    });

    it('should handle single node with no edges', () => {
      const nodes: Node<FlowNodeData>[] = [
        {
          id: 'a',
          type: 'variable',
          position: { x: 0, y: 0 },
          data: { label: 'A', nodeType: 'VARIABLE', entityId: 'a' },
        },
      ];

      const edges: Edge<FlowEdgeData>[] = [];

      const result = applyAutoLayout(nodes, edges);

      expect(result).toHaveLength(1);
      expect(result[0].position).not.toEqual({ x: 0, y: 0 });
    });

    it('should handle cycles in the graph', () => {
      const nodes: Node<FlowNodeData>[] = [
        {
          id: 'a',
          type: 'variable',
          position: { x: 0, y: 0 },
          data: { label: 'A', nodeType: 'VARIABLE', entityId: 'a' },
        },
        {
          id: 'b',
          type: 'condition',
          position: { x: 0, y: 0 },
          data: { label: 'B', nodeType: 'CONDITION', entityId: 'b' },
        },
        {
          id: 'c',
          type: 'effect',
          position: { x: 0, y: 0 },
          data: { label: 'C', nodeType: 'EFFECT', entityId: 'c' },
        },
      ];

      // Create a cycle: a -> b -> c -> a
      const edges: Edge<FlowEdgeData>[] = [
        {
          id: 'a-b',
          source: 'a',
          target: 'b',
          data: { edgeType: 'READS' },
        },
        {
          id: 'b-c',
          source: 'b',
          target: 'c',
          data: { edgeType: 'READS' },
        },
        {
          id: 'c-a',
          source: 'c',
          target: 'a',
          data: { edgeType: 'WRITES' },
        },
      ];

      const result = applyAutoLayout(nodes, edges);

      // Should handle cycles without errors
      expect(result).toHaveLength(3);
      expect(result.every((node) => typeof node.position.x === 'number')).toBe(true);
      expect(result.every((node) => typeof node.position.y === 'number')).toBe(true);
    });
  });

  describe('transformGraphToFlow', () => {
    it('should transform empty graph correctly', () => {
      const graphData: DependencyGraphResult = {
        nodes: [],
        edges: [],
        stats: {
          nodeCount: 0,
          edgeCount: 0,
          variableCount: 0,
          conditionCount: 0,
          effectCount: 0,
          entityCount: 0,
        },
        campaignId: 'campaign-1',
        branchId: 'main',
        builtAt: '2024-01-01T00:00:00Z',
      };

      const result = transformGraphToFlow(graphData);

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    it('should transform single node graph correctly', () => {
      const graphData: DependencyGraphResult = {
        nodes: [
          {
            id: 'var-1',
            type: 'VARIABLE',
            entityId: 'state-var-1',
            label: 'Test Variable',
          },
        ],
        edges: [],
        stats: {
          nodeCount: 1,
          edgeCount: 0,
          variableCount: 1,
          conditionCount: 0,
          effectCount: 0,
          entityCount: 0,
        },
        campaignId: 'campaign-1',
        branchId: 'main',
        builtAt: '2024-01-01T00:00:00Z',
      };

      const result = transformGraphToFlow(graphData);

      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(0);
      expect(result.nodes[0].id).toBe('var-1');
      expect(result.nodes[0].data.label).toBe('Test Variable');
      // Position should be set by layout
      expect(result.nodes[0].position).not.toEqual({ x: 0, y: 0 });
    });

    it('should transform complex graph correctly', () => {
      const graphData: DependencyGraphResult = {
        nodes: [
          {
            id: 'var-1',
            type: 'VARIABLE',
            entityId: 'state-var-1',
            label: 'Player Health',
          },
          {
            id: 'cond-1',
            type: 'CONDITION',
            entityId: 'condition-1',
            label: 'Is Alive',
          },
          {
            id: 'effect-1',
            type: 'EFFECT',
            entityId: 'effect-1',
            label: 'Heal',
          },
          {
            id: 'entity-1',
            type: 'ENTITY',
            entityId: 'settlement-1',
            label: 'Waterdeep',
          },
        ],
        edges: [
          {
            fromId: 'cond-1',
            toId: 'var-1',
            type: 'READS',
          },
          {
            fromId: 'effect-1',
            toId: 'var-1',
            type: 'WRITES',
          },
          {
            fromId: 'effect-1',
            toId: 'cond-1',
            type: 'DEPENDS_ON',
          },
        ],
        stats: {
          nodeCount: 4,
          edgeCount: 3,
          variableCount: 1,
          conditionCount: 1,
          effectCount: 1,
          entityCount: 1,
        },
        campaignId: 'campaign-1',
        branchId: 'main',
        builtAt: '2024-01-01T00:00:00Z',
      };

      const result = transformGraphToFlow(graphData);

      // Check node count
      expect(result.nodes).toHaveLength(4);
      expect(result.edges).toHaveLength(3);

      // Check node types
      expect(result.nodes.find((n) => n.id === 'var-1')?.type).toBe('variable');
      expect(result.nodes.find((n) => n.id === 'cond-1')?.type).toBe('condition');
      expect(result.nodes.find((n) => n.id === 'effect-1')?.type).toBe('effect');
      expect(result.nodes.find((n) => n.id === 'entity-1')?.type).toBe('entity');

      // Check edge types
      expect(result.edges.find((e) => e.id === 'cond-1-var-1')?.data?.edgeType).toBe('READS');
      expect(result.edges.find((e) => e.id === 'effect-1-var-1')?.data?.edgeType).toBe('WRITES');
      expect(result.edges.find((e) => e.id === 'effect-1-cond-1')?.data?.edgeType).toBe(
        'DEPENDS_ON'
      );

      // Check that positions have been set
      expect(result.nodes.every((node) => typeof node.position.x === 'number')).toBe(true);
      expect(result.nodes.every((node) => typeof node.position.y === 'number')).toBe(true);

      // Check that not all positions are (0, 0)
      const allAtOrigin = result.nodes.every(
        (node) => node.position.x === 0 && node.position.y === 0
      );
      expect(allAtOrigin).toBe(false);
    });

    it('should handle graph with cycles', () => {
      const graphData: DependencyGraphResult = {
        nodes: [
          { id: 'a', type: 'VARIABLE', entityId: 'a', label: 'A' },
          { id: 'b', type: 'CONDITION', entityId: 'b', label: 'B' },
          { id: 'c', type: 'EFFECT', entityId: 'c', label: 'C' },
        ],
        edges: [
          { fromId: 'a', toId: 'b', type: 'READS' },
          { fromId: 'b', toId: 'c', type: 'READS' },
          { fromId: 'c', toId: 'a', type: 'WRITES' },
        ],
        stats: {
          nodeCount: 3,
          edgeCount: 3,
          variableCount: 1,
          conditionCount: 1,
          effectCount: 1,
          entityCount: 0,
        },
        campaignId: 'campaign-1',
        branchId: 'main',
        builtAt: '2024-01-01T00:00:00Z',
      };

      const result = transformGraphToFlow(graphData);

      // Should handle cycle without errors
      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(3);
      expect(result.nodes.every((node) => typeof node.position.x === 'number')).toBe(true);
      expect(result.nodes.every((node) => typeof node.position.y === 'number')).toBe(true);
    });
  });
});
