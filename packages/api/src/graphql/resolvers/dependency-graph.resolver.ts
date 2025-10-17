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
   * Get the complete dependency graph for a campaign/branch
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
   * Get all nodes that a specific node depends on (upstream dependencies)
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
   * Get all nodes that depend on a specific node (downstream dependents)
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
   * Validate the dependency graph for cycles
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
   * Get the evaluation order for all nodes (topological sort)
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
   * Invalidate the cached dependency graph for a campaign/branch
   * This forces the graph to be rebuilt on the next query
   * Requires owner or gm role
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
