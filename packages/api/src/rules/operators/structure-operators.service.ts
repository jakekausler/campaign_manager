/**
 * @file Structure Operators Service
 * @description Registers custom JSONLogic operators for querying Structure entities.
 * Provides structure-specific operators for accessing properties, variables, and
 * operational status in rule expressions and computed fields.
 *
 * @module rules/operators
 * @see {@link OperatorRegistry} for operator registration
 * @see {@link StructureContextBuilderService} for context building
 */

import { Injectable, OnModuleInit } from '@nestjs/common';

import type { StructureRulesContext } from '../../graphql/services/structure-context-builder.service';
import { StructureContextBuilderService } from '../../graphql/services/structure-context-builder.service';
import { OperatorRegistry } from '../operator-registry';
import type { CustomOperator } from '../types/expression.types';

/**
 * Service for registering and managing structure-specific JSONLogic operators.
 *
 * @description This service provides custom operators that enable rule expressions
 * and computed fields to access structure data including:
 * - Basic properties (level, type)
 * - Typed variables (custom data fields)
 * - Operational status
 * - Settlement relationships
 *
 * Operators are registered automatically on module initialization and become
 * available for use in JSONLogic expressions throughout the application.
 *
 * @example Basic Usage
 * ```typescript
 * // Check if structure level is at least 3
 * {
 *   ">=": [
 *     { "structure.level": [] },
 *     3
 *   ]
 * }
 * ```
 *
 * @example With Structure ID
 * ```typescript
 * // Get specific structure's type
 * {
 *   "===": [
 *     { "structure.type": ["structure-123"] },
 *     "BARRACKS"
 *   ]
 * }
 * ```
 *
 * @example Variable Access
 * ```typescript
 * // Access structure's defense rating variable
 * {
 *   ">": [
 *     { "structure.var": ["defenseRating"] },
 *     50
 *   ]
 * }
 * ```
 *
 * @class StructureOperatorsService
 * @implements {OnModuleInit}
 */
@Injectable()
export class StructureOperatorsService implements OnModuleInit {
  /**
   * Creates an instance of StructureOperatorsService.
   *
   * @param {OperatorRegistry} operatorRegistry - Registry for custom operators
   * @param {StructureContextBuilderService} structureContextBuilder - Service for building structure context
   */
  constructor(
    private readonly operatorRegistry: OperatorRegistry,
    private readonly structureContextBuilder: StructureContextBuilderService
  ) {}

  /**
   * Lifecycle hook that registers all structure operators on module initialization.
   *
   * @description Called automatically by NestJS when the module is initialized.
   * Registers all structure-specific operators with the operator registry,
   * making them available for use in JSONLogic expressions.
   *
   * @returns {Promise<void>} Promise that resolves when operators are registered
   *
   * @see {@link registerOperators}
   */
  async onModuleInit(): Promise<void> {
    this.registerOperators();
  }

  /**
   * Registers all structure-specific custom operators.
   *
   * @description Creates and registers the following operators:
   * - `structure.level`: Get structure level
   * - `structure.type`: Get structure type
   * - `structure.var`: Get structure typed variable value
   * - `structure.isOperational`: Check if structure is operational
   * - `structure.inSettlement`: Check if structure belongs to a settlement
   *
   * @returns {void}
   *
   * @private
   */
  registerOperators(): void {
    const operators: CustomOperator[] = [
      this.createLevelOperator(),
      this.createTypeOperator(),
      this.createVarOperator(),
      this.createIsOperationalOperator(),
      this.createInSettlementOperator(),
    ];

    for (const operator of operators) {
      this.operatorRegistry.register(operator);
    }
  }

  /**
   * Creates the `structure.level` operator for accessing structure level.
   *
   * @description Returns the level value of a structure, which typically represents
   * upgrade tier, fortification strength, or building quality. Returns 0 if the
   * structure is not found or if no structure ID is provided.
   *
   * @returns {CustomOperator} Operator implementation
   *
   * @example No Structure ID (uses context structure)
   * ```typescript
   * { "structure.level": [] }
   * // Returns: 3 (if context structure has level 3)
   * ```
   *
   * @example Specific Structure ID
   * ```typescript
   * { "structure.level": ["structure-123"] }
   * // Returns: 2 (if structure-123 has level 2)
   * ```
   *
   * @example In Comparison
   * ```typescript
   * {
   *   ">=": [
   *     { "structure.level": [] },
   *     3
   *   ]
   * }
   * // Returns: true if structure level is 3 or higher
   * ```
   *
   * @private
   */
  private createLevelOperator(): CustomOperator {
    return {
      name: 'structure.level',
      description: 'Get structure level',
      implementation: async (...args: unknown[]): Promise<number> => {
        const structureId = args[0] as string | undefined;
        const structure = await this.getStructure(structureId);
        return structure?.level ?? 0;
      },
    };
  }

