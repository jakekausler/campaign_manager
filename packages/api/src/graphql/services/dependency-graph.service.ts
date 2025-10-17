/**
 * Dependency Graph Service
 * High-level service for dependency graph operations with caching.
 * Provides campaign-scoped access to dependency graphs with authorization.
 */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import type { CycleDetectionResult, DependencyNode } from '../types/dependency-graph.type';
import { DependencyGraph } from '../utils/dependency-graph';

import { DependencyGraphBuilderService } from './dependency-graph-builder.service';

/**
 * DependencyGraphService - High-level service for dependency graph operations
 *
 * This service provides campaign-scoped access to dependency graphs with:
 * - In-memory caching per campaign/branch for performance
 * - Campaign access authorization
 * - Query operations (dependencies, dependents, cycles, evaluation order)
 * - Cache invalidation on entity changes
 */
@Injectable()
export class DependencyGraphService {
  private readonly logger = new Logger(DependencyGraphService.name);
  private readonly graphCache = new Map<string, DependencyGraph>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly builder: DependencyGraphBuilderService
  ) {}

  /**
   * Get dependency graph for a campaign/branch
   * Uses cached version if available, otherwise builds from database state
   *
   * @param campaignId - Campaign ID
   * @param branchId - Branch ID (defaults to 'main')
   * @param user - Authenticated user
   * @returns Dependency graph for the campaign/branch
   * @throws NotFoundException if campaign not found or access denied
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
   * Invalidate cached graph for a campaign/branch
   * Forces rebuild on next access
   *
   * @param campaignId - Campaign ID
   * @param branchId - Branch ID (defaults to 'main')
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
   * Get all nodes that the specified node depends on (direct dependencies)
   * These are the nodes that the specified node reads from or depends on
   *
   * @param campaignId - Campaign ID
   * @param branchId - Branch ID
   * @param nodeId - ID of the node to get dependencies for
   * @param user - Authenticated user
   * @returns Array of nodes that this node depends on
   * @throws NotFoundException if campaign not found or access denied
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
   * Get all nodes that depend on the specified node (dependents)
   * These are the nodes that would be affected if the specified node changes
   *
   * @param campaignId - Campaign ID
   * @param branchId - Branch ID
   * @param nodeId - ID of the node to get dependents for
   * @param user - Authenticated user
   * @returns Array of nodes that depend on this node
   * @throws NotFoundException if campaign not found or access denied
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
   * Validate dependency graph and detect cycles
   * Returns detailed information about any cycles found
   *
   * @param campaignId - Campaign ID
   * @param branchId - Branch ID
   * @param user - Authenticated user
   * @returns Cycle detection result with hasCycle flag and cycle paths
   * @throws NotFoundException if campaign not found or access denied
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
   * Get evaluation order for all nodes in the dependency graph
   * Uses topological sort to determine correct evaluation order
   * Returns empty array if cycles exist
   *
   * @param campaignId - Campaign ID
   * @param branchId - Branch ID
   * @param user - Authenticated user
   * @returns Array of node IDs in evaluation order (empty if cycles exist)
   * @throws NotFoundException if campaign not found or access denied
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
   * Create cache key for campaign/branch combination
   *
   * @param campaignId - Campaign ID
   * @param branchId - Branch ID
   * @returns Cache key string
   * @private
   */
  private makeCacheKey(campaignId: string, branchId: string): string {
    return `${campaignId}:${branchId}`;
  }

  /**
   * Verify campaign exists and user has access
   *
   * @param campaignId - The ID of the campaign
   * @param userId - The ID of the user
   * @param select - Fields to select (optional)
   * @returns Campaign object with selected fields
   * @throws NotFoundException if campaign not found or access denied
   * @private
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
