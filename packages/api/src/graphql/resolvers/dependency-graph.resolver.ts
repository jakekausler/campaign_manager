/**
 * Dependency Graph Resolver
 * GraphQL resolvers for dependency graph queries and mutations.
 * Exposes operations to query the dependency graph, analyze dependencies,
 * detect cycles, and get evaluation order for conditions and variables.
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { DependencyGraphService } from '../services/dependency-graph.service';
import {
  CycleDetectionResult,
  DependencyGraphResult,
  DependencyNode,
} from '../types/dependency-graph.type';

@Resolver()
export class DependencyGraphResolver {
  constructor(private readonly dependencyGraphService: DependencyGraphService) {}

  // ============= Query Resolvers =============

  /**
   * Retrieves the complete dependency graph for a campaign and branch.
   *
   * Returns all nodes (variables, conditions, effects, entities), their edges (dependency relationships),
   * and statistics about the graph structure. The graph represents the flow of data and dependencies
   * between computed fields, conditions, and world state.
   *
   * **Authorization:** Authenticated user with campaign access required
   *
   * @param campaignId - Campaign identifier
   * @param branchId - Branch identifier (defaults to 'main')
   * @param user - Authenticated user requesting the graph
   * @returns Complete dependency graph with nodes, edges, statistics, and metadata
   *
   * @see {@link DependencyGraphService.getGraph} for graph building and caching logic
   */
  @Query(() => DependencyGraphResult, {
    description:
      'Get the complete dependency graph for a campaign and branch, including all nodes, edges, and statistics',
  })
  @UseGuards(JwtAuthGuard)
  async getDependencyGraph(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @Args('branchId', { type: () => String, defaultValue: 'main' }) branchId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<DependencyGraphResult> {
    // Get the dependency graph from the service
    const graph = await this.dependencyGraphService.getGraph(campaignId, branchId, user);

    // Convert internal graph structure to GraphQL result type
    const nodes: DependencyNode[] = graph.getAllNodes();
    const edges = graph.getAllEdges();

    // Calculate statistics
    const stats = {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      variableCount: nodes.filter((n) => n.type === 'VARIABLE').length,
      conditionCount: nodes.filter((n) => n.type === 'CONDITION').length,
      effectCount: nodes.filter((n) => n.type === 'EFFECT').length,
      entityCount: nodes.filter((n) => n.type === 'ENTITY').length,
    };

    return {
      nodes,
      edges,
      stats,
      campaignId,
      branchId,
      builtAt: new Date(),
    };
  }

  /**
   * Retrieves all nodes that a specific node depends on (upstream dependencies).
   *
   * Returns the transitive closure of dependencies - all nodes that must be evaluated
   * before the specified node can be evaluated. For example, for a condition, this returns
   * all variables it reads; for a variable, this returns all other variables it depends on.
   *
   * **Authorization:** Authenticated user with campaign access required
   *
   * @param campaignId - Campaign identifier
   * @param branchId - Branch identifier (defaults to 'main')
   * @param nodeId - The node to get dependencies for
   * @param user - Authenticated user requesting the dependencies
   * @returns Array of dependency nodes (nodes that the specified node depends on)
   *
   * @see {@link DependencyGraphService.getDependenciesOf} for dependency traversal logic
   */
  @Query(() => [DependencyNode], {
    description:
      'Get all nodes that a specific node depends on (upstream dependencies). For example, get all variables that a condition reads.',
  })
  @UseGuards(JwtAuthGuard)
  async getNodeDependencies(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @Args('branchId', { type: () => String, defaultValue: 'main' }) branchId: string,
    @Args('nodeId', { type: () => ID }) nodeId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<DependencyNode[]> {
    return this.dependencyGraphService.getDependenciesOf(campaignId, branchId, nodeId, user);
  }

  /**
   * Retrieves all nodes that depend on a specific node (downstream dependents).
   *
   * Returns the transitive closure of dependents - all nodes that would be affected
   * if the specified node changes. For example, for a variable, this returns all conditions
   * and other variables that read it; for an entity, this returns all conditions that
   * reference it. Useful for impact analysis and cache invalidation.
   *
   * **Authorization:** Authenticated user with campaign access required
   *
   * @param campaignId - Campaign identifier
   * @param branchId - Branch identifier (defaults to 'main')
   * @param nodeId - The node to get dependents for
   * @param user - Authenticated user requesting the dependents
   * @returns Array of dependent nodes (nodes that depend on the specified node)
   *
   * @see {@link DependencyGraphService.getDependents} for dependent traversal logic
   */
  @Query(() => [DependencyNode], {
    description:
      'Get all nodes that depend on a specific node (downstream dependents). For example, get all conditions that read a variable.',
  })
  @UseGuards(JwtAuthGuard)
  async getNodeDependents(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @Args('branchId', { type: () => String, defaultValue: 'main' }) branchId: string,
    @Args('nodeId', { type: () => ID }) nodeId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<DependencyNode[]> {
    return this.dependencyGraphService.getDependents(campaignId, branchId, nodeId, user);
  }

  /**
   * Validates the dependency graph for cyclic dependencies.
   *
   * Performs cycle detection to ensure the graph is acyclic (a Directed Acyclic Graph).
   * Cycles prevent proper evaluation order and must be resolved. Returns detailed
   * information about any detected cycles, including the nodes involved in each cycle
   * and which edges form the cycle.
   *
   * **Authorization:** Authenticated user with campaign access required
   *
   * @param campaignId - Campaign identifier
   * @param branchId - Branch identifier (defaults to 'main')
   * @param user - Authenticated user requesting validation
   * @returns Cycle detection result with hasCycles flag and cycle details if found
   *
   * @see {@link DependencyGraphService.validateNoCycles} for cycle detection algorithm
   */
  @Query(() => CycleDetectionResult, {
    description:
      'Validate the dependency graph for cycles. Returns information about any detected cycles, which would prevent proper evaluation order.',
  })
  @UseGuards(JwtAuthGuard)
  async validateDependencyGraph(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @Args('branchId', { type: () => String, defaultValue: 'main' }) branchId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<CycleDetectionResult> {
    const result = await this.dependencyGraphService.validateNoCycles(campaignId, branchId, user);

    // The result from the service already has the correct format
    return result;
  }

  /**
   * Retrieves the evaluation order for all nodes via topological sort.
   *
   * Returns node IDs in topological order where all dependencies of a node appear
   * before that node in the list. This order ensures that when evaluating conditions
   * and variables, all dependencies are computed before they are needed. Returns an
   * empty array if cycles are detected (preventing valid topological ordering).
   *
   * **Authorization:** Authenticated user with campaign access required
   *
   * @param campaignId - Campaign identifier
   * @param branchId - Branch identifier (defaults to 'main')
   * @param user - Authenticated user requesting the evaluation order
   * @returns Array of node IDs in evaluation order, or empty array if cycles exist
   *
   * @see {@link DependencyGraphService.getEvaluationOrder} for topological sort implementation
   */
  @Query(() => [String], {
    description:
      'Get the evaluation order for all nodes in the dependency graph. Returns node IDs in topological order (dependencies first). Returns empty array if cycles are detected.',
  })
  @UseGuards(JwtAuthGuard)
  async getEvaluationOrder(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @Args('branchId', { type: () => String, defaultValue: 'main' }) branchId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<string[]> {
    return this.dependencyGraphService.getEvaluationOrder(campaignId, branchId, user);
  }

  // ============= Mutation Resolvers =============

  /**
   * Invalidates the cached dependency graph for a campaign and branch.
   *
   * Forces the dependency graph to be rebuilt from scratch on the next query.
   * This is useful when the graph may be stale due to schema changes, manual database
   * modifications, or suspected cache inconsistencies. The graph will be automatically
   * rebuilt when next accessed.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Clears cached dependency graph for the specified campaign/branch
   * - Next graph query will trigger a full rebuild
   *
   * @param campaignId - Campaign identifier
   * @param branchId - Branch identifier (defaults to 'main')
   * @param user - Authenticated user performing the invalidation
   * @returns True if cache invalidation succeeded
   *
   * @see {@link DependencyGraphService.invalidateGraph} for cache clearing logic
   */
  @Mutation(() => Boolean, {
    description:
      'Invalidate the cached dependency graph for a campaign/branch, forcing it to be rebuilt on the next query. Requires owner or gm role.',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async invalidateDependencyGraph(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @Args('branchId', { type: () => String, defaultValue: 'main' }) branchId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<boolean> {
    // Verify campaign access before invalidating
    // This is handled by the service's verifyCampaignAccess, but we need to
    // call it explicitly since invalidateGraph doesn't verify access itself
    await this.dependencyGraphService.getGraph(campaignId, branchId, user);

    // If we got here, user has access, so invalidate the cache
    this.dependencyGraphService.invalidateGraph(campaignId, branchId);

    return true;
  }
}
