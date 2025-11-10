/**
 * @fileoverview Settlement Operators Service
 *
 * Registers custom JSONLogic operators for querying Settlement entities in rule expressions.
 * Enables condition expressions to access settlement properties, variables, structure counts,
 * and relational data (kingdom membership, location).
 *
 * Provides operators for:
 * - Accessing settlement level and typed variables
 * - Querying structure presence and counts by type
 * - Checking kingdom membership and location relationships
 *
 * All operators support both explicit settlement ID or implicit context from evaluation.
 *
 * @module rules/operators
 */

import { Injectable, OnModuleInit } from '@nestjs/common';

import type { SettlementRulesContext } from '../../graphql/services/settlement-context-builder.service';
import { SettlementContextBuilderService } from '../../graphql/services/settlement-context-builder.service';
import { OperatorRegistry } from '../operator-registry';
import type { CustomOperator } from '../types/expression.types';

/**
 * Service for registering and managing custom JSONLogic operators specific to Settlement entities.
 *
 * Registers 6 custom operators on module initialization:
 * - `settlement.level` - Get settlement level
 * - `settlement.var` - Get typed variable value
 * - `settlement.hasStructureType` - Check structure type presence
 * - `settlement.structureCount` - Count structures by type
 * - `settlement.inKingdom` - Check kingdom membership
 * - `settlement.atLocation` - Check location relationship
 *
 * Each operator accepts an optional settlement ID as the last argument. If not provided,
 * the operator would use the settlement from the evaluation context (to be implemented).
 *
 * @example
 * // Check if settlement has reached level 3
 * { ">=": [{ "settlement.level": [] }, 3] }
 *
 * @example
 * // Check if settlement has a temple and population over 1000
 * { "and": [
 *   { "settlement.hasStructureType": ["temple"] },
 *   { ">": [{ "settlement.var": ["population"] }, 1000] }
 * ]}
 *
 * @example
 * // Count barracks in a specific settlement
 * { "settlement.structureCount": ["barracks", "settlement-123"] }
 */
@Injectable()
export class SettlementOperatorsService implements OnModuleInit {
  constructor(
    private readonly operatorRegistry: OperatorRegistry,
    private readonly settlementContextBuilder: SettlementContextBuilderService
  ) {}

  /**
   * Lifecycle hook that registers all settlement operators when the module initializes.
   *
   * Called automatically by NestJS during application bootstrap.
   * Ensures all custom operators are available before any rule evaluations occur.
   */
  async onModuleInit(): Promise<void> {
    this.registerOperators();
  }

  /**
   * Registers all settlement-specific custom operators with the operator registry.
   *
   * Creates and registers 6 operators:
   * - settlement.level
   * - settlement.var
   * - settlement.hasStructureType
   * - settlement.structureCount
   * - settlement.inKingdom
   * - settlement.atLocation
   *
   * Each operator is defined with a name, description, and async implementation function.
   */
  registerOperators(): void {
    const operators: CustomOperator[] = [
      this.createLevelOperator(),
      this.createVarOperator(),
      this.createHasStructureTypeOperator(),
      this.createStructureCountOperator(),
      this.createInKingdomOperator(),
      this.createAtLocationOperator(),
    ];

    for (const operator of operators) {
      this.operatorRegistry.register(operator);
    }
  }

  /**
   * Creates the `settlement.level` operator for accessing settlement level.
   *
   * Returns the current level of the settlement (typically 0-5 representing
   * village, town, city progression).
   *
   * @returns CustomOperator that returns settlement level
   *
   * @example
   * // Get level of settlement from context
   * { "settlement.level": [] }
   *
   * @example
   * // Get level of specific settlement
   * { "settlement.level": ["settlement-123"] }
   *
   * @example
   * // Check if settlement is at least level 3 (city)
   * { ">=": [{ "settlement.level": [] }, 3] }
   */
  private createLevelOperator(): CustomOperator {
    return {
      name: 'settlement.level',
      description: 'Get settlement level',
      implementation: async (...args: unknown[]): Promise<number> => {
        const settlementId = args[0] as string | undefined;
        const settlement = await this.getSettlement(settlementId);
        return settlement?.level ?? 0;
      },
    };
  }

