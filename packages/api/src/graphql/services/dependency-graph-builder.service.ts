/**
 * @fileoverview Dependency Graph Builder Service
 *
 * This service is responsible for constructing and maintaining in-memory dependency graphs
 * that represent relationships between conditions, state variables, and effects within a campaign.
 * It queries the database for active entities, extracts their dependencies using the
 * DependencyExtractor utility, and builds a complete graph structure showing how entities
 * read from and write to state variables.
 *
 * Key Responsibilities:
 * - Build complete dependency graphs for campaigns from database state
 * - Support incremental graph updates when individual entities change
 * - Create nodes for conditions, variables, and effects
 * - Create edges representing READ and WRITE relationships
 * - Handle virtual variable nodes for settlement/structure properties
 * - Filter entities by campaign context and active status
 *
 * Graph Structure:
 * - Nodes: CONDITION (computed fields), VARIABLE (state storage), EFFECT (state mutations)
 * - Edges: READS (condition/effect → variable), WRITES (effect → variable)
 *
 * Usage:
 * - GraphQL resolvers use this to build graphs for dependency analysis
 * - Real-time update system uses incremental updates when entities change
 * - Cache invalidation system uses graph to determine affected entities
 *
 * @module DependencyGraphBuilderService
 */

import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import type { Expression } from '../../rules/types/expression.types';
import {
  DependencyNode,
  DependencyEdge,
  DependencyNodeType,
  DependencyEdgeType,
} from '../types/dependency-graph.type';
import { DependencyExtractor } from '../utils/dependency-extractor';
import { DependencyGraph } from '../utils/dependency-graph';

/**
 * Service for building and maintaining dependency graphs from database entities.
 *
 * This service provides both full graph construction for campaigns and incremental
 * update operations for individual entities. It handles the complexity of polymorphic
 * relationships, virtual nodes for entity properties, and proper edge creation based
 * on JSONLogic expressions and JSON Patch operations.
 *
 * The dependency graph is used for:
 * - Visualizing entity relationships in the Flow View
 * - Cache invalidation when state variables change
 * - Impact analysis for rule changes
 * - Debugging condition evaluation dependencies
 *
 * @class DependencyGraphBuilderService
 */
@Injectable()
export class DependencyGraphBuilderService {
  private readonly logger = new Logger(DependencyGraphBuilderService.name);
  private readonly dependencyExtractor = new DependencyExtractor();

