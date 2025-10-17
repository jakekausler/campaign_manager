/**
 * Dependency Graph Builder Service
 * Builds in-memory dependency graphs from database state (conditions, variables, effects).
 * Supports incremental updates for individual entities.
 */

import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import {
  DependencyNode,
  DependencyEdge,
  DependencyNodeType,
  DependencyEdgeType,
} from '../types/dependency-graph.type';
import { DependencyExtractor } from '../utils/dependency-extractor';
import { DependencyGraph } from '../utils/dependency-graph';

/**
 * DependencyGraphBuilderService - Builds dependency graphs from database entities
 *
 * This service queries the database for conditions, variables, and effects (future),
 * extracts their dependencies using DependencyExtractor, and builds a complete
 * in-memory dependency graph.
 */
@Injectable()
export class DependencyGraphBuilderService {
  private readonly logger = new Logger(DependencyGraphBuilderService.name);
  private readonly dependencyExtractor = new DependencyExtractor();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build a complete dependency graph for a campaign/branch
   * Queries all active conditions and variables, extracts dependencies,
   * and constructs the graph
   *
   * @param campaignId - Campaign ID to build graph for
   * @param branchId - Branch ID (defaults to 'main')
   * @returns Populated dependency graph
   */
  async buildGraphForCampaign(
    campaignId: string,
    branchId: string = 'main'
  ): Promise<DependencyGraph> {
    this.logger.debug(`Building dependency graph for campaign ${campaignId}, branch ${branchId}`);

    const graph = new DependencyGraph();

    try {
      // Query all active FieldConditions (any entity type, we'll filter by campaign later)
      // Note: FieldConditions don't directly reference campaigns, they reference entities
      // For MVP, we'll include all field conditions and rely on campaign context filtering later
      const fieldConditions = await this.prisma.fieldCondition.findMany({
        where: {
          isActive: true,
          deletedAt: null,
        },
      });

      this.logger.debug(`Found ${fieldConditions.length} active field conditions`);

      // Query all active StateVariables for this campaign
      // Note: StateVariables use scope/scopeId polymorphic pattern
      // For now, we'll query all and filter by campaign context in future enhancement
      const stateVariables = await this.prisma.stateVariable.findMany({
        where: {
          isActive: true,
          deletedAt: null,
        },
      });

      this.logger.debug(`Found ${stateVariables.length} active state variables`);

      // Query all active Effects (future - TICKET-016)
      // For now, we'll leave this as a stub
      const effects: any[] = [];

      // Step 1: Add all variable nodes
      for (const variable of stateVariables) {
        const nodeId = this.makeVariableNodeId(variable.id);
        const node: DependencyNode = {
          id: nodeId,
          type: DependencyNodeType.VARIABLE,
          entityId: variable.id,
          label: `${variable.scope}:${variable.key}`,
          metadata: {
            scope: variable.scope,
            scopeId: variable.scopeId,
            key: variable.key,
            type: variable.type,
          },
        };
        graph.addNode(node);
      }

      // Step 2: Add all condition nodes and their READS edges
      for (const condition of fieldConditions) {
        const conditionNodeId = this.makeConditionNodeId(condition.id);
        const conditionNode: DependencyNode = {
          id: conditionNodeId,
          type: DependencyNodeType.CONDITION,
          entityId: condition.id,
          label: `${condition.entityType}.${condition.field}`,
          metadata: {
            entityType: condition.entityType,
            entityId: condition.entityId,
            field: condition.field,
          },
        };
        graph.addNode(conditionNode);

        // Extract variable reads from condition expression
        const reads = this.dependencyExtractor.extractReads(condition.expression as any);
        this.logger.debug(
          `Condition ${condition.id} reads variables: ${Array.from(reads).join(', ')}`
        );

        // Create READS edges from condition to each variable it reads
        for (const varName of reads) {
          // Find variable node by key (simplified - in production would need scope resolution)
          const varNode = this.findVariableNodeByKey(graph, varName);
          if (varNode) {
            const edge: DependencyEdge = {
              fromId: conditionNodeId,
              toId: varNode.id,
              type: DependencyEdgeType.READS,
              metadata: { variableKey: varName },
            };
            try {
              graph.addEdge(edge);
            } catch (error) {
              this.logger.warn(
                `Failed to add edge from ${conditionNodeId} to ${varNode.id}: ${error}`
              );
            }
          } else {
            this.logger.debug(
              `Variable ${varName} referenced by condition ${condition.id} not found in graph`
            );
          }
        }
      }

      // Step 3: Add all effect nodes and their WRITES edges (future - TICKET-016)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const _effect of effects) {
        // Placeholder for future implementation
      }

      const stats = {
        nodeCount: graph.getNodeCount(),
        edgeCount: graph.getEdgeCount(),
      };

      this.logger.log(
        `Built dependency graph for campaign ${campaignId}: ${stats.nodeCount} nodes, ${stats.edgeCount} edges`
      );

      return graph;
    } catch (error) {
      this.logger.error(`Failed to build dependency graph for campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Incrementally update the graph when a condition is added/updated
   * Removes old edges and adds new ones based on updated expression
   *
   * @param graph - The graph to update
   * @param conditionId - ID of the condition that changed
   */
  async updateGraphForCondition(graph: DependencyGraph, conditionId: string): Promise<void> {
    this.logger.debug(`Updating graph for condition ${conditionId}`);

    try {
      // Fetch the condition
      const condition = await this.prisma.fieldCondition.findUnique({
        where: { id: conditionId },
      });

      if (!condition) {
        this.logger.warn(`Condition ${conditionId} not found, removing from graph if exists`);
        this.removeFromGraph(graph, this.makeConditionNodeId(conditionId));
        return;
      }

      // If condition is inactive or deleted, remove from graph
      if (!condition.isActive || condition.deletedAt) {
        this.logger.debug(`Condition ${conditionId} is inactive or deleted, removing from graph`);
        this.removeFromGraph(graph, this.makeConditionNodeId(conditionId));
        return;
      }

      const conditionNodeId = this.makeConditionNodeId(conditionId);

      // Remove old edges from this condition
      const oldOutgoingEdges = graph.getOutgoingEdges(conditionNodeId);
      for (const edge of oldOutgoingEdges) {
        graph.removeEdge(edge.fromId, edge.toId);
      }

      // Update or add the condition node
      const conditionNode: DependencyNode = {
        id: conditionNodeId,
        type: DependencyNodeType.CONDITION,
        entityId: condition.id,
        label: `${condition.entityType}.${condition.field}`,
        metadata: {
          entityType: condition.entityType,
          entityId: condition.entityId,
          field: condition.field,
        },
      };
      graph.addNode(conditionNode);

      // Extract new reads and add edges
      const reads = this.dependencyExtractor.extractReads(condition.expression as any);

      for (const varName of reads) {
        const varNode = this.findVariableNodeByKey(graph, varName);
        if (varNode) {
          const edge: DependencyEdge = {
            fromId: conditionNodeId,
            toId: varNode.id,
            type: DependencyEdgeType.READS,
            metadata: { variableKey: varName },
          };
          try {
            graph.addEdge(edge);
          } catch (error) {
            this.logger.warn(
              `Failed to add edge from ${conditionNodeId} to ${varNode.id}: ${error}`
            );
          }
        } else {
          this.logger.debug(
            `Variable ${varName} referenced by condition ${conditionId} not found in graph`
          );
        }
      }

      this.logger.debug(`Updated graph for condition ${conditionId}`);
    } catch (error) {
      this.logger.error(`Failed to update graph for condition ${conditionId}:`, error);
      throw error;
    }
  }

  /**
   * Incrementally update the graph when a variable is added/updated
   * Updates the variable node and preserves existing edges
   *
   * @param graph - The graph to update
   * @param variableId - ID of the variable that changed
   */
  async updateGraphForVariable(graph: DependencyGraph, variableId: string): Promise<void> {
    this.logger.debug(`Updating graph for variable ${variableId}`);

    try {
      // Fetch the variable
      const variable = await this.prisma.stateVariable.findUnique({
        where: { id: variableId },
      });

      if (!variable) {
        this.logger.warn(`Variable ${variableId} not found, removing from graph if exists`);
        this.removeFromGraph(graph, this.makeVariableNodeId(variableId));
        return;
      }

      // If variable is inactive or deleted, remove from graph
      if (!variable.isActive || variable.deletedAt) {
        this.logger.debug(`Variable ${variableId} is inactive or deleted, removing from graph`);
        this.removeFromGraph(graph, this.makeVariableNodeId(variableId));
        return;
      }

      const varNodeId = this.makeVariableNodeId(variableId);

      // Update or add the variable node
      const varNode: DependencyNode = {
        id: varNodeId,
        type: DependencyNodeType.VARIABLE,
        entityId: variable.id,
        label: `${variable.scope}:${variable.key}`,
        metadata: {
          scope: variable.scope,
          scopeId: variable.scopeId,
          key: variable.key,
          type: variable.type,
        },
      };
      graph.addNode(varNode);

      this.logger.debug(`Updated graph for variable ${variableId}`);
    } catch (error) {
      this.logger.error(`Failed to update graph for variable ${variableId}:`, error);
      throw error;
    }
  }

  /**
   * Remove a node and all connected edges from the graph
   *
   * @param graph - The graph to update
   * @param nodeId - ID of the node to remove
   */
  removeFromGraph(graph: DependencyGraph, nodeId: string): void {
    this.logger.debug(`Removing node ${nodeId} from graph`);
    graph.removeNode(nodeId);
  }

  /**
   * Create a node ID for a variable
   * Format: VARIABLE:<variableId>
   */
  private makeVariableNodeId(variableId: string): string {
    return `VARIABLE:${variableId}`;
  }

  /**
   * Create a node ID for a condition
   * Format: CONDITION:<conditionId>
   */
  private makeConditionNodeId(conditionId: string): string {
    return `CONDITION:${conditionId}`;
  }

  /**
   * Find a variable node by its key
   * Note: This is a simplified lookup that matches on key only
   * In production, would need proper scope resolution
   *
   * @param graph - The graph to search
   * @param key - Variable key to find
   * @returns Variable node or null if not found
   * @private
   */
  private findVariableNodeByKey(graph: DependencyGraph, key: string): DependencyNode | null {
    const allNodes = graph.getAllNodes();
    for (const node of allNodes) {
      if (node.type === DependencyNodeType.VARIABLE && node.metadata?.key === key) {
        return node;
      }
    }
    return null;
  }
}
