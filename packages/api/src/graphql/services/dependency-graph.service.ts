/**
 * @fileoverview Dependency Graph Service
 *
 * High-level service for dependency graph operations with caching and authorization.
 * Provides campaign-scoped access to dependency graphs for querying dependencies,
 * detecting cycles, computing evaluation order, and managing graph cache.
 *
 * Key features:
 * - In-memory caching per campaign/branch for performance optimization
 * - Campaign access authorization and security
 * - Query operations (dependencies, dependents, cycles, topological sort)
 * - Automatic cache invalidation on entity changes
 * - Integration with DependencyGraphBuilderService for graph construction
 *
 * Used by GraphQL resolvers to provide dependency analysis capabilities
 * including transitive dependencies, cycle detection, and evaluation order
 * computation for conditional field processing and effect application.
 *
 * @see {@link DependencyGraphBuilderService} for graph construction logic
 * @see {@link DependencyGraph} for core graph algorithms and data structures
 *
 * @module graphql/services/dependency-graph
 */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import type { CycleDetectionResult, DependencyNode } from '../types/dependency-graph.type';
import { DependencyGraph } from '../utils/dependency-graph';

import { DependencyGraphBuilderService } from './dependency-graph-builder.service';

/**
 * Service for high-level dependency graph operations with caching and authorization.
 *
 * This service provides campaign-scoped access to dependency graphs with:
 * - **In-memory caching** - Caches graphs per campaign/branch for performance
 * - **Authorization** - Verifies user has access to campaign before operations
 * - **Query operations** - Get dependencies, dependents, cycles, evaluation order
 * - **Cache invalidation** - Invalidates cache when entities are modified
 *
 * The dependency graph tracks relationships between entities through computed fields
 * and enables topological sorting for correct evaluation order. Cycle detection
 * ensures the graph remains acyclic (DAG) for valid evaluation order computation.
 *
 * @example
 * ```typescript
 * // Get dependency graph for a campaign
 * const graph = await service.getGraph(campaignId, branchId, user);
 *
 * // Get all dependencies of a node
 * const deps = await service.getDependenciesOf(campaignId, branchId, nodeId, user);
 *
 * // Check for cycles
 * const result = await service.validateNoCycles(campaignId, branchId, user);
 * if (result.hasCycle) {
 *   console.log('Cycles found:', result.cycles);
 * }
 *
 * // Get evaluation order
 * const order = await service.getEvaluationOrder(campaignId, branchId, user);
 * ```
 *
 * @class
 */
@Injectable()
export class DependencyGraphService {
  /**
   * Logger instance for debugging and monitoring graph operations.
   * @private
   * @readonly
   */
  private readonly logger = new Logger(DependencyGraphService.name);

  /**
   * In-memory cache of dependency graphs keyed by "campaignId:branchId".
   * Graphs are built on first access and cached until invalidated.
   * @private
   * @readonly
   */
  private readonly graphCache = new Map<string, DependencyGraph>();

  /**
   * Creates an instance of DependencyGraphService.
   *
   * @param prisma - Prisma database service for campaign access verification
   * @param builder - Graph builder service for constructing graphs from database state
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly builder: DependencyGraphBuilderService
  ) {}

  /**
   * Retrieves the dependency graph for a campaign/branch with caching.
   *
   * This method provides access to the dependency graph for a specific campaign
   * and branch. It uses an in-memory cache to avoid rebuilding graphs on every
   * request. On cache miss, it builds the graph from database state using the
   * DependencyGraphBuilderService.
   *
   * **Authorization**: Verifies that the user has access to the campaign before
   * returning the graph. Throws NotFoundException if access is denied.
   *
   * **Caching**: Graphs are cached per "campaignId:branchId" key and persist
   * until explicitly invalidated via `invalidateGraph()`.
   *
   * @param campaignId - The ID of the campaign to get the graph for
   * @param branchId - The ID of the branch (defaults to 'main')
   * @param user - The authenticated user making the request
   * @returns Promise resolving to the dependency graph for the campaign/branch
   * @throws {NotFoundException} If the campaign is not found or user has no access
   *
   * @example
   * ```typescript
   * const graph = await service.getGraph('campaign-123', 'main', user);
   * const nodes = graph.getNodes();
   * console.log(`Graph has ${nodes.length} nodes`);
   * ```
   */
  async getGraph(
    campaignId: string,
    branchId: string = 'main',
    user: AuthenticatedUser
  ): Promise<DependencyGraph> {
    // Verify campaign access
    await this.verifyCampaignAccess(campaignId, user.id, { id: true });

    const cacheKey = this.makeCacheKey(campaignId, branchId);

    // Check cache
    let graph = this.graphCache.get(cacheKey);

    if (!graph) {
      this.logger.debug(`Cache miss for ${cacheKey}, building graph from database`);
      graph = await this.builder.buildGraphForCampaign(campaignId, branchId);
      this.graphCache.set(cacheKey, graph);
    } else {
      this.logger.debug(`Cache hit for ${cacheKey}`);
    }

    return graph;
  }

