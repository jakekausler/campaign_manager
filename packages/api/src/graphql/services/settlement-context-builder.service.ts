/**
 * @fileoverview Settlement Context Builder Service
 *
 * Builds rich settlement context for JSONLogic evaluation in the rules engine.
 * Provides settlement-specific data including:
 * - Basic settlement properties (name, level, relationships)
 * - Typed custom variables stored in JSON fields
 * - Computed structure statistics (count, type distribution, average level)
 *
 * Used by computed field resolvers to evaluate conditions and computed values
 * that depend on settlement state and related structures.
 *
 * @module services/settlement-context-builder
 */

import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

/**
 * Extended settlement context for rules engine evaluation.
 *
 * Includes computed structure statistics not present in the basic Settlement model,
 * enabling complex conditions based on structure composition and levels.
 *
 * @interface SettlementRulesContext
 * @property {string} id - Settlement UUID
 * @property {string} name - Settlement name
 * @property {number} level - Settlement level (tier/size)
 * @property {string} kingdomId - Parent kingdom UUID
 * @property {string} locationId - Associated location UUID
 * @property {Record<string, unknown>} variables - Custom typed variables from JSON field
 * @property {Object} structures - Computed structure statistics
 * @property {number} structures.count - Total number of structures
 * @property {Record<string, number>} structures.byType - Count of structures by type
 * @property {number} structures.averageLevel - Average level across all structures
 */
export interface SettlementRulesContext {
  id: string;
  name: string;
  level: number;
  kingdomId: string;
  locationId: string;
  variables: Record<string, unknown>;
  structures: {
    count: number;
    byType: Record<string, number>;
    averageLevel: number;
  };
}

/**
 * Settlement Context Builder Service
 *
 * Builds rich context objects for settlements to enable JSONLogic evaluation
 * in the rules engine. The context includes both direct settlement properties
 * and computed aggregations over related structures.
 *
 * **Key Features:**
 * - Loads settlement data with structure relationships in a single query
 * - Calculates structure statistics (count, type distribution, average level)
 * - Provides typed variables from JSON fields
 * - Filters out soft-deleted entities
 *
 * **Use Cases:**
 * - Evaluating computed field conditions for settlements
 * - Calculating settlement-level values based on structure composition
 * - Rules that depend on settlement size, type distribution, or average quality
 *
 * @class SettlementContextBuilderService
 * @see {@link SettlementRulesContext} for context structure
 * @see {@link packages/api/src/graphql/services/rules-engine-client.service.ts} for rules engine client
 */
@Injectable()
export class SettlementContextBuilderService {
  /**
   * Creates a new SettlementContextBuilderService instance.
   *
   * @param {PrismaService} prisma - Prisma database service for data access
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Builds settlement context for rules engine evaluation.
   *
   * Loads settlement data with related structures in a single optimized query,
   * then calculates structure statistics for use in computed field conditions.
   * Only includes non-deleted settlements and structures.
   *
   * **Context includes:**
   * - Settlement basic properties (id, name, level)
   * - Relationship IDs (kingdomId, locationId)
   * - Custom typed variables from JSON field
   * - Structure statistics (count, type distribution, average level)
   *
   * **Example context:**
   * ```typescript
   * {
   *   id: "settlement-uuid",
   *   name: "Waterdeep",
   *   level: 5,
   *   kingdomId: "kingdom-uuid",
   *   locationId: "location-uuid",
   *   variables: { economicPower: 850, militaryStrength: 620 },
   *   structures: {
   *     count: 15,
   *     byType: { "market": 3, "barracks": 2, "temple": 1 },
   *     averageLevel: 3.2
   *   }
   * }
   * ```
   *
   * @param {string} settlementId - Settlement UUID to build context for
   * @returns {Promise<SettlementRulesContext>} Settlement context with structure statistics
   * @throws {NotFoundException} If settlement doesn't exist or is soft-deleted
   *
   * @example
   * ```typescript
   * const context = await contextBuilder.buildContext("settlement-uuid");
   * // Use context in rules engine evaluation
   * const result = await rulesEngine.evaluateCondition(condition, context);
   * ```
   */
  async buildContext(settlementId: string): Promise<SettlementRulesContext> {
    // Load settlement with structures in single query
    const settlement = await this.prisma.settlement.findFirst({
      where: {
        id: settlementId,
        deletedAt: null,
      },
      include: {
        structures: {
          where: {
            deletedAt: null,
          },
          select: {
            id: true,
            type: true,
            level: true,
          },
        },
      },
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement with ID ${settlementId} not found`);
    }

    // Calculate structure statistics
    const structureStats = this.calculateStructureStats(settlement.structures);

    // Build context
    const context: SettlementRulesContext = {
      id: settlement.id,
      name: settlement.name,
      level: settlement.level ?? 0,
      kingdomId: settlement.kingdomId,
      locationId: settlement.locationId,
      variables: (settlement.variables as Record<string, unknown>) ?? {},
      structures: structureStats,
    };

    return context;
  }

  /**
   * Calculates structure statistics from a list of structures.
   *
   * Computes aggregated statistics used in computed field conditions:
   * - Total structure count
   * - Count by structure type (e.g., "market": 3, "barracks": 2)
   * - Average structure level across all structures
   *
   * Used to enable conditions like:
   * - "Settlement has at least 3 markets"
   * - "Average structure level is above 4"
   * - "Settlement has more than 10 structures total"
   *
   * @private
   * @param {Array<{id: string, type: string, level: number}>} structures - List of structures to analyze
   * @returns {{count: number, byType: Record<string, number>, averageLevel: number}} Structure statistics object
   *
   * @example
   * ```typescript
   * const stats = this.calculateStructureStats([
   *   { id: "1", type: "market", level: 3 },
   *   { id: "2", type: "market", level: 4 },
   *   { id: "3", type: "barracks", level: 2 }
   * ]);
   * // Returns: { count: 3, byType: { market: 2, barracks: 1 }, averageLevel: 3.0 }
   * ```
   */
  private calculateStructureStats(structures: Array<{ id: string; type: string; level: number }>): {
    count: number;
    byType: Record<string, number>;
    averageLevel: number;
  } {
    const count = structures.length;

    // Build count by type map
    const byType: Record<string, number> = {};
    let totalLevels = 0;

    for (const structure of structures) {
      // Count by type
      const currentCount = byType[structure.type] ?? 0;
      byType[structure.type] = currentCount + 1;

      // Sum levels for average calculation
      totalLevels += structure.level ?? 0;
    }

    // Calculate average level (0 if no structures)
    const averageLevel = count > 0 ? totalLevels / count : 0;

    return {
      count,
      byType,
      averageLevel,
    };
  }
}
