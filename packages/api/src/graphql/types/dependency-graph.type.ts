/**
 * Dependency Graph GraphQL Types
 * Represents nodes, edges, and operations for the dependency graph system that tracks
 * relationships between conditions, variables, effects, and entities.
 */

import { ObjectType, Field, ID, registerEnumType, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

/**
 * DependencyNodeType - Type of node in the dependency graph
 */
export enum DependencyNodeType {
  VARIABLE = 'VARIABLE',
  CONDITION = 'CONDITION',
  EFFECT = 'EFFECT',
  ENTITY = 'ENTITY',
}

registerEnumType(DependencyNodeType, {
  name: 'DependencyNodeType',
  description: 'Type of node in the dependency graph',
});

/**
 * DependencyEdgeType - Type of dependency relationship
 */
export enum DependencyEdgeType {
  READS = 'READS', // Condition or effect reads a variable
  WRITES = 'WRITES', // Effect writes to a variable
  DEPENDS_ON = 'DEPENDS_ON', // Generic dependency relationship
}

registerEnumType(DependencyEdgeType, {
  name: 'DependencyEdgeType',
  description: 'Type of dependency relationship between nodes',
});

/**
 * DependencyNode - Represents a node in the dependency graph
 */
@ObjectType()
export class DependencyNode {
  @Field(() => ID, {
    description: 'Unique identifier for this node (format: <type>:<entityId>)',
  })
  id!: string;

  @Field(() => DependencyNodeType, {
    description: 'Type of node (VARIABLE, CONDITION, EFFECT, or ENTITY)',
  })
  type!: DependencyNodeType;

  @Field(() => ID, {
    description: 'ID of the underlying entity in the database',
  })
  entityId!: string;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Additional metadata about this node',
  })
  metadata?: Record<string, unknown> | null;

  @Field(() => String, {
    nullable: true,
    description: 'Human-readable name or label for this node',
  })
  label?: string | null;
}

/**
 * DependencyEdge - Represents a directed edge between two nodes
 */
@ObjectType()
export class DependencyEdge {
  @Field(() => ID, {
    description: 'Source node ID',
  })
  fromId!: string;

  @Field(() => ID, {
    description: 'Target node ID',
  })
  toId!: string;

  @Field(() => DependencyEdgeType, {
    description: 'Type of dependency relationship',
  })
  type!: DependencyEdgeType;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Additional metadata about this edge',
  })
  metadata?: Record<string, unknown> | null;
}

/**
 * CycleInfo - Information about a detected cycle in the graph
 */
@ObjectType()
export class CycleInfo {
  @Field(() => [ID], {
    description: 'Path of node IDs that form the cycle',
  })
  path!: string[];

  @Field(() => String, {
    nullable: true,
    description: 'Human-readable description of the cycle',
  })
  description?: string | null;
}

/**
 * CycleDetectionResult - Result of cycle detection analysis
 */
@ObjectType()
export class CycleDetectionResult {
  @Field({ description: 'Whether any cycles were detected in the graph' })
  hasCycles!: boolean;

  @Field(() => [CycleInfo], {
    description: 'List of all detected cycles with their paths',
  })
  cycles!: CycleInfo[];

  @Field(() => Int, {
    description: 'Total number of cycles detected',
  })
  cycleCount!: number;
}

/**
 * TopologicalSortResult - Result of topological sort operation
 */
@ObjectType()
export class TopologicalSortResult {
  @Field({ description: 'Whether the topological sort succeeded (false if cycles detected)' })
  success!: boolean;

  @Field(() => [ID], {
    description: 'Ordered list of node IDs in topological order (dependencies first)',
  })
  order!: string[];

  @Field(() => [ID], {
    description: 'Node IDs that could not be sorted due to cycles',
  })
  remainingNodes!: string[];

  @Field(() => String, {
    nullable: true,
    description: 'Error message if sort failed',
  })
  error?: string | null;
}

/**
 * DependencyGraphStats - Statistics about the dependency graph
 */
@ObjectType()
export class DependencyGraphStats {
  @Field(() => Int, {
    description: 'Total number of nodes in the graph',
  })
  nodeCount!: number;

  @Field(() => Int, {
    description: 'Total number of edges in the graph',
  })
  edgeCount!: number;

  @Field(() => Int, {
    description: 'Number of variable nodes',
  })
  variableCount!: number;

  @Field(() => Int, {
    description: 'Number of condition nodes',
  })
  conditionCount!: number;

  @Field(() => Int, {
    description: 'Number of effect nodes',
  })
  effectCount!: number;

  @Field(() => Int, {
    description: 'Number of entity nodes',
  })
  entityCount!: number;
}

/**
 * DependencyGraphResult - Complete dependency graph with nodes and edges
 */
@ObjectType()
export class DependencyGraphResult {
  @Field(() => [DependencyNode], {
    description: 'All nodes in the dependency graph',
  })
  nodes!: DependencyNode[];

  @Field(() => [DependencyEdge], {
    description: 'All edges in the dependency graph',
  })
  edges!: DependencyEdge[];

  @Field(() => DependencyGraphStats, {
    description: 'Statistics about the graph',
  })
  stats!: DependencyGraphStats;

  @Field(() => String, { description: 'Campaign ID this graph belongs to' })
  campaignId!: string;

  @Field(() => String, { description: 'Branch ID this graph represents' })
  branchId!: string;

  @Field({ description: 'Timestamp when this graph was built or last updated' })
  builtAt!: Date;
}