  /**
   * Invalidates the cached dependency graph for a campaign/branch.
   *
   * This method removes the cached graph from memory, forcing it to be rebuilt
   * from database state on the next access. This should be called whenever
   * entities are modified in a way that affects the dependency graph structure
   * (e.g., adding/removing computed fields, changing field definitions).
   *
   * **Cache invalidation is typically triggered by:**
   * - Creating, updating, or deleting computed fields
   * - Modifying condition expressions that reference other entities
   * - Entity deletions that remove nodes from the graph
   * - Branch operations that change graph structure
   *
   * @param campaignId - The ID of the campaign whose graph should be invalidated
   * @param branchId - The ID of the branch (defaults to 'main')
   *
   * @example
   * ```typescript
   * // After updating a computed field
   * await computedFieldService.update(fieldId, updates);
   * service.invalidateGraph(campaignId, branchId);
   * ```
   */
  invalidateGraph(campaignId: string, branchId: string = 'main'): void {
    const cacheKey = this.makeCacheKey(campaignId, branchId);
    const existed = this.graphCache.delete(cacheKey);

    if (existed) {
      this.logger.log(`Invalidated graph cache for ${cacheKey}`);
    } else {
      this.logger.debug(`No cached graph found for ${cacheKey}`);
    }
  }

  /**
   * Gets all direct dependencies of a specified node.
   *
   * Returns all nodes that the specified node depends on (direct dependencies only,
   * not transitive). These are the nodes that the specified node reads from or
   * depends on through computed field references or condition expressions.
   *
   * **Graph direction**: Follows outgoing edges from the node. In the dependency
   * graph, an edge from A to B means "A depends on B" (A reads from B).
   *
   * **Use case**: Determine which entities must be evaluated before evaluating
   * the specified node. Useful for understanding data flow and change propagation.
   *
   * @param campaignId - The ID of the campaign containing the node
   * @param branchId - The ID of the branch
   * @param nodeId - The ID of the node to get dependencies for
   * @param user - The authenticated user making the request
   * @returns Promise resolving to array of nodes that this node depends on
   * @throws {NotFoundException} If the campaign is not found or user has no access
   *
   * @example
   * ```typescript
   * // Get dependencies of a quest entity
   * const deps = await service.getDependenciesOf(
   *   'campaign-123',
   *   'main',
   *   'quest-456',
   *   user
   * );
   *
   * // deps might include [character-789, item-012] if quest depends on them
   * console.log(`Quest depends on ${deps.length} entities`);
   * ```
   */
  async getDependenciesOf(
    campaignId: string,
    branchId: string,
    nodeId: string,
    user: AuthenticatedUser
  ): Promise<DependencyNode[]> {
    const graph = await this.getGraph(campaignId, branchId, user);

    // Get outgoing edges (nodes this node depends on)
    const outgoingEdges = graph.getOutgoingEdges(nodeId);

    // Get the target nodes
    const dependencies: DependencyNode[] = [];
    for (const edge of outgoingEdges) {
      const node = graph.getNode(edge.toId);
      if (node) {
        dependencies.push(node);
      }
    }

    return dependencies;
  }

