/**
 * Dependency Graph
 * In-memory directed acyclic graph (DAG) data structure for tracking dependencies
 * between conditions, variables, effects, and entities.
 *
 * Adapted from packages/api/src/graphql/utils/dependency-graph.ts for the rules engine.
 */

import {
  DependencyNode,
  DependencyEdge,
  CycleDetectionResult,
  CycleInfo,
  TopologicalSortResult,
} from '../types/dependency-graph.types';

/**
 * DependencyGraph - In-memory DAG for dependency tracking
 *
 * Uses adjacency lists for efficient graph operations:
 * - O(1) node lookups
 * - O(E) edge traversal where E is the number of edges for a node
 * - Supports incremental updates (add/remove nodes and edges)
 */
export class DependencyGraph {
  // Nodes indexed by node ID
  private nodes: Map<string, DependencyNode> = new Map();

  // Outgoing edges: nodeId -> [edges where node is source]
  private outgoingEdges: Map<string, DependencyEdge[]> = new Map();

  // Incoming edges: nodeId -> [edges where node is target]
  private incomingEdges: Map<string, DependencyEdge[]> = new Map();

  /**
   * Add a node to the graph
   * If node with same ID already exists, it will be replaced
   *
   * @param node - The dependency node to add
   */
  addNode(node: DependencyNode): void {
    this.nodes.set(node.id, node);

    // Initialize edge arrays if not present
    if (!this.outgoingEdges.has(node.id)) {
      this.outgoingEdges.set(node.id, []);
    }
    if (!this.incomingEdges.has(node.id)) {
      this.incomingEdges.set(node.id, []);
    }
  }

  /**
   * Remove a node from the graph
   * Also removes all edges connected to this node
   *
   * @param nodeId - The ID of the node to remove
   */
  removeNode(nodeId: string): void {
    // Remove the node itself
    this.nodes.delete(nodeId);

    // Remove all outgoing edges from this node
    const outgoing = this.outgoingEdges.get(nodeId) || [];
    for (const edge of outgoing) {
      // Remove from target's incoming edges
      const targetIncoming = this.incomingEdges.get(edge.toId) || [];
      this.incomingEdges.set(
        edge.toId,
        targetIncoming.filter((e) => e.fromId !== nodeId)
      );
    }
    this.outgoingEdges.delete(nodeId);

    // Remove all incoming edges to this node
    const incoming = this.incomingEdges.get(nodeId) || [];
    for (const edge of incoming) {
      // Remove from source's outgoing edges
      const sourceOutgoing = this.outgoingEdges.get(edge.fromId) || [];
      this.outgoingEdges.set(
        edge.fromId,
        sourceOutgoing.filter((e) => e.toId !== nodeId)
      );
    }
    this.incomingEdges.delete(nodeId);
  }

  /**
   * Add an edge to the graph
   * Both source and target nodes must already exist
   *
   * @param edge - The dependency edge to add
   * @throws Error if source or target node doesn't exist
   */
  addEdge(edge: DependencyEdge): void {
    // Validate that both nodes exist
    if (!this.nodes.has(edge.fromId)) {
      throw new Error(`Cannot add edge: source node '${edge.fromId}' does not exist`);
    }
    if (!this.nodes.has(edge.toId)) {
      throw new Error(`Cannot add edge: target node '${edge.toId}' does not exist`);
    }

    // Add to outgoing edges of source
    const outgoing = this.outgoingEdges.get(edge.fromId) || [];
    outgoing.push(edge);
    this.outgoingEdges.set(edge.fromId, outgoing);

    // Add to incoming edges of target
    const incoming = this.incomingEdges.get(edge.toId) || [];
    incoming.push(edge);
    this.incomingEdges.set(edge.toId, incoming);
  }

  /**
   * Remove a specific edge from the graph
   *
   * @param fromId - Source node ID
   * @param toId - Target node ID
   */
  removeEdge(fromId: string, toId: string): void {
    // Remove from outgoing edges of source
    const outgoing = this.outgoingEdges.get(fromId) || [];
    this.outgoingEdges.set(
      fromId,
      outgoing.filter((e) => e.toId !== toId)
    );

    // Remove from incoming edges of target
    const incoming = this.incomingEdges.get(toId) || [];
    this.incomingEdges.set(
      toId,
      incoming.filter((e) => e.fromId !== fromId)
    );
  }

