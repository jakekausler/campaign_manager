/**
 * Settlement Context Builder Service
 * Builds rich settlement context for JSONLogic evaluation in rules engine
 * Includes settlement properties, typed variables, and computed structure statistics
 */

import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

/**
 * Extended settlement context for rules engine evaluation
 * Includes computed structure statistics not present in basic Settlement model
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

@Injectable()
export class SettlementContextBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build settlement context for rules engine evaluation
   * Loads settlement data and calculates structure statistics
   *
   * @param settlementId - Settlement ID to build context for
   * @returns Settlement context with structure statistics
   * @throws NotFoundException if settlement doesn't exist or is deleted
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
   * Calculate structure statistics from structure list
   * Computes total count, count by type, and average level
   *
   * @param structures - List of structures to analyze
   * @returns Structure statistics object
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