  /**
   * Gets all direct dependents of a specified node.
   *
   * Returns all nodes that depend on the specified node (direct dependents only,
   * not transitive). These are the nodes that would be affected if the specified
   * node changes, because they read from or reference this node in their computed
   * fields or condition expressions.
   *
   * **Graph direction**: Follows incoming edges to the node. In the dependency
   * graph, an edge from A to B means "A depends on B", so incoming edges to B
   * represent all nodes A that depend on B.
   *
   * **Use case**: Determine which entities need to be re-evaluated when the
   * specified node changes. Essential for change propagation and cache invalidation.
   *
   * @param campaignId - The ID of the campaign containing the node
   * @param branchId - The ID of the branch
   * @param nodeId - The ID of the node to get dependents for
   * @param user - The authenticated user making the request
   * @returns Promise resolving to array of nodes that depend on this node
   * @throws {NotFoundException} If the campaign is not found or user has no access
   *
   * @example
   * ```typescript
   * // Get dependents of a character entity
   * const dependents = await service.getDependents(
   *   'campaign-123',
   *   'main',
   *   'character-789',
   *   user
   * );
   *
   * // dependents might include [quest-456, achievement-111] if they reference character
   * console.log(`${dependents.length} entities depend on this character`);
   *
   * // All these dependents need re-evaluation when character changes
   * ```
   */
  async getDependents(
    campaignId: string,
    branchId: string,
    nodeId: string,
    user: AuthenticatedUser
  ): Promise<DependencyNode[]> {
    const graph = await this.getGraph(campaignId, branchId, user);

    // Get incoming edges (nodes that depend on this node)
    const incomingEdges = graph.getIncomingEdges(nodeId);

    // Get the source nodes
    const dependents: DependencyNode[] = [];
    for (const edge of incomingEdges) {
      const node = graph.getNode(edge.fromId);
      if (node) {
        dependents.push(node);
      }
    }

    return dependents;
  }

  /**
   * Validates that the dependency graph is acyclic and detects any cycles.
   *
   * This method performs cycle detection on the dependency graph using depth-first
   * search (DFS). A cycle in the dependency graph indicates a circular dependency,
   * which prevents topological sorting and makes it impossible to determine a valid
   * evaluation order for computed fields.
   *
   * **Why cycles are problematic:**
   * - Circular dependencies create infinite loops during evaluation
   * - No valid evaluation order exists (topological sort fails)
   * - Cannot determine which entity to evaluate first
   *
   * **Detection algorithm**: Uses DFS with color marking to detect back edges,
   * which indicate cycles. Returns all detected cycles with their node paths.
   *
   * @param campaignId - The ID of the campaign to validate
   * @param branchId - The ID of the branch
   * @param user - The authenticated user making the request
   * @returns Promise resolving to cycle detection result with hasCycle flag and cycle paths
   * @throws {NotFoundException} If the campaign is not found or user has no access
   *
   * @example
   * ```typescript
   * const result = await service.validateNoCycles('campaign-123', 'main', user);
   *
   * if (result.hasCycle) {
   *   console.error('Dependency cycles detected:');
   *   result.cycles.forEach((cycle, i) => {
   *     console.error(`Cycle ${i + 1}: ${cycle.join(' -> ')}`);
   *   });
   *   // Example output: Cycle 1: quest-A -> character-B -> quest-C -> quest-A
   * } else {
   *   console.log('Graph is acyclic (DAG) - valid for evaluation');
   * }
   * ```
   */
  async validateNoCycles(
    campaignId: string,
    branchId: string,
    user: AuthenticatedUser
  ): Promise<CycleDetectionResult> {
    const graph = await this.getGraph(campaignId, branchId, user);
    return graph.detectCycles();
  }

