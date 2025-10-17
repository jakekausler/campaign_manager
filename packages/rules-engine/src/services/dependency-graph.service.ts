/**
 * Dependency Graph Service
 * Manages in-memory caching of dependency graphs per campaign/branch.
 * Provides methods for retrieving graphs, invalidating caches, and analyzing dependencies.
 */

import { Injectable, Logger } from '@nestjs/common';

import { DependencyGraph } from '../utils/dependency-graph';

import { DependencyGraphBuilderService } from './dependency-graph-builder.service';

/**
 * DependencyGraphService - Caching and management layer for dependency graphs
 *
 * This service maintains an in-memory cache of dependency graphs keyed by
 * campaign ID and branch ID. It handles:
 * - Cache miss: builds graph from database via builder service
 * - Cache hit: returns cached graph
 * - Cache invalidation: clears cache on structural changes
 */
@Injectable()
export class DependencyGraphService {
  private readonly logger = new Logger(DependencyGraphService.name);

  // In-memory cache: Map<"campaignId:branchId", DependencyGraph>
  private readonly graphCache = new Map<string, DependencyGraph>();

  constructor(private readonly builder: DependencyGraphBuilderService) {}

  /**
   * Get the dependency graph for a campaign/branch
   * Returns cached graph if available, otherwise builds from database
   *
   * @param campaignId - Campaign ID
   * @param branchId - Branch ID (defaults to 'main')
   * @returns Dependency graph for the campaign/branch
   * @throws Error if campaignId or branchId are invalid
   */
  async getGraph(campaignId: string, branchId: string = 'main'): Promise<DependencyGraph> {
    // Validate inputs to prevent cache poisoning and injection attacks
    this.validateCampaignId(campaignId);
    this.validateBranchId(branchId);

    const cacheKey = this.makeCacheKey(campaignId, branchId);

    // Check cache
    const cachedGraph = this.graphCache.get(cacheKey);
    if (cachedGraph) {
      this.logger.debug(`Cache hit for graph ${cacheKey}`);
      return cachedGraph;
    }

    // Cache miss - build graph
    this.logger.debug(`Cache miss for graph ${cacheKey}, building from database`);
    const graph = await this.builder.buildGraphForCampaign(campaignId, branchId);

    // Store in cache
    this.graphCache.set(cacheKey, graph);
    this.logger.log(
      `Cached graph ${cacheKey}: ${graph.getNodeCount()} nodes, ${graph.getEdgeCount()} edges`
    );

    return graph;
  }

  /**
   * Invalidate the cached graph for a campaign/branch
   * Forces rebuild on next access
   *
   * @param campaignId - Campaign ID
   * @param branchId - Branch ID (defaults to 'main')
   */
  invalidateGraph(campaignId: string, branchId: string = 'main'): void {
    const cacheKey = this.makeCacheKey(campaignId, branchId);

    if (this.graphCache.has(cacheKey)) {
      this.logger.log(`Invalidating graph cache for ${cacheKey}`);
      this.graphCache.delete(cacheKey);
    } else {
      this.logger.debug(`No cached graph found for ${cacheKey}, nothing to invalidate`);
    }
  }

  /**
   * Get all upstream dependencies of a node
   * (nodes that this node depends on)
   *
   * @param campaignId - Campaign ID
   * @param branchId - Branch ID
   * @param nodeId - Node ID to get dependencies for
   * @returns Array of node IDs that this node depends on
   */
  async getDependenciesOf(campaignId: string, branchId: string, nodeId: string): Promise<string[]> {
    const graph = await this.getGraph(campaignId, branchId);

    const dependencies: string[] = [];
    const outgoing = graph.getOutgoingEdges(nodeId);

    for (const edge of outgoing) {
      dependencies.push(edge.toId);
    }

    return dependencies;
  }

  /**
   * Get all downstream dependents of a node
   * (nodes that depend on this node)
   *
   * @param campaignId - Campaign ID
   * @param branchId - Branch ID
   * @param nodeId - Node ID to get dependents for
   * @returns Array of node IDs that depend on this node
   */
  async getDependentsOf(campaignId: string, branchId: string, nodeId: string): Promise<string[]> {
    const graph = await this.getGraph(campaignId, branchId);

    const dependents: string[] = [];
    const incoming = graph.getIncomingEdges(nodeId);

    for (const edge of incoming) {
      dependents.push(edge.fromId);
    }

    return dependents;
  }