  /**
   * Constructs a new DependencyGraphBuilderService instance.
   *
   * @param {PrismaService} prisma - Prisma database client for querying entities
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Builds a complete dependency graph for a campaign and branch.
   *
   * This method performs a comprehensive query of all active conditions, state variables,
   * and effects associated with the specified campaign, then constructs a full in-memory
   * dependency graph showing their relationships.
   *
   * The graph construction follows this process:
   * 1. Query all active FieldConditions (filters by isActive and deletedAt)
   * 2. Query all active StateVariables (filters by isActive and deletedAt)
   * 3. Query all active patch-type Effects (filters by isActive, deletedAt, effectType)
   * 4. Create VARIABLE nodes for all state variables
   * 5. Create CONDITION nodes and READS edges to referenced variables
   * 6. Create EFFECT nodes and WRITES edges to modified variables
   * 7. Create virtual variable nodes for settlement/structure properties as needed
   *
   * Virtual nodes are created for entity properties (e.g., "settlement.level") that are
   * referenced in conditions but don't exist as StateVariable records in the database.
   *
   * @param {string} campaignId - The ID of the campaign to build the graph for
   * @param {string} [branchId='main'] - The ID of the branch (defaults to 'main' for MVP)
   * @returns {Promise<DependencyGraph>} A fully populated dependency graph with nodes and edges
   * @throws {Error} If database queries fail or graph construction encounters errors
   *
   * @example
   * const graph = await builder.buildGraphForCampaign('campaign-123');
   * console.log(`Graph has ${graph.getNodeCount()} nodes and ${graph.getEdgeCount()} edges`);
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

      // Query all active Effects for this campaign
      // Effects are attached to encounters or events, which belong to campaigns
      // Note: Cannot use include since polymorphic relations have no FK constraints
      const effects = await this.prisma.effect.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          effectType: 'patch', // Only patch-type effects write to variables
        },
      });

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
        const reads = this.dependencyExtractor.extractReads(condition.expression as Expression);
        this.logger.debug(
          `Condition ${condition.id} reads variables: ${Array.from(reads).join(', ')}`
        );

        // Create READS edges from condition to each variable it reads
        for (const varName of reads) {
          // Find or create variable node
          // For Settlement/Structure dependencies (e.g., "settlement.level", "structure.type"),
          // create virtual variable nodes since they don't exist as StateVariables
          let varNode = this.findVariableNodeByKey(graph, varName);

          if (!varNode) {
            // Check if this is a Settlement/Structure dependency
            if (varName.startsWith('settlement.') || varName.startsWith('structure.')) {
              // Create virtual variable node for Settlement/Structure property
              const virtualNodeId = this.makeVariableNodeId(varName);
              const virtualNode: DependencyNode = {
                id: virtualNodeId,
                type: DependencyNodeType.VARIABLE,
                entityId: varName, // Use the full path as entityId for virtual nodes
                label: varName,
                metadata: {
                  key: varName,
                  virtual: true, // Mark as virtual to distinguish from StateVariables
                  entityType: varName.split('.')[0], // 'settlement' or 'structure'
                },
              };
              graph.addNode(virtualNode);
              varNode = virtualNode;
              this.logger.debug(`Created virtual variable node for ${varName}`);
            }
          }

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

      // Step 3: Add all effect nodes and their WRITES edges
      for (const effect of effects) {
        // Only include patch-type effects (defensive check - query should already filter)
        if (effect.effectType !== 'patch') {
          continue; // Skip non-patch effects
        }

        // Only include effects that belong to the campaign
        // Must query entity manually since polymorphic relations have no FK constraints
        const effectCampaignId = await this.getCampaignIdForEntity(
          effect.entityType,
          effect.entityId
        );
        if (effectCampaignId !== campaignId) {
          continue; // Skip effects from other campaigns
        }

        const effectNodeId = this.makeEffectNodeId(effect.id);
        const effectNode: DependencyNode = {
          id: effectNodeId,
          type: DependencyNodeType.EFFECT,
          entityId: effect.id,
          label: effect.name,
          metadata: {
            effectType: effect.effectType,
            entityType: effect.entityType,
            entityId: effect.entityId,
            timing: effect.timing,
            priority: effect.priority,
          },
        };
        graph.addNode(effectNode);

        // Extract variable writes from effect payload (JSON Patch operations)
        const writes = this.dependencyExtractor.extractWrites(effect);
        this.logger.debug(`Effect ${effect.id} writes variables: ${Array.from(writes).join(', ')}`);

        // Create WRITES edges from effect to each variable it writes
        for (const varName of writes) {
          // Find variable node by key (simplified - in production would need scope resolution)
          const varNode = this.findVariableNodeByKey(graph, varName);
          if (varNode) {
            const edge: DependencyEdge = {
              fromId: effectNodeId,
              toId: varNode.id,
              type: DependencyEdgeType.WRITES,
              metadata: { variableKey: varName },
            };
            try {
              graph.addEdge(edge);
            } catch (error) {
              this.logger.warn(
                `Failed to add edge from ${effectNodeId} to ${varNode.id}: ${error}`
              );
            }
          } else {
            this.logger.debug(
              `Variable ${varName} referenced by effect ${effect.id} not found in graph`
            );
          }
        }
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
   * Incrementally updates the dependency graph when a condition is added or modified.
   *
   * This method performs a targeted update of the graph by:
   * 1. Fetching the latest condition data from the database
   * 2. Removing the condition node if it no longer exists, is inactive, or deleted
   * 3. Removing all outgoing edges from the condition node
   * 4. Re-creating the condition node with updated metadata
   * 5. Extracting variable dependencies from the updated expression
   * 6. Creating new READS edges to all referenced variables
   *
   * This is more efficient than rebuilding the entire graph and is used by the
   * real-time update system when condition expressions are modified.
   *
   * @param {DependencyGraph} graph - The dependency graph to update in-place
   * @param {string} conditionId - The ID of the condition that was added or modified
   * @returns {Promise<void>} Promise that resolves when the graph has been updated
   * @throws {Error} If database query fails or graph update operations fail
   *
   * @example
   * // After a condition's expression is updated
   * await builder.updateGraphForCondition(graph, 'condition-456');
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
      const reads = this.dependencyExtractor.extractReads(condition.expression as Expression);

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
   * Incrementally updates the dependency graph when a state variable is added or modified.
   *
   * This method performs a targeted update of the graph by:
   * 1. Fetching the latest variable data from the database
   * 2. Removing the variable node if it no longer exists, is inactive, or deleted
   * 3. Updating the variable node with new metadata (scope, key, type)
   * 4. Preserving all existing edges to/from the variable node
   *
   * Unlike condition and effect updates, variable updates do not rebuild edges because
   * the variable's identity (scope:key) determines its dependencies, not its value or metadata.
   * Edges to variables are created by conditions and effects that reference them.
   *
   * @param {DependencyGraph} graph - The dependency graph to update in-place
   * @param {string} variableId - The ID of the state variable that was added or modified
   * @returns {Promise<void>} Promise that resolves when the graph has been updated
   * @throws {Error} If database query fails or graph update operations fail
   *
   * @example
   * // After a variable's metadata is updated
   * await builder.updateGraphForVariable(graph, 'var-789');
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
   * Incrementally updates the dependency graph when an effect is added or modified.
   *
   * This method performs a targeted update of the graph by:
   * 1. Fetching the latest effect data from the database
   * 2. Removing the effect node if it no longer exists, is inactive, deleted, or not patch-type
   * 3. Removing all outgoing edges from the effect node
   * 4. Re-creating the effect node with updated metadata
   * 5. Extracting variable writes from the updated JSON Patch payload
   * 6. Creating new WRITES edges to all modified variables
   *
   * Only patch-type effects are included in the graph since they are the only effects
   * that write to state variables. Other effect types (notification, webhook) do not
   * modify state and are therefore not part of the dependency graph.
   *
   * @param {DependencyGraph} graph - The dependency graph to update in-place
   * @param {string} effectId - The ID of the effect that was added or modified
   * @returns {Promise<void>} Promise that resolves when the graph has been updated
   * @throws {Error} If database query fails or graph update operations fail
   *
   * @example
   * // After an effect's JSON Patch payload is updated
   * await builder.updateGraphForEffect(graph, 'effect-101');
   */
  async updateGraphForEffect(graph: DependencyGraph, effectId: string): Promise<void> {
    this.logger.debug(`Updating graph for effect ${effectId}`);

    try {
      // Fetch the effect
      // Note: Cannot use include since polymorphic relations have no FK constraints
      const effect = await this.prisma.effect.findUnique({
        where: { id: effectId },
      });

      if (!effect) {
        this.logger.warn(`Effect ${effectId} not found, removing from graph if exists`);
        this.removeFromGraph(graph, this.makeEffectNodeId(effectId));
        return;
      }

      // If effect is inactive, deleted, or not a patch-type effect, remove from graph
      if (!effect.isActive || effect.deletedAt || effect.effectType !== 'patch') {
        this.logger.debug(
          `Effect ${effectId} is inactive, deleted, or not patch-type, removing from graph`
        );
        this.removeFromGraph(graph, this.makeEffectNodeId(effectId));
        return;
      }

      const effectNodeId = this.makeEffectNodeId(effectId);

      // Remove old edges from this effect
      const oldOutgoingEdges = graph.getOutgoingEdges(effectNodeId);
      for (const edge of oldOutgoingEdges) {
        graph.removeEdge(edge.fromId, edge.toId);
      }

      // Update or add the effect node
      const effectNode: DependencyNode = {
        id: effectNodeId,
        type: DependencyNodeType.EFFECT,
        entityId: effect.id,
        label: effect.name,
        metadata: {
          effectType: effect.effectType,
          entityType: effect.entityType,
          entityId: effect.entityId,
          timing: effect.timing,
          priority: effect.priority,
        },
      };
      graph.addNode(effectNode);

      // Extract new writes and add edges
      const writes = this.dependencyExtractor.extractWrites(effect);

      for (const varName of writes) {
        const varNode = this.findVariableNodeByKey(graph, varName);
        if (varNode) {
          const edge: DependencyEdge = {
            fromId: effectNodeId,
            toId: varNode.id,
            type: DependencyEdgeType.WRITES,
            metadata: { variableKey: varName },
          };
          try {
            graph.addEdge(edge);
          } catch (error) {
            this.logger.warn(`Failed to add edge from ${effectNodeId} to ${varNode.id}: ${error}`);
          }
        } else {
          this.logger.debug(
            `Variable ${varName} referenced by effect ${effectId} not found in graph`
          );
        }
      }

      this.logger.debug(`Updated graph for effect ${effectId}`);
    } catch (error) {
      this.logger.error(`Failed to update graph for effect ${effectId}:`, error);
      throw error;
    }
  }

