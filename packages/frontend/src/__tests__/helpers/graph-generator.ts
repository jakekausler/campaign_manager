import type {
  DependencyGraphResult,
  DependencyNodeType,
  DependencyEdgeType,
} from '@/services/api/hooks';

/**
 * Generate a large dependency graph for performance testing.
 *
 * @param nodeCount - Number of nodes to generate
 * @param edgeDensity - Ratio of edges to nodes (e.g., 1.5 means 150 edges for 100 nodes)
 * @returns A DependencyGraphResult with the specified size
 */
export function generateLargeGraph(nodeCount: number, edgeDensity = 1.5): DependencyGraphResult {
  const nodes: DependencyGraphResult['nodes'] = [];
  const edges: DependencyGraphResult['edges'] = [];

  const nodeTypes: DependencyNodeType[] = ['VARIABLE', 'CONDITION', 'EFFECT', 'ENTITY'];
  const edgeTypes: DependencyEdgeType[] = ['READS', 'WRITES', 'DEPENDS_ON'];

  // Generate nodes
  for (let i = 0; i < nodeCount; i++) {
    const nodeType = nodeTypes[i % nodeTypes.length];
    nodes.push({
      id: `node-${i}`,
      type: nodeType, // Field name is 'type' not 'nodeType'
      entityId: `entity-${i}`,
      label: `${nodeType} ${i}`,
      metadata: {},
    });
  }

  // Generate edges with realistic dependencies
  const edgeCount = Math.floor(nodeCount * edgeDensity);
  const usedEdges = new Set<string>();

  for (let i = 0; i < edgeCount; i++) {
    // Create directed acyclic graph (DAG) by only creating edges from lower to higher indices
    // This prevents cycles naturally
    const sourceIndex = Math.floor(Math.random() * (nodeCount - 1));
    const targetIndex = sourceIndex + 1 + Math.floor(Math.random() * (nodeCount - sourceIndex - 1));

    const edgeKey = `${sourceIndex}-${targetIndex}`;

    // Skip if edge already exists (no duplicate edges)
    if (usedEdges.has(edgeKey)) {
      continue;
    }

    usedEdges.add(edgeKey);

    const edgeType = edgeTypes[i % edgeTypes.length];
    edges.push({
      fromId: `node-${sourceIndex}`, // Field name is 'fromId' not 'source'
      toId: `node-${targetIndex}`, // Field name is 'toId' not 'target'
      type: edgeType, // Field name is 'type' not 'edgeType'
      metadata: {},
    });
  }

  // Calculate statistics
  const variableCount = nodes.filter(
    (n): n is typeof n & { type: 'VARIABLE' } => n.type === 'VARIABLE'
  ).length;
  const conditionCount = nodes.filter(
    (n): n is typeof n & { type: 'CONDITION' } => n.type === 'CONDITION'
  ).length;
  const effectCount = nodes.filter(
    (n): n is typeof n & { type: 'EFFECT' } => n.type === 'EFFECT'
  ).length;
  const entityCount = nodes.filter(
    (n): n is typeof n & { type: 'ENTITY' } => n.type === 'ENTITY'
  ).length;

  return {
    nodes,
    edges,
    stats: {
      nodeCount,
      edgeCount: edges.length,
      variableCount,
      conditionCount,
      effectCount,
      entityCount,
    },
    campaignId: 'test-campaign',
    branchId: 'main',
    builtAt: new Date().toISOString(),
  };
}

/**
 * Generate a graph with cycles for stress testing cycle detection.
 *
 * @param nodeCount - Number of nodes to generate
 * @returns A DependencyGraphResult with cycles
 */