  /**
   * Get a node by its ID
   *
   * @param nodeId - The node ID to look up
   * @returns The node, or null if not found
   */
  getNode(nodeId: string): DependencyNode | null {
    return this.nodes.get(nodeId) || null;
  }

  /**
   * Get all outgoing edges from a node
   *
   * @param nodeId - The node ID
   * @returns Array of edges where this node is the source
   */
  getOutgoingEdges(nodeId: string): DependencyEdge[] {
    return this.outgoingEdges.get(nodeId) || [];
  }

  /**
   * Get all incoming edges to a node
   *
   * @param nodeId - The node ID
   * @returns Array of edges where this node is the target
   */
  getIncomingEdges(nodeId: string): DependencyEdge[] {
    return this.incomingEdges.get(nodeId) || [];
  }

  /**
   * Get all nodes in the graph
   *
   * @returns Array of all nodes
   */
  getAllNodes(): DependencyNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all edges in the graph
   *
   * @returns Array of all edges
   */
  getAllEdges(): DependencyEdge[] {
    const edges: DependencyEdge[] = [];
    for (const edgeList of this.outgoingEdges.values()) {
      edges.push(...edgeList);
    }
    return edges;
  }

  /**
   * Check if a node exists in the graph
   *
   * @param nodeId - The node ID to check
   * @returns True if node exists
   */
  hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }

  /**
   * Check if an edge exists in the graph
   *
   * @param fromId - Source node ID
   * @param toId - Target node ID
   * @returns True if edge exists
   */
  hasEdge(fromId: string, toId: string): boolean {
    const outgoing = this.outgoingEdges.get(fromId) || [];
    return outgoing.some((e) => e.toId === toId);
  }

  /**
   * Get the number of nodes in the graph
   *
   * @returns Node count
   */
  getNodeCount(): number {
    return this.nodes.size;
  }

  /**
   * Get the number of edges in the graph
   *
   * @returns Edge count
   */
  getEdgeCount(): number {
    let count = 0;
    for (const edgeList of this.outgoingEdges.values()) {
      count += edgeList.length;
    }
    return count;
  }

  /**
   * Clear all nodes and edges from the graph
   */
  clear(): void {
    this.nodes.clear();
    this.outgoingEdges.clear();
    this.incomingEdges.clear();
  }

  /**
   * Detect cycles in the graph using DFS with coloring
   * Uses white/gray/black coloring to detect back edges
   *
   * - White: unvisited node
   * - Gray: currently being visited (in the recursion stack)
   * - Black: fully processed
   *
   * A back edge (edge to a gray node) indicates a cycle
   *
   * @returns Cycle detection result with all detected cycles
   */
  detectCycles(): CycleDetectionResult {
    const colors = new Map<string, 'white' | 'gray' | 'black'>();
    const parent = new Map<string, string | null>();
    const cycles: CycleInfo[] = [];

    // Initialize all nodes as white
    for (const nodeId of this.nodes.keys()) {
      colors.set(nodeId, 'white');
      parent.set(nodeId, null);
    }

    // DFS from each white node
    for (const nodeId of this.nodes.keys()) {
      if (colors.get(nodeId) === 'white') {
        this.dfsDetectCycles(nodeId, colors, parent, cycles);
      }
    }

    return {
      hasCycles: cycles.length > 0,
      cycles,
      cycleCount: cycles.length,
    };
  }

  /**
   * DFS helper for cycle detection
   * @private
   */
  private dfsDetectCycles(
    nodeId: string,
    colors: Map<string, 'white' | 'gray' | 'black'>,
    parent: Map<string, string | null>,
    cycles: CycleInfo[]
  ): void {
    // Mark as gray (being visited)
    colors.set(nodeId, 'gray');

    // Visit all neighbors
    const outgoing = this.getOutgoingEdges(nodeId);
    for (const edge of outgoing) {
      const neighborId = edge.toId;
      const neighborColor = colors.get(neighborId);

      if (neighborColor === 'white') {
        // Tree edge - continue DFS
        parent.set(neighborId, nodeId);
        this.dfsDetectCycles(neighborId, colors, parent, cycles);
      } else if (neighborColor === 'gray') {
        // Back edge - cycle detected!
        const cyclePath = this.reconstructCycle(nodeId, neighborId, parent);
        cycles.push({
          path: cyclePath,
          description: `Cycle detected: ${cyclePath.join(' -> ')}`,
        });
      }
      // If black, ignore (forward/cross edge in directed graph)
    }

    // Mark as black (fully processed)
    colors.set(nodeId, 'black');
  }

  /**
   * Reconstruct the cycle path from parent pointers
   * @private
   */
  private reconstructCycle(from: string, to: string, parent: Map<string, string | null>): string[] {
    const path: string[] = [to];
    let current: string | null | undefined = from;

    // Walk back from 'from' until we reach 'to'
    while (current && current !== to) {
      path.unshift(current);
      current = parent.get(current);
    }

    // Add 'to' at the end to show the cycle
    path.push(to);

    return path;
  }

  /**
   * Perform topological sort using Kahn's algorithm
   * Returns a valid ordering if the graph is a DAG
   * Returns partial ordering with remaining nodes if cycles exist
   *
   * Time complexity: O(V + E)
   *
   * @returns Topological sort result
   */
  topologicalSort(): TopologicalSortResult {
    // Calculate in-degree for each node
    const inDegree = new Map<string, number>();
    for (const nodeId of this.nodes.keys()) {
      inDegree.set(nodeId, this.getIncomingEdges(nodeId).length);
    }

    // Queue of nodes with in-degree 0
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    // Process nodes in topological order
    const order: string[] = [];
    while (queue.length > 0) {
      // Sort queue for stable ordering
      queue.sort();

      const nodeId = queue.shift()!;
      order.push(nodeId);

      // Reduce in-degree of neighbors
      const outgoing = this.getOutgoingEdges(nodeId);
      for (const edge of outgoing) {
        const neighborId = edge.toId;
        const currentDegree = inDegree.get(neighborId) || 0;
        const newDegree = currentDegree - 1;
        inDegree.set(neighborId, newDegree);

        if (newDegree === 0) {
          queue.push(neighborId);
        }
      }
    }

    // Check if all nodes were processed
    const remainingNodes: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree > 0) {
        remainingNodes.push(nodeId);
      }
    }

    const success = remainingNodes.length === 0;

    // Reverse the order for evaluation: dependencies should be evaluated first
    // In our graph, edge A->B means "A depends on B", so B must be evaluated before A
    // Kahn's algorithm gives us nodes with no dependencies first, which is the opposite
    // of what we want for evaluation order
    const evaluationOrder = order.reverse();

    return {
      success,
      order: evaluationOrder,
      remainingNodes,
      error: success ? null : `Cycle detected: ${remainingNodes.length} nodes could not be sorted`,
    };
  }

  /**
   * Check if adding an edge would create a cycle
   * Useful for validation before adding edges
   *
   * @param fromId - Proposed source node ID
   * @param toId - Proposed target node ID
   * @returns True if adding this edge would create a cycle
   */
  wouldCreateCycle(fromId: string, toId: string): boolean {
    // Check if there's already a path from toId to fromId
    // If so, adding fromId -> toId would create a cycle
    return this.hasPath(toId, fromId);
  }

  /**
   * Check if there's a path from source to target using BFS
   *
   * @param sourceId - Source node ID
   * @param targetId - Target node ID
   * @returns True if a path exists
   */
  hasPath(sourceId: string, targetId: string): boolean {
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) {
      return false;
    }

    if (sourceId === targetId) {
      return true;
    }

    const visited = new Set<string>();
    const queue: string[] = [sourceId];
    visited.add(sourceId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      const outgoing = this.getOutgoingEdges(currentId);
      for (const edge of outgoing) {
        const neighborId = edge.toId;

        if (neighborId === targetId) {
          return true;
        }

        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }

    return false;
  }
}