  /**
   * Removes a node and all its connected edges from the dependency graph.
   *
   * This method delegates to the DependencyGraph's removeNode method, which automatically
   * removes all incoming and outgoing edges when the node is removed. This ensures the
   * graph remains in a consistent state.
   *
   * Used internally by update methods when an entity becomes inactive, is deleted, or
   * no longer exists in the database.
   *
   * @param {DependencyGraph} graph - The dependency graph to update in-place
   * @param {string} nodeId - The ID of the node to remove (format: "TYPE:entityId")
   * @returns {void}
   *
   * @example
   * // Remove a condition node that was deleted
   * this.removeFromGraph(graph, 'CONDITION:condition-123');
   */
  removeFromGraph(graph: DependencyGraph, nodeId: string): void {
    this.logger.debug(`Removing node ${nodeId} from graph`);
    graph.removeNode(nodeId);
  }

  /**
   * Creates a standardized node ID for a state variable.
   *
   * Node IDs follow the format "VARIABLE:<variableId>" to ensure uniqueness and
   * make the node type easily identifiable from the ID alone.
   *
   * @param {string} variableId - The database ID of the state variable
   * @returns {string} Formatted node ID (e.g., "VARIABLE:var-123")
   * @private
   */
  private makeVariableNodeId(variableId: string): string {
    return `VARIABLE:${variableId}`;
  }

