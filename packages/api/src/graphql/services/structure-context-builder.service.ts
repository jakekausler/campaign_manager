/**
 * @fileoverview Structure Context Builder Service
 *
 * Builds rich structure context for JSONLogic evaluation in the rules engine.
 * Provides structure-specific context including properties, typed variables,
 * settlement relationships, and derived operational status.
 *
 * The context builder performs the following operations:
 * - Loads structure data from the database with soft-delete filtering
 * - Determines operational status based on typed variables (operational flag or integrity threshold)
 * - Constructs a comprehensive context object for rules engine evaluation
 *
 * Operational Status Logic:
 * - If 'operational' boolean variable exists: uses its value directly
 * - If 'integrity' numeric variable exists: operational if >= 50
 * - Otherwise: defaults to operational (true)
 *
 * This service is used by the rules engine to evaluate computed fields
 * that depend on structure state, such as production rates, maintenance costs,
 * or upgrade eligibility.
 *
 * @module services/structure-context-builder
 */

import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

/**
 * Extended structure context for rules engine evaluation.
 *
 * Includes operational status determination not present in the basic Structure model.
 * This interface represents the complete context object passed to the rules engine
 * for evaluating JSONLogic expressions in computed fields.
 *
 * @interface StructureRulesContext
 */
export interface StructureRulesContext {
  /** Unique structure identifier */
  id: string;

  /** Structure display name */
  name: string;

  /** Structure type (e.g., 'tavern', 'blacksmith', 'wall') */
  type: string;

  /** Structure upgrade level (1-5, defaults to 1) */
  level: number;

  /** ID of parent settlement containing this structure */
  settlementId: string;

  /** User-defined typed variables for dynamic properties */
  variables: Record<string, unknown>;

  /** Derived operational status based on variables or integrity */
  operational: boolean;
}

/**
 * Service for building structure-specific context for rules engine evaluation.
 *
 * This service constructs comprehensive context objects that include structure
 * properties, relationships, and derived state used in JSONLogic condition
 * and computed field evaluation.
 *
 * The context includes:
 * - Core structure properties (id, name, type, level)
 * - Settlement relationship (settlementId)
 * - User-defined typed variables
 * - Derived operational status
 *
 * Used by the rules engine worker to evaluate computed fields on structures.
 *
 * @class StructureContextBuilderService
 */
@Injectable()
export class StructureContextBuilderService {
  /**
   * Creates an instance of StructureContextBuilderService.
   *
   * @param {PrismaService} prisma - Prisma database service for structure queries
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Builds comprehensive structure context for rules engine evaluation.
   *
   * Loads structure data from the database (excluding soft-deleted structures)
   * and constructs a rich context object including:
   * - Core structure properties
   * - Settlement relationship
   * - User-defined typed variables
   * - Derived operational status
   *
   * The operational status is determined by examining typed variables:
   * - Explicit 'operational' boolean flag takes precedence
   * - Falls back to 'integrity' threshold check (>= 50)
   * - Defaults to true if no status indicators present
   *
   * @param {string} structureId - Unique identifier of the structure to build context for
   * @returns {Promise<StructureRulesContext>} Structure context with operational status and all properties
   * @throws {NotFoundException} If structure doesn't exist or has been soft-deleted
   *
   * @example
   * ```typescript
   * const context = await structureContextBuilder.buildContext('struct_123');
   * // Returns:
   * // {
   * //   id: 'struct_123',
   * //   name: 'Grand Tavern',
   * //   type: 'tavern',
   * //   level: 3,
   * //   settlementId: 'settlement_456',
   * //   variables: { capacity: 50, integrity: 85 },
   * //   operational: true
   * // }
   * ```
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
   * Determines if a structure is operational based on its typed variables.
   *
   * Implements a precedence-based logic for operational status:
   * 1. Explicit 'operational' boolean flag (if present and boolean type)
   * 2. Integrity threshold check (if present and >= 50)
   * 3. Default to operational (true)
   *
   * A structure is considered non-operational if:
   * - It has an explicit 'operational' variable set to false, OR
   * - It has an 'integrity' variable < 50
   *
   * This method is defensive and handles:
   * - Null/undefined variables
   * - Non-object variables
   * - Type mismatches (non-boolean operational, non-numeric integrity)
   *
   * @private
   * @param {unknown} variables - Structure typed variables (expected to be Record<string, unknown>)
   * @returns {boolean} True if structure is operational, false otherwise
   *
   * @example
   * ```typescript
   * // Explicit operational flag takes precedence
   * determineOperationalStatus({ operational: false, integrity: 100 }); // false
   *
   * // Integrity threshold when no explicit flag
   * determineOperationalStatus({ integrity: 30 }); // false
   * determineOperationalStatus({ integrity: 75 }); // true
   *
   * // Default to operational
   * determineOperationalStatus({}); // true
   * determineOperationalStatus(null); // true
   * ```
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