  /**
   * Creates the `settlement.var` operator for accessing typed settlement variables.
   *
   * Retrieves values from the settlement's custom variables map. Variables are typed
   * (string, number, boolean) and can represent custom settlement properties like
   * population, wealth, reputation, etc.
   *
   * @returns CustomOperator that returns the variable value (any type) or undefined if not found
   *
   * @example
   * // Get population variable from settlement in context
   * { "settlement.var": ["population"] }
   *
   * @example
   * // Get wealth variable from specific settlement
   * { "settlement.var": ["wealth", "settlement-123"] }
   *
   * @example
   * // Check if settlement population exceeds 1000
   * { ">": [{ "settlement.var": ["population"] }, 1000] }
   *
   * @example
   * // Check if settlement has a specific flag set
   * { "==": [{ "settlement.var": ["isUnderSiege"] }, true] }
   */
  private createVarOperator(): CustomOperator {
    return {
      name: 'settlement.var',
      description: 'Get settlement typed variable value',
      implementation: async (...args: unknown[]): Promise<unknown> => {
        const varName = args[0] as string;
        const settlementId = args[1] as string | undefined;

        if (!varName) {
          return undefined;
        }

        const settlement = await this.getSettlement(settlementId);
        return settlement?.variables[varName];
      },
    };
  }

  /**
   * Creates the `settlement.hasStructureType` operator for checking structure type presence.
   *
   * Checks whether the settlement contains at least one structure of the specified type.
   * Uses precomputed structure statistics for efficient lookup.
   *
   * @returns CustomOperator that returns true if the structure type exists, false otherwise
   *
   * @example
   * // Check if settlement has a temple
   * { "settlement.hasStructureType": ["temple"] }
   *
   * @example
   * // Check if specific settlement has barracks
   * { "settlement.hasStructureType": ["barracks", "settlement-123"] }
   *
   * @example
   * // Check if settlement has both temple and market
   * { "and": [
   *   { "settlement.hasStructureType": ["temple"] },
   *   { "settlement.hasStructureType": ["market"] }
   * ]}
   */
  private createHasStructureTypeOperator(): CustomOperator {
    return {
      name: 'settlement.hasStructureType',
      description: 'Check if settlement has structure of specific type',
      implementation: async (...args: unknown[]): Promise<boolean> => {
        const structureType = args[0] as string;
        const settlementId = args[1] as string | undefined;

        if (!structureType) {
          return false;
        }

        const settlement = await this.getSettlement(settlementId);
        const count = settlement?.structures.byType[structureType] ?? 0;
        return count > 0;
      },
    };
  }

  /**
   * Creates the `settlement.structureCount` operator for counting structures.
   *
   * Returns the count of structures, either total count or filtered by specific type.
   * Uses precomputed structure statistics for efficient counting.
   *
   * @returns CustomOperator that returns the structure count (0 if settlement not found)
   *
   * @example
   * // Get total structure count from context settlement
   * { "settlement.structureCount": [] }
   *
   * @example
   * // Get count of barracks in context settlement
   * { "settlement.structureCount": ["barracks"] }
   *
   * @example
   * // Get count of temples in specific settlement
   * { "settlement.structureCount": ["temple", "settlement-123"] }
   *
   * @example
   * // Check if settlement has at least 3 barracks
   * { ">=": [{ "settlement.structureCount": ["barracks"] }, 3] }
   *
   * @example
   * // Check if settlement has more than 10 total structures
   * { ">": [{ "settlement.structureCount": [] }, 10] }
   */
  private createStructureCountOperator(): CustomOperator {
    return {
      name: 'settlement.structureCount',
      description: 'Count structures (optionally filtered by type)',
      implementation: async (...args: unknown[]): Promise<number> => {
        const structureType = args[0] as string | undefined;
        const settlementId = args[1] as string | undefined;

        const settlement = await this.getSettlement(settlementId);

        if (!settlement) {
          return 0;
        }

        // If structure type specified, return count of that type
        if (structureType) {
          return settlement.structures.byType[structureType] ?? 0;
        }

        // Otherwise return total count
        return settlement.structures.count;
      },
    };
  }

