/**
 * DependencyGraph Unit Tests
 * Comprehensive tests for the in-memory DAG data structure
 */

import {
  DependencyNode,
  DependencyEdge,
  DependencyNodeType,
  DependencyEdgeType,
} from '../types/dependency-graph.type';

import { DependencyGraph } from './dependency-graph';

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  // Helper to create a test node
  const createNode = (
    id: string,
    type: DependencyNodeType = DependencyNodeType.VARIABLE
  ): DependencyNode => ({
    id,
    type,
    entityId: id,
    label: `Node ${id}`,
  });

  // Helper to create a test edge
  const createEdge = (
    fromId: string,
    toId: string,
    type: DependencyEdgeType = DependencyEdgeType.READS
  ): DependencyEdge => ({
    fromId,
    toId,
    type,
  });

  describe('addNode', () => {
    it('should add a node to the graph', () => {
      const node = createNode('node1');
      graph.addNode(node);

      expect(graph.hasNode('node1')).toBe(true);
      expect(graph.getNode('node1')).toEqual(node);
    });

    it('should replace existing node with same ID', () => {
      const node1 = createNode('node1');
      const node2 = { ...createNode('node1'), label: 'Updated Node' };

      graph.addNode(node1);
      graph.addNode(node2);

      expect(graph.getNode('node1')?.label).toBe('Updated Node');
    });

    it('should initialize edge arrays for new node', () => {
      const node = createNode('node1');
      graph.addNode(node);

      expect(graph.getOutgoingEdges('node1')).toEqual([]);
      expect(graph.getIncomingEdges('node1')).toEqual([]);
    });
  });

  describe('removeNode', () => {
    it('should remove a node from the graph', () => {
      const node = createNode('node1');
      graph.addNode(node);
      graph.removeNode('node1');

      expect(graph.hasNode('node1')).toBe(false);
      expect(graph.getNode('node1')).toBeNull();
    });

    it('should remove all outgoing edges when node is removed', () => {
      const nodeA = createNode('A');
      const nodeB = createNode('B');
      const nodeC = createNode('C');

      graph.addNode(nodeA);
      graph.addNode(nodeB);
      graph.addNode(nodeC);

      graph.addEdge(createEdge('A', 'B'));
      graph.addEdge(createEdge('A', 'C'));

      graph.removeNode('A');

      // B and C should have no incoming edges
      expect(graph.getIncomingEdges('B')).toEqual([]);
      expect(graph.getIncomingEdges('C')).toEqual([]);
    });

    it('should remove all incoming edges when node is removed', () => {
      const nodeA = createNode('A');
      const nodeB = createNode('B');
      const nodeC = createNode('C');

      graph.addNode(nodeA);
      graph.addNode(nodeB);
      graph.addNode(nodeC);

      graph.addEdge(createEdge('B', 'A'));
      graph.addEdge(createEdge('C', 'A'));

      graph.removeNode('A');

      // B and C should have no outgoing edges to A
      expect(graph.getOutgoingEdges('B')).toEqual([]);
      expect(graph.getOutgoingEdges('C')).toEqual([]);
    });

    it('should handle removing non-existent node gracefully', () => {
      expect(() => graph.removeNode('non-existent')).not.toThrow();
    });
  });

  describe('addEdge', () => {
    it('should add an edge between two nodes', () => {
      const nodeA = createNode('A');
      const nodeB = createNode('B');

      graph.addNode(nodeA);
      graph.addNode(nodeB);

      const edge = createEdge('A', 'B');
      graph.addEdge(edge);

      expect(graph.hasEdge('A', 'B')).toBe(true);
      expect(graph.getOutgoingEdges('A')).toContainEqual(edge);
      expect(graph.getIncomingEdges('B')).toContainEqual(edge);
    });

    it('should throw error if source node does not exist', () => {
      const nodeB = createNode('B');
      graph.addNode(nodeB);

      expect(() => graph.addEdge(createEdge('A', 'B'))).toThrow(
        "Cannot add edge: source node 'A' does not exist"
      );
    });

    it('should throw error if target node does not exist', () => {
      const nodeA = createNode('A');
      graph.addNode(nodeA);

      expect(() => graph.addEdge(createEdge('A', 'B'))).toThrow(
        "Cannot add edge: target node 'B' does not exist"
      );
    });
  });

  describe('removeEdge', () => {
    it('should remove an edge from the graph', () => {
      const nodeA = createNode('A');
      const nodeB = createNode('B');

      graph.addNode(nodeA);
      graph.addNode(nodeB);
      graph.addEdge(createEdge('A', 'B'));

      graph.removeEdge('A', 'B');

      expect(graph.hasEdge('A', 'B')).toBe(false);
      expect(graph.getOutgoingEdges('A')).toEqual([]);
      expect(graph.getIncomingEdges('B')).toEqual([]);
    });

    it('should handle removing non-existent edge gracefully', () => {
      const nodeA = createNode('A');
      const nodeB = createNode('B');

      graph.addNode(nodeA);
      graph.addNode(nodeB);

      expect(() => graph.removeEdge('A', 'B')).not.toThrow();
    });
  });

  describe('getOutgoingEdges', () => {
    it('should return all outgoing edges from a node', () => {
      const nodeA = createNode('A');
      const nodeB = createNode('B');
      const nodeC = createNode('C');

      graph.addNode(nodeA);
      graph.addNode(nodeB);
      graph.addNode(nodeC);

      const edge1 = createEdge('A', 'B');
      const edge2 = createEdge('A', 'C');

      graph.addEdge(edge1);
      graph.addEdge(edge2);

      const outgoing = graph.getOutgoingEdges('A');
      expect(outgoing).toHaveLength(2);
      expect(outgoing).toContainEqual(edge1);
      expect(outgoing).toContainEqual(edge2);
    });

    it('should return empty array for node with no outgoing edges', () => {
      const node = createNode('A');
      graph.addNode(node);

      expect(graph.getOutgoingEdges('A')).toEqual([]);
    });

    it('should return empty array for non-existent node', () => {
      expect(graph.getOutgoingEdges('non-existent')).toEqual([]);
    });
  });

  describe('getIncomingEdges', () => {
    it('should return all incoming edges to a node', () => {
      const nodeA = createNode('A');
      const nodeB = createNode('B');
      const nodeC = createNode('C');

      graph.addNode(nodeA);
      graph.addNode(nodeB);
      graph.addNode(nodeC);

      const edge1 = createEdge('B', 'A');
      const edge2 = createEdge('C', 'A');

      graph.addEdge(edge1);
      graph.addEdge(edge2);

      const incoming = graph.getIncomingEdges('A');
      expect(incoming).toHaveLength(2);
      expect(incoming).toContainEqual(edge1);
      expect(incoming).toContainEqual(edge2);
    });

    it('should return empty array for node with no incoming edges', () => {
      const node = createNode('A');
      graph.addNode(node);

      expect(graph.getIncomingEdges('A')).toEqual([]);
    });

    it('should return empty array for non-existent node', () => {
      expect(graph.getIncomingEdges('non-existent')).toEqual([]);
    });
  });

  describe('getAllNodes', () => {
    it('should return all nodes in the graph', () => {
      const nodeA = createNode('A');
      const nodeB = createNode('B');
      const nodeC = createNode('C');

      graph.addNode(nodeA);
      graph.addNode(nodeB);
      graph.addNode(nodeC);

      const nodes = graph.getAllNodes();
      expect(nodes).toHaveLength(3);
      expect(nodes).toContainEqual(nodeA);
      expect(nodes).toContainEqual(nodeB);
      expect(nodes).toContainEqual(nodeC);
    });

    it('should return empty array for empty graph', () => {
      expect(graph.getAllNodes()).toEqual([]);
    });
  });

  describe('getAllEdges', () => {
    it('should return all edges in the graph', () => {
      const nodeA = createNode('A');
      const nodeB = createNode('B');
      const nodeC = createNode('C');

      graph.addNode(nodeA);
      graph.addNode(nodeB);
      graph.addNode(nodeC);

      const edge1 = createEdge('A', 'B');
      const edge2 = createEdge('B', 'C');

      graph.addEdge(edge1);
      graph.addEdge(edge2);

      const edges = graph.getAllEdges();
      expect(edges).toHaveLength(2);
      expect(edges).toContainEqual(edge1);
      expect(edges).toContainEqual(edge2);
    });

    it('should return empty array for graph with no edges', () => {
      graph.addNode(createNode('A'));
      expect(graph.getAllEdges()).toEqual([]);
    });
  });

  describe('hasNode', () => {
    it('should return true if node exists', () => {
      graph.addNode(createNode('A'));
      expect(graph.hasNode('A')).toBe(true);
    });

    it('should return false if node does not exist', () => {
      expect(graph.hasNode('A')).toBe(false);
    });
  });

  describe('hasEdge', () => {
    it('should return true if edge exists', () => {
      graph.addNode(createNode('A'));
      graph.addNode(createNode('B'));
      graph.addEdge(createEdge('A', 'B'));

      expect(graph.hasEdge('A', 'B')).toBe(true);
    });

    it('should return false if edge does not exist', () => {
      graph.addNode(createNode('A'));
      graph.addNode(createNode('B'));

      expect(graph.hasEdge('A', 'B')).toBe(false);
    });

    it('should return false for non-existent nodes', () => {
      expect(graph.hasEdge('A', 'B')).toBe(false);
    });
  });

  describe('getNodeCount', () => {
    it('should return the number of nodes', () => {
      expect(graph.getNodeCount()).toBe(0);

      graph.addNode(createNode('A'));
      expect(graph.getNodeCount()).toBe(1);

      graph.addNode(createNode('B'));
      expect(graph.getNodeCount()).toBe(2);

      graph.removeNode('A');
      expect(graph.getNodeCount()).toBe(1);
    });
  });

  describe('getEdgeCount', () => {
    it('should return the number of edges', () => {
      graph.addNode(createNode('A'));
      graph.addNode(createNode('B'));
      graph.addNode(createNode('C'));

      expect(graph.getEdgeCount()).toBe(0);

      graph.addEdge(createEdge('A', 'B'));
      expect(graph.getEdgeCount()).toBe(1);

      graph.addEdge(createEdge('B', 'C'));
      expect(graph.getEdgeCount()).toBe(2);

      graph.removeEdge('A', 'B');
      expect(graph.getEdgeCount()).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all nodes and edges', () => {
      graph.addNode(createNode('A'));
      graph.addNode(createNode('B'));
      graph.addEdge(createEdge('A', 'B'));

      graph.clear();

      expect(graph.getNodeCount()).toBe(0);
      expect(graph.getEdgeCount()).toBe(0);
      expect(graph.getAllNodes()).toEqual([]);
      expect(graph.getAllEdges()).toEqual([]);
    });
  });

  describe('detectCycles', () => {
    it('should detect no cycles in DAG', () => {
      // Create a simple DAG: A -> B -> C
      graph.addNode(createNode('A'));
      graph.addNode(createNode('B'));
      graph.addNode(createNode('C'));
      graph.addEdge(createEdge('A', 'B'));
      graph.addEdge(createEdge('B', 'C'));

      const result = graph.detectCycles();

      expect(result.hasCycles).toBe(false);
      expect(result.cycles).toEqual([]);
      expect(result.cycleCount).toBe(0);
    });

    it('should detect simple cycle', () => {
      // Create cycle: A -> B -> A
      graph.addNode(createNode('A'));
      graph.addNode(createNode('B'));
      graph.addEdge(createEdge('A', 'B'));
      graph.addEdge(createEdge('B', 'A'));

      const result = graph.detectCycles();

      expect(result.hasCycles).toBe(true);
      expect(result.cycleCount).toBeGreaterThan(0);
      expect(result.cycles[0]?.path).toContain('A');
      expect(result.cycles[0]?.path).toContain('B');
    });

    it('should detect complex cycle', () => {
      // Create cycle: A -> B -> C -> D -> B
      graph.addNode(createNode('A'));
      graph.addNode(createNode('B'));
      graph.addNode(createNode('C'));
      graph.addNode(createNode('D'));
      graph.addEdge(createEdge('A', 'B'));
      graph.addEdge(createEdge('B', 'C'));
      graph.addEdge(createEdge('C', 'D'));
      graph.addEdge(createEdge('D', 'B'));

      const result = graph.detectCycles();

      expect(result.hasCycles).toBe(true);
      expect(result.cycleCount).toBeGreaterThan(0);
    });

    it('should detect self-loop', () => {
      // Create self-loop: A -> A
      graph.addNode(createNode('A'));
      graph.addEdge(createEdge('A', 'A'));

      const result = graph.detectCycles();

      expect(result.hasCycles).toBe(true);
      expect(result.cycles[0]?.path).toContain('A');
    });

    it('should handle empty graph', () => {
      const result = graph.detectCycles();

      expect(result.hasCycles).toBe(false);
      expect(result.cycles).toEqual([]);
    });

    it('should handle disconnected components', () => {
      // Two separate DAGs: A -> B and C -> D
      graph.addNode(createNode('A'));
      graph.addNode(createNode('B'));
      graph.addNode(createNode('C'));
      graph.addNode(createNode('D'));
      graph.addEdge(createEdge('A', 'B'));
      graph.addEdge(createEdge('C', 'D'));

      const result = graph.detectCycles();

      expect(result.hasCycles).toBe(false);
    });
  });

  describe('topologicalSort', () => {
    it('should sort simple linear chain', () => {
      // A -> B -> C
      graph.addNode(createNode('A'));
      graph.addNode(createNode('B'));
      graph.addNode(createNode('C'));
      graph.addEdge(createEdge('A', 'B'));
      graph.addEdge(createEdge('B', 'C'));

      const result = graph.topologicalSort();

      expect(result.success).toBe(true);
      expect(result.order).toEqual(['A', 'B', 'C']);
      expect(result.remainingNodes).toEqual([]);
      expect(result.error).toBeNull();
    });

    it('should handle diamond dependency', () => {
      // A -> B, A -> C, B -> D, C -> D
      graph.addNode(createNode('A'));
      graph.addNode(createNode('B'));
      graph.addNode(createNode('C'));
      graph.addNode(createNode('D'));
      graph.addEdge(createEdge('A', 'B'));
      graph.addEdge(createEdge('A', 'C'));
      graph.addEdge(createEdge('B', 'D'));
      graph.addEdge(createEdge('C', 'D'));

      const result = graph.topologicalSort();

      expect(result.success).toBe(true);
      expect(result.order[0]).toBe('A');
      expect(result.order[3]).toBe('D');
      expect(result.remainingNodes).toEqual([]);
    });

    it('should detect cycles and return partial order', () => {
      // A -> B -> A (cycle)
      graph.addNode(createNode('A'));
      graph.addNode(createNode('B'));
      graph.addEdge(createEdge('A', 'B'));
      graph.addEdge(createEdge('B', 'A'));

      const result = graph.topologicalSort();

      expect(result.success).toBe(false);
      expect(result.remainingNodes.length).toBe(2);
      expect(result.error).toBeTruthy();
    });

    it('should handle empty graph', () => {
      const result = graph.topologicalSort();

      expect(result.success).toBe(true);
      expect(result.order).toEqual([]);
      expect(result.remainingNodes).toEqual([]);
    });

    it('should handle disconnected components', () => {
      // A -> B and C -> D
      graph.addNode(createNode('A'));
      graph.addNode(createNode('B'));
      graph.addNode(createNode('C'));
      graph.addNode(createNode('D'));
      graph.addEdge(createEdge('A', 'B'));
      graph.addEdge(createEdge('C', 'D'));

      const result = graph.topologicalSort();

      expect(result.success).toBe(true);
      expect(result.order).toHaveLength(4);
      expect(result.remainingNodes).toEqual([]);
    });
  });

  describe('wouldCreateCycle', () => {
    it('should return false if edge would not create cycle', () => {
      graph.addNode(createNode('A'));
      graph.addNode(createNode('B'));
      graph.addNode(createNode('C'));
      graph.addEdge(createEdge('A', 'B'));

      expect(graph.wouldCreateCycle('B', 'C')).toBe(false);
    });

    it('should return true if edge would create cycle', () => {
      graph.addNode(createNode('A'));
      graph.addNode(createNode('B'));
      graph.addEdge(createEdge('A', 'B'));

      expect(graph.wouldCreateCycle('B', 'A')).toBe(true);
    });

    it('should return true for self-loop', () => {
      graph.addNode(createNode('A'));

      expect(graph.wouldCreateCycle('A', 'A')).toBe(true);
    });

    it('should return false for non-existent nodes', () => {
      expect(graph.wouldCreateCycle('A', 'B')).toBe(false);
    });
  });

  describe('hasPath', () => {
    it('should return true if path exists', () => {
      graph.addNode(createNode('A'));
      graph.addNode(createNode('B'));
      graph.addNode(createNode('C'));
      graph.addEdge(createEdge('A', 'B'));
      graph.addEdge(createEdge('B', 'C'));

      expect(graph.hasPath('A', 'C')).toBe(true);
    });

    it('should return false if no path exists', () => {
      graph.addNode(createNode('A'));
      graph.addNode(createNode('B'));
      graph.addNode(createNode('C'));
      graph.addEdge(createEdge('A', 'B'));

      expect(graph.hasPath('B', 'A')).toBe(false);
      expect(graph.hasPath('C', 'A')).toBe(false);
    });

    it('should return true for same source and target', () => {
      graph.addNode(createNode('A'));

      expect(graph.hasPath('A', 'A')).toBe(true);
    });

    it('should return false for non-existent nodes', () => {
      expect(graph.hasPath('A', 'B')).toBe(false);
    });
  });
});