  /**
   * Creates the `structure.type` operator for accessing structure type.
   *
   * @description Returns the type/category of a structure (e.g., "BARRACKS",
   * "TEMPLE", "MARKET"). Returns undefined if the structure is not found or
   * if no structure ID is provided. Structure types are used to categorize
   * buildings and determine their functionality.
   *
   * @returns {CustomOperator} Operator implementation
   *
   * @example No Structure ID (uses context structure)
   * ```typescript
   * { "structure.type": [] }
   * // Returns: "BARRACKS" (if context structure is a barracks)
   * ```
   *
   * @example Specific Structure ID
   * ```typescript
   * { "structure.type": ["structure-123"] }
   * // Returns: "TEMPLE" (if structure-123 is a temple)
   * ```
   *
   * @example Type Checking
   * ```typescript
   * {
   *   "===": [
   *     { "structure.type": [] },
   *     "MARKET"
   *   ]
   * }
   * // Returns: true if structure is a market
   * ```
   *
   * @example Multiple Type Check
   * ```typescript
   * {
   *   "in": [
   *     { "structure.type": [] },
   *     ["BARRACKS", "ARMORY", "FORTRESS"]
   *   ]
   * }
   * // Returns: true if structure is a military building
   * ```
   *
   * @private
   */
  private createTypeOperator(): CustomOperator {
    return {
      name: 'structure.type',
      description: 'Get structure type',
      implementation: async (...args: unknown[]): Promise<string | undefined> => {
        const structureId = args[0] as string | undefined;
        const structure = await this.getStructure(structureId);
        return structure?.type;
      },
    };
  }

  /**
   * Creates the `structure.var` operator for accessing typed variable values.
   *
   * @description Retrieves custom data stored in a structure's typed variables.
   * Typed variables allow structures to store arbitrary data with defined types
   * (e.g., defense rating, morale, resource production). Returns undefined if
   * the variable doesn't exist, the structure is not found, or if no variable
   * name is provided.
   *
   * @returns {CustomOperator} Operator implementation
   *
   * @example Access Variable on Context Structure
   * ```typescript
   * { "structure.var": ["defenseRating"] }
   * // Returns: 75 (if context structure has defenseRating=75)
   * ```
   *
   * @example Access Variable on Specific Structure
   * ```typescript
   * { "structure.var": ["defenseRating", "structure-123"] }
   * // Returns: 50 (if structure-123 has defenseRating=50)
   * ```
   *
   * @example Compare Variable Value
   * ```typescript
   * {
   *   ">": [
   *     { "structure.var": ["morale"] },
   *     80
   *   ]
   * }
   * // Returns: true if structure morale is above 80
   * ```
   *
   * @example Check Variable Existence
   * ```typescript
   * {
   *   "!=": [
   *     { "structure.var": ["upgradedAt"] },
   *     null
   *   ]
   * }
   * // Returns: true if structure has been upgraded
   * ```
   *
   * @example Complex Resource Calculation
   * ```typescript
   * {
   *   "*": [
   *     { "structure.var": ["productionRate"] },
   *     { "structure.level": [] }
   *   ]
   * }
   * // Returns: total production (rate × level)
   * ```
   *
   * @private
   */
  private createVarOperator(): CustomOperator {
    return {
      name: 'structure.var',
      description: 'Get structure typed variable value',
      implementation: async (...args: unknown[]): Promise<unknown> => {
        const varName = args[0] as string;
        const structureId = args[1] as string | undefined;

        if (!varName) {
          return undefined;
        }

        const structure = await this.getStructure(structureId);
        return structure?.variables[varName];
      },
    };
  }