  /**
   * Computes the evaluation order for all nodes using topological sorting.
   *
   * This method performs a topological sort on the dependency graph to determine
   * the correct order in which to evaluate entities and their computed fields.
   * Nodes with no dependencies appear first, followed by nodes that depend on them.
   *
   * **Topological sort guarantees:**
   * - For every edge (A -> B), node B appears before node A in the result
   * - All dependencies of a node are evaluated before the node itself
   * - The order respects all dependency relationships in the graph
   *
   * **Algorithm**: Uses Kahn's algorithm (BFS-based) with in-degree tracking.
   * The algorithm iteratively removes nodes with zero in-degree and adds them
   * to the result, updating in-degrees of dependent nodes.
   *
   * **Cycle handling**: If the graph contains cycles, topological sort is impossible
   * and this method returns an empty array. Check `validateNoCycles()` first to
   * ensure the graph is acyclic (DAG).
   *
   * @param campaignId - The ID of the campaign
   * @param branchId - The ID of the branch
   * @param user - The authenticated user making the request
   * @returns Promise resolving to array of node IDs in evaluation order (empty if cycles exist)
   * @throws {NotFoundException} If the campaign is not found or user has no access
   *
   * @example
   * ```typescript
   * // Get evaluation order for a campaign
   * const order = await service.getEvaluationOrder('campaign-123', 'main', user);
   *
   * if (order.length === 0) {
   *   console.error('Cannot compute evaluation order - graph has cycles');
   * } else {
   *   console.log('Evaluation order:', order);
   *   // Example: ['character-789', 'quest-456', 'achievement-111']
   *   // Evaluate character first, then quest, then achievement
   *
   *   // Evaluate entities in order
   *   for (const entityId of order) {
   *     await evaluateComputedFields(entityId);
   *   }
   * }
   * ```
   */
  async getEvaluationOrder(
    campaignId: string,
    branchId: string,
    user: AuthenticatedUser
  ): Promise<string[]> {
    const graph = await this.getGraph(campaignId, branchId, user);
    const sortResult = graph.topologicalSort();

    if (!sortResult.success) {
      this.logger.warn(
        `Cannot compute evaluation order for campaign ${campaignId}, branch ${branchId}: graph contains cycles`
      );
      return [];
    }

    return sortResult.order;
  }

  /**
   * Creates a cache key for a campaign/branch combination.
   *
   * The cache key format is "campaignId:branchId", uniquely identifying a graph
   * in the in-memory cache. This simple string concatenation is sufficient because
   * campaign and branch IDs are UUIDs that cannot contain colons.
   *
   * @param campaignId - The ID of the campaign
   * @param branchId - The ID of the branch
   * @returns Cache key string in format "campaignId:branchId"
   * @private
   */
  private makeCacheKey(campaignId: string, branchId: string): string {
    return `${campaignId}:${branchId}`;
  }

  /**
   * Verifies that a campaign exists and the user has access to it.
   *
   * This method enforces campaign-level authorization by checking if the user
   * is either the campaign owner or a member with access. It also ensures the
   * campaign has not been soft-deleted.
   *
   * **Access conditions** (any must be true):
   * - User is the campaign owner (ownerId matches userId)
   * - User is a campaign member (has an active membership record)
   *
   * **Generic type parameter**: Accepts a Prisma select object to specify which
   * fields to return, enabling type-safe field selection.
   *
   * @template T - Prisma CampaignSelect type for type-safe field selection
   * @param campaignId - The ID of the campaign to verify access for
   * @param userId - The ID of the user requesting access
   * @param select - Optional Prisma select object specifying fields to return
   * @returns Promise resolving to campaign object with selected fields
   * @throws {NotFoundException} If campaign not found, deleted, or user has no access
   * @private
   *
   * @example
   * ```typescript
   * // Minimal check (only verify access)
   * await this.verifyCampaignAccess(campaignId, userId, { id: true });
   *
   * // Get campaign with specific fields
   * const campaign = await this.verifyCampaignAccess(
   *   campaignId,
   *   userId,
   *   { id: true, name: true, ownerId: true }
   * );
   * ```
   */
  private async verifyCampaignAccess<T extends Prisma.CampaignSelect>(
    campaignId: string,
    userId: string,
    select?: T
  ): Promise<Prisma.CampaignGetPayload<{ select: T }>> {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        deletedAt: null,
        OR: [
          { ownerId: userId },
          {
            memberships: {
              some: {
                userId,
              },
            },
          },
        ],
      },
      select: select as T,
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found or access denied`);
    }

    return campaign as Prisma.CampaignGetPayload<{ select: T }>;
  }
}