  /**
   * Creates the `settlement.inKingdom` operator for checking kingdom membership.
   *
   * Checks whether the settlement belongs to the specified kingdom by comparing
   * the settlement's kingdomId with the provided kingdom ID.
   *
   * @returns CustomOperator that returns true if settlement belongs to the kingdom, false otherwise
   *
   * @example
   * // Check if settlement belongs to specific kingdom
   * { "settlement.inKingdom": ["kingdom-123"] }
   *
   * @example
   * // Check if a different settlement belongs to the kingdom
   * { "settlement.inKingdom": ["kingdom-123", "settlement-456"] }
   *
   * @example
   * // Check if settlement is in player's kingdom
   * { "settlement.inKingdom": [{ "var": "playerKingdomId" }] }
   */
  private createInKingdomOperator(): CustomOperator {
    return {
      name: 'settlement.inKingdom',
      description: 'Check if settlement belongs to specific kingdom',
      implementation: async (...args: unknown[]): Promise<boolean> => {
        const kingdomId = args[0] as string;
        const settlementId = args[1] as string | undefined;

        if (!kingdomId) {
          return false;
        }

        const settlement = await this.getSettlement(settlementId);
        return settlement?.kingdomId === kingdomId;
      },
    };
  }

  /**
   * Creates the `settlement.atLocation` operator for checking location relationship.
   *
   * Checks whether the settlement is positioned at the specified location by comparing
   * the settlement's locationId with the provided location ID.
   *
   * @returns CustomOperator that returns true if settlement is at the location, false otherwise
   *
   * @example
   * // Check if settlement is at specific location
   * { "settlement.atLocation": ["location-123"] }
   *
   * @example
   * // Check if a different settlement is at the location
   * { "settlement.atLocation": ["location-123", "settlement-456"] }
   *
   * @example
   * // Check if settlement is at player's current location
   * { "settlement.atLocation": [{ "var": "playerLocationId" }] }
   */
  private createAtLocationOperator(): CustomOperator {
    return {
      name: 'settlement.atLocation',
      description: 'Check if settlement is at specific location',
      implementation: async (...args: unknown[]): Promise<boolean> => {
        const locationId = args[0] as string;
        const settlementId = args[1] as string | undefined;

        if (!locationId) {
          return false;
        }

        const settlement = await this.getSettlement(settlementId);
        return settlement?.locationId === locationId;
      },
    };
  }

  /**
   * Retrieves settlement context data for rule evaluation.
   *
   * If a settlement ID is provided, fetches the full settlement context including properties,
   * variables, structure statistics, and relational data. If no ID is provided, returns
   * undefined (in full implementation, would extract from evaluation context).
   *
   * @param settlementId - Optional UUID of the settlement to fetch
   * @returns Promise resolving to settlement context, or undefined if not found or no ID provided
   *
   * @remarks
   * - Returns undefined if no settlementId provided (context extraction to be implemented)
   * - Returns undefined if settlement not found or has been deleted
   * - Silently handles errors to avoid breaking rule evaluation
   *
   * @internal
   */
  private async getSettlement(settlementId?: string): Promise<SettlementRulesContext | undefined> {
    if (!settlementId) {
      // In full implementation, would get from evaluation context
      // For now, return undefined to indicate missing context
      return undefined;
    }

    try {
      return await this.settlementContextBuilder.buildContext(settlementId);
    } catch {
      // Settlement not found or deleted
      return undefined;
    }
  }
}