  /**
   * Creates the `structure.isOperational` operator for checking operational status.
   *
   * @description Checks whether a structure is currently operational. Non-operational
   * structures may be under construction, damaged, destroyed, or temporarily disabled.
   * Returns false if the structure is not found or if no structure ID is provided.
   *
   * @returns {CustomOperator} Operator implementation
   *
   * @example Check Context Structure
   * ```typescript
   * { "structure.isOperational": [] }
   * // Returns: true (if context structure is operational)
   * ```
   *
   * @example Check Specific Structure
   * ```typescript
   * { "structure.isOperational": ["structure-123"] }
   * // Returns: false (if structure-123 is under construction)
   * ```
   *
   * @example Conditional Logic
   * ```typescript
   * {
   *   "if": [
   *     { "structure.isOperational": [] },
   *     { "structure.var": ["productionRate"] },
   *     0
   *   ]
   * }
   * // Returns: production rate if operational, 0 otherwise
   * ```
   *
   * @example Require Operational Status
   * ```typescript
   * {
   *   "and": [
   *     { "structure.isOperational": [] },
   *     {
   *       ">=": [
   *         { "structure.level": [] },
   *         3
   *       ]
   *     }
   *   ]
   * }
   * // Returns: true if structure is operational AND level 3+
   * ```
   *
   * @private
   */
  private createIsOperationalOperator(): CustomOperator {
    return {
      name: 'structure.isOperational',
      description: 'Check if structure is operational',
      implementation: async (...args: unknown[]): Promise<boolean> => {
        const structureId = args[0] as string | undefined;
        const structure = await this.getStructure(structureId);
        return structure?.operational ?? false;
      },
    };
  }

  /**
   * Creates the `structure.inSettlement` operator for checking settlement membership.
   *
   * @description Checks whether a structure belongs to a specific settlement. This is
   * useful for settlement-wide rules, production bonuses, or effects that depend on
   * settlement composition. Returns false if the structure doesn't belong to the
   * specified settlement, if the structure is not found, or if no settlement ID is provided.
   *
   * @returns {CustomOperator} Operator implementation
   *
   * @example Check Context Structure in Settlement
   * ```typescript
   * { "structure.inSettlement": ["settlement-456"] }
   * // Returns: true (if context structure belongs to settlement-456)
   * ```
   *
   * @example Check Specific Structure in Settlement
   * ```typescript
   * { "structure.inSettlement": ["settlement-456", "structure-123"] }
   * // Returns: false (if structure-123 doesn't belong to settlement-456)
   * ```
   *
   * @example Settlement-Wide Bonus Condition
   * ```typescript
   * {
   *   "and": [
   *     { "structure.inSettlement": ["settlement-capital"] },
   *     {
   *       "===": [
   *         { "structure.type": [] },
   *         "TEMPLE"
   *       ]
   *     }
   *   ]
   * }
   * // Returns: true if structure is a temple in the capital settlement
   * ```
   *
   * @example Cross-Settlement Comparison
   * ```typescript
   * {
   *   "!": [
   *     { "structure.inSettlement": ["settlement-border"] }
   *   ]
   * }
   * // Returns: true if structure is NOT in the border settlement
   * ```
   *
   * @private
   */
  private createInSettlementOperator(): CustomOperator {
    return {
      name: 'structure.inSettlement',
      description: 'Check if structure belongs to specific settlement',
      implementation: async (...args: unknown[]): Promise<boolean> => {
        const settlementId = args[0] as string;
        const structureId = args[1] as string | undefined;

        if (!settlementId) {
          return false;
        }

        const structure = await this.getStructure(structureId);
        return structure?.settlementId === settlementId;
      },
    };
  }

  /**
   * Retrieves structure context for operator evaluation.
   *
   * @description Fetches the structure context data required for operator evaluation.
   * If a structure ID is provided, loads that specific structure. If no ID is provided,
   * returns undefined (in the full implementation, this would come from the evaluation
   * context's current structure). Handles errors gracefully by returning undefined for
   * missing or deleted structures.
   *
   * @param {string} [structureId] - Optional structure ID to load. If omitted, would use context structure
   * @returns {Promise<StructureRulesContext | undefined>} Structure context data or undefined if not found
   *
   * @private
   */
  private async getStructure(structureId?: string): Promise<StructureRulesContext | undefined> {
    if (!structureId) {
      // In full implementation, would get from evaluation context
      // For now, return undefined to indicate missing context
      return undefined;
    }

    try {
      return await this.structureContextBuilder.buildContext(structureId);
    } catch {
      // Structure not found or deleted
      return undefined;
    }
  }
}