  /**
   * Validate that the dependency graph has no cycles
   *
   * @param campaignId - Campaign ID
   * @param branchId - Branch ID
   * @returns Cycle detection result
   */
  async validateNoCycles(campaignId: string, branchId: string) {
    const graph = await this.getGraph(campaignId, branchId);
    return graph.detectCycles();
  }

  /**
   * Get evaluation order for all nodes using topological sort
   *
   * @param campaignId - Campaign ID
   * @param branchId - Branch ID
   * @returns Topological sort result with evaluation order
   */
  async getEvaluationOrder(campaignId: string, branchId: string) {
    const graph = await this.getGraph(campaignId, branchId);
    return graph.topologicalSort();
  }

  /**
   * Incrementally update the graph when a condition changes
   *
   * @param campaignId - Campaign ID
   * @param branchId - Branch ID
   * @param conditionId - ID of the changed condition
   */
  async updateCondition(campaignId: string, branchId: string, conditionId: string): Promise<void> {
    const cacheKey = this.makeCacheKey(campaignId, branchId);
    const cachedGraph = this.graphCache.get(cacheKey);

    if (cachedGraph) {
      this.logger.debug(`Incrementally updating graph ${cacheKey} for condition ${conditionId}`);
      await this.builder.updateGraphForCondition(cachedGraph, conditionId);
    } else {
      this.logger.debug(`No cached graph for ${cacheKey}, will build fresh on next access`);
    }
  }

  /**
   * Incrementally update the graph when a variable changes
   *
   * @param campaignId - Campaign ID
   * @param branchId - Branch ID
   * @param variableId - ID of the changed variable
   */
  async updateVariable(campaignId: string, branchId: string, variableId: string): Promise<void> {
    const cacheKey = this.makeCacheKey(campaignId, branchId);
    const cachedGraph = this.graphCache.get(cacheKey);

    if (cachedGraph) {
      this.logger.debug(`Incrementally updating graph ${cacheKey} for variable ${variableId}`);
      await this.builder.updateGraphForVariable(cachedGraph, variableId);
    } else {
      this.logger.debug(`No cached graph for ${cacheKey}, will build fresh on next access`);
    }
  }

  /**
   * Get cache statistics
   *
   * @returns Object with cache statistics
   */
  getCacheStats() {
    return {
      cachedGraphs: this.graphCache.size,
      cacheKeys: Array.from(this.graphCache.keys()),
    };
  }

  /**
   * Clear all cached graphs
   * Useful for testing or manual cache management
   */
  clearAllCaches(): void {
    this.logger.log(`Clearing all ${this.graphCache.size} cached graphs`);
    this.graphCache.clear();
  }

  /**
   * Create cache key from campaign and branch IDs
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
   * Validate campaign ID input
   * Prevents cache poisoning and injection attacks
   *
   * @param campaignId - Campaign ID to validate
   * @throws Error if invalid
   * @private
   */
  private validateCampaignId(campaignId: string): void {
    if (!campaignId || typeof campaignId !== 'string') {
      throw new Error('Campaign ID must be a non-empty string');
    }
    if (campaignId.length > 100) {
      throw new Error('Campaign ID exceeds maximum length of 100 characters');
    }
    // Basic sanitization - reject suspicious characters
    if (!/^[a-zA-Z0-9_-]+$/.test(campaignId)) {
      throw new Error('Campaign ID contains invalid characters');
    }
  }

  /**
   * Validate branch ID input
   * Prevents cache poisoning and injection attacks
   *
   * @param branchId - Branch ID to validate
   * @throws Error if invalid
   * @private
   */
  private validateBranchId(branchId: string): void {
    if (!branchId || typeof branchId !== 'string') {
      throw new Error('Branch ID must be a non-empty string');
    }
    if (branchId.length > 200) {
      throw new Error('Branch ID exceeds maximum length of 200 characters');
    }
    // Basic sanitization - allow alphanumeric, hyphen, underscore, slash
    if (!/^[a-zA-Z0-9_/-]+$/.test(branchId)) {
      throw new Error('Branch ID contains invalid characters');
    }
  }
}