export function generateGraphWithCycles(nodeCount: number): DependencyGraphResult {
  const nodes: DependencyGraphResult['nodes'] = [];
  const edges: DependencyGraphResult['edges'] = [];

  const nodeTypes: DependencyNodeType[] = ['VARIABLE', 'CONDITION', 'EFFECT', 'ENTITY'];
  const edgeTypes: DependencyEdgeType[] = ['READS', 'WRITES', 'DEPENDS_ON'];

  // Generate nodes
  for (let i = 0; i < nodeCount; i++) {
    const nodeType = nodeTypes[i % nodeTypes.length];
    nodes.push({
      id: `node-${i}`,
      type: nodeType, // Field name is 'type' not 'nodeType'
      entityId: `entity-${i}`,
      label: `${nodeType} ${i}`,
      metadata: {},
    });
  }

  // Generate edges with cycles
  for (let i = 0; i < nodeCount - 1; i++) {
    const edgeType = edgeTypes[i % edgeTypes.length];
    // Forward edge
    edges.push({
      fromId: `node-${i}`, // Field name is 'fromId' not 'source'
      toId: `node-${i + 1}`, // Field name is 'toId' not 'target'
      type: edgeType, // Field name is 'type' not 'edgeType'
      metadata: {},
    });
  }

  // Create cycle back to first node
  edges.push({
    fromId: `node-${nodeCount - 1}`, // Field name is 'fromId' not 'source'
    toId: `node-0`, // Field name is 'toId' not 'target'
    type: 'DEPENDS_ON', // Field name is 'type' not 'edgeType'
    metadata: {},
  });

  // Calculate statistics
  const variableCount = nodes.filter(
    (n): n is typeof n & { type: 'VARIABLE' } => n.type === 'VARIABLE'
  ).length;
  const conditionCount = nodes.filter(
    (n): n is typeof n & { type: 'CONDITION' } => n.type === 'CONDITION'
  ).length;
  const effectCount = nodes.filter(
    (n): n is typeof n & { type: 'EFFECT' } => n.type === 'EFFECT'
  ).length;
  const entityCount = nodes.filter(
    (n): n is typeof n & { type: 'ENTITY' } => n.type === 'ENTITY'
  ).length;

  return {
    nodes,
    edges,
    stats: {
      nodeCount,
      edgeCount: edges.length,
      variableCount,
      conditionCount,
      effectCount,
      entityCount,
    },
    campaignId: 'test-campaign',
    branchId: 'main',
    builtAt: new Date().toISOString(),
  };
}

/**
 * Generate a disconnected graph with multiple subgraphs.
 *
 * @param subgraphCount - Number of disconnected subgraphs
 * @param nodesPerSubgraph - Nodes in each subgraph
 * @returns A DependencyGraphResult with disconnected components
 */
export function generateDisconnectedGraph(
  subgraphCount: number,
  nodesPerSubgraph: number
): DependencyGraphResult {
  const nodes: DependencyGraphResult['nodes'] = [];
  const edges: DependencyGraphResult['edges'] = [];

  const nodeTypes: DependencyNodeType[] = ['VARIABLE', 'CONDITION', 'EFFECT', 'ENTITY'];
  const edgeTypes: DependencyEdgeType[] = ['READS', 'WRITES', 'DEPENDS_ON'];

  let nodeIndex = 0;
  let edgeIndex = 0;

  // Generate disconnected subgraphs
  for (let sg = 0; sg < subgraphCount; sg++) {
    const subgraphStart = nodeIndex;

    // Generate nodes for this subgraph
    for (let i = 0; i < nodesPerSubgraph; i++) {
      const nodeType = nodeTypes[nodeIndex % nodeTypes.length];
      nodes.push({
        id: `node-${nodeIndex}`,
        type: nodeType, // Field name is 'type' not 'nodeType'
        entityId: `entity-${nodeIndex}`,
        label: `${nodeType} ${nodeIndex}`,
        metadata: {},
      });
      nodeIndex++;
    }

    // Generate edges within this subgraph only (no connections between subgraphs)
    for (let i = 0; i < nodesPerSubgraph - 1; i++) {
      const edgeType = edgeTypes[edgeIndex % edgeTypes.length];
      edges.push({
        fromId: `node-${subgraphStart + i}`, // Field name is 'fromId' not 'source'
        toId: `node-${subgraphStart + i + 1}`, // Field name is 'toId' not 'target'
        type: edgeType, // Field name is 'type' not 'edgeType'
        metadata: {},
      });
      edgeIndex++;
    }
  }

  // Calculate statistics
  const variableCount = nodes.filter(
    (n): n is typeof n & { type: 'VARIABLE' } => n.type === 'VARIABLE'
  ).length;
  const conditionCount = nodes.filter(
    (n): n is typeof n & { type: 'CONDITION' } => n.type === 'CONDITION'
  ).length;
  const effectCount = nodes.filter(
    (n): n is typeof n & { type: 'EFFECT' } => n.type === 'EFFECT'
  ).length;
  const entityCount = nodes.filter(
    (n): n is typeof n & { type: 'ENTITY' } => n.type === 'ENTITY'
  ).length;

  return {
    nodes,
    edges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      variableCount,
      conditionCount,
      effectCount,
      entityCount,
    },
    campaignId: 'test-campaign',
    branchId: 'main',
    builtAt: new Date().toISOString(),
  };
}
