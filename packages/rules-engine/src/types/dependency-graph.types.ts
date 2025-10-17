/**
 * Dependency Graph Types
 * Represents nodes, edges, and operations for the dependency graph system that tracks
 * relationships between conditions, variables, effects, and entities.
 *
 * These are simplified versions of the API's GraphQL types, adapted for the rules engine.
 */

/**
 * DependencyNodeType - Type of node in the dependency graph
 */
export enum DependencyNodeType {
  VARIABLE = 'VARIABLE',
  CONDITION = 'CONDITION',
  EFFECT = 'EFFECT',
  ENTITY = 'ENTITY',
}

/**
 * DependencyEdgeType - Type of dependency relationship
 */
export enum DependencyEdgeType {
  READS = 'READS', // Condition or effect reads a variable
  WRITES = 'WRITES', // Effect writes to a variable
  DEPENDS_ON = 'DEPENDS_ON', // Generic dependency relationship
}

/**
 * DependencyNode - Represents a node in the dependency graph
 */
export interface DependencyNode {
  /**
   * Unique identifier for this node (format: <type>:<entityId>)
   */
  id: string;

  /**
   * Type of node (VARIABLE, CONDITION, EFFECT, or ENTITY)
   */
  type: DependencyNodeType;

  /**
   * ID of the underlying entity in the database
   */
  entityId: string;

  /**
   * Additional metadata about this node
   */
  metadata?: Record<string, unknown> | null;

  /**
   * Human-readable name or label for this node
   */
  label?: string | null;
}

/**
 * DependencyEdge - Represents a directed edge between two nodes
 */
export interface DependencyEdge {
  /**
   * Source node ID
   */
  fromId: string;

  /**
   * Target node ID
   */
  toId: string;

  /**
   * Type of dependency relationship
   */
  type: DependencyEdgeType;

  /**
   * Additional metadata about this edge
   */
  metadata?: Record<string, unknown> | null;
}

/**
 * CycleInfo - Information about a detected cycle in the graph
 */
export interface CycleInfo {
  /**
   * Path of node IDs that form the cycle
   */
  path: string[];

  /**
   * Human-readable description of the cycle
   */
  description?: string | null;
}

/**
 * CycleDetectionResult - Result of cycle detection analysis
 */
export interface CycleDetectionResult {
  /**
   * Whether any cycles were detected in the graph
   */
  hasCycles: boolean;

  /**
   * List of all detected cycles with their paths
   */
  cycles: CycleInfo[];

  /**
   * Total number of cycles detected
   */
  cycleCount: number;
}

/**
 * TopologicalSortResult - Result of topological sort operation
 */
export interface TopologicalSortResult {
  /**
   * Whether the topological sort succeeded (false if cycles detected)
   */
  success: boolean;

  /**
   * Ordered list of node IDs in topological order (dependencies first)
   */
  order: string[];

  /**
   * Node IDs that could not be sorted due to cycles
   */
  remainingNodes: string[];

  /**
   * Error message if sort failed
   */
  error?: string | null;
}