  /**
   * Creates a standardized node ID for a field condition.
   *
   * Node IDs follow the format "CONDITION:<conditionId>" to ensure uniqueness and
   * make the node type easily identifiable from the ID alone.
   *
   * @param {string} conditionId - The database ID of the field condition
   * @returns {string} Formatted node ID (e.g., "CONDITION:cond-456")
   * @private
   */
  private makeConditionNodeId(conditionId: string): string {
    return `CONDITION:${conditionId}`;
  }

  /**
   * Creates a standardized node ID for an effect.
   *
   * Node IDs follow the format "EFFECT:<effectId>" to ensure uniqueness and
   * make the node type easily identifiable from the ID alone.
   *
   * @param {string} effectId - The database ID of the effect
   * @returns {string} Formatted node ID (e.g., "EFFECT:eff-789")
   * @private
   */
  private makeEffectNodeId(effectId: string): string {
    return `EFFECT:${effectId}`;
  }

  /**
   * Finds a variable node in the graph by its variable key.
   *
   * This method performs a linear search through all nodes to find a VARIABLE node
   * with a matching key in its metadata. This is a simplified lookup that matches
   * on key only, without considering scope resolution.
   *
   * NOTE: This is an MVP implementation. In production, this should be enhanced to:
   * - Use a key-to-node index for O(1) lookup performance
   * - Implement proper scope resolution (e.g., "campaign.gold" vs "settlement.gold")
   * - Handle namespace conflicts when the same key exists in different scopes
   *
   * @param {DependencyGraph} graph - The dependency graph to search
   * @param {string} key - The variable key to find (e.g., "campaign.gold", "settlement.level")
   * @returns {DependencyNode | null} The matching variable node, or null if not found
   * @private
   *
   * @example
   * const node = this.findVariableNodeByKey(graph, 'campaign.gold');
   * if (node) {
   *   console.log(`Found variable: ${node.label}`);
   * }
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

  /**
   * Retrieves the campaign ID for a given entity using polymorphic relationship lookup.
   *
   * Since the Effect table uses a polymorphic pattern (entityType + entityId) without
   * foreign key constraints, we must manually query the appropriate table to resolve
   * the campaign ID. This method handles the different entity types that can have effects.
   *
   * Currently supported entity types:
   * - 'encounter': Looks up Encounter.campaignId
   * - 'event': Looks up Event.campaignId
   *
   * @param {string} entityType - The type of entity (case-insensitive, e.g., 'encounter', 'event')
   * @param {string} entityId - The database ID of the entity
   * @returns {Promise<string | null>} The campaign ID if found, or null if entity doesn't exist or type is unsupported
   * @throws {Error} If database query fails
   * @private
   *
   * @example
   * const campaignId = await this.getCampaignIdForEntity('encounter', 'enc-123');
   * if (campaignId === 'campaign-456') {
   *   // Include this effect in the graph
   * }
   */
  private async getCampaignIdForEntity(
    entityType: string,
    entityId: string
  ): Promise<string | null> {
    const entityTypeLower = entityType.toLowerCase();

    switch (entityTypeLower) {
      case 'encounter': {
        const encounter = await this.prisma.encounter.findUnique({
          where: { id: entityId },
          select: { campaignId: true },
        });
        return encounter?.campaignId ?? null;
      }

      case 'event': {
        const event = await this.prisma.event.findUnique({
          where: { id: entityId },
          select: { campaignId: true },
        });
        return event?.campaignId ?? null;
      }

      default:
        this.logger.warn(`Unknown entity type for campaign lookup: ${entityType}`);
        return null;
    }
  }
}
