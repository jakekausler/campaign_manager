/**
 * Structure Context Builder Service
 * Builds rich structure context for JSONLogic evaluation in rules engine
 * Includes structure properties, typed variables, and operational status
 */

import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

/**
 * Extended structure context for rules engine evaluation
 * Includes operational status determination not present in basic Structure model
 */
export interface StructureRulesContext {
  id: string;
  name: string;
  type: string;
  level: number;
  settlementId: string;
  variables: Record<string, unknown>;
  operational: boolean;
}

@Injectable()
export class StructureContextBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build structure context for rules engine evaluation
   * Loads structure data and determines operational status
   *
   * @param structureId - Structure ID to build context for
   * @returns Structure context with operational status
   * @throws NotFoundException if structure doesn't exist or is deleted
   */
  async buildContext(structureId: string): Promise<StructureRulesContext> {
    // Load structure
    const structure = await this.prisma.structure.findFirst({
      where: {
        id: structureId,
        deletedAt: null,
      },
    });

    if (!structure) {
      throw new NotFoundException(`Structure with ID ${structureId} not found`);
    }

    // Determine operational status
    const operational = this.determineOperationalStatus(structure.variables);

    // Build context
    const context: StructureRulesContext = {
      id: structure.id,
      name: structure.name,
      type: structure.type,
      level: structure.level ?? 1,
      settlementId: structure.settlementId,
      variables: (structure.variables as Record<string, unknown>) ?? {},
      operational,
    };

    return context;
  }

  /**
   * Determine if structure is operational
   * Checks for 'operational' typed variable or defaults to true
   * A structure is considered non-operational if it has an explicit
   * 'operational' variable set to false, or if integrity < 50
   *
   * @param variables - Structure typed variables
   * @returns Whether structure is operational
   */
  private determineOperationalStatus(variables: unknown): boolean {
    if (!variables || typeof variables !== 'object') {
      return true;
    }

    const vars = variables as Record<string, unknown>;

    // Check explicit operational flag (only if it's a boolean)
    if ('operational' in vars && typeof vars.operational === 'boolean') {
      return vars.operational;
    }

    // Check integrity threshold (if present, must be >= 50)
    if ('integrity' in vars && typeof vars.integrity === 'number') {
      return vars.integrity >= 50;
    }

    // Default to operational if no status indicators present
    return true;
  }
}
