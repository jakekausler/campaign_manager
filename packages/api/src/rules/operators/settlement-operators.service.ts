/**
 * Settlement Operators Service
 * Registers custom JSONLogic operators for querying Settlement entities
 * Enables rule expressions to access settlement properties, variables, and structure stats
 */

import { Injectable, OnModuleInit } from '@nestjs/common';

import type { SettlementRulesContext } from '../../graphql/services/settlement-context-builder.service';
import { SettlementContextBuilderService } from '../../graphql/services/settlement-context-builder.service';
import { OperatorRegistry } from '../operator-registry';
import type { CustomOperator } from '../types/expression.types';

@Injectable()
export class SettlementOperatorsService implements OnModuleInit {
  constructor(
    private readonly operatorRegistry: OperatorRegistry,
    private readonly settlementContextBuilder: SettlementContextBuilderService
  ) {}

  /**
   * Register all settlement operators on module initialization
   */
  async onModuleInit(): Promise<void> {
    this.registerOperators();
  }

  /**
   * Register all 6 settlement custom operators
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
   * settlement.level - Get settlement level
   * Usage: { "settlement.level": [] } or { "settlement.level": ["settlement-id"] }
   *
   * @returns Settlement level (0 if settlement not found)
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
   * settlement.var - Get settlement typed variable value
   * Usage: { "settlement.var": ["variableName"] } or { "settlement.var": ["variableName", "settlement-id"] }
   *
   * @returns Variable value (undefined if not found)
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
   * settlement.hasStructureType - Check if settlement has structure of specific type
   * Usage: { "settlement.hasStructureType": ["temple"] } or { "settlement.hasStructureType": ["temple", "settlement-id"] }
   *
   * @returns True if settlement has at least one structure of the type
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
   * settlement.structureCount - Count structures (optionally filtered by type)
   * Usage: { "settlement.structureCount": [] } - total count
   *        { "settlement.structureCount": ["barracks"] } - count of specific type
   *        { "settlement.structureCount": ["barracks", "settlement-id"] } - with explicit ID
   *
   * @returns Number of structures (0 if settlement not found)
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
   * settlement.inKingdom - Check if settlement belongs to specific kingdom
   * Usage: { "settlement.inKingdom": ["kingdom-id"] } or { "settlement.inKingdom": ["kingdom-id", "settlement-id"] }
   *
   * @returns True if settlement belongs to the kingdom
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
   * settlement.atLocation - Check if settlement is at specific location
   * Usage: { "settlement.atLocation": ["location-id"] } or { "settlement.atLocation": ["location-id", "settlement-id"] }
   *
   * @returns True if settlement is at the location
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
   * Get settlement context by ID
   * If no ID provided, returns undefined (would come from evaluation context in full implementation)
   *
   * @param settlementId - Optional settlement ID
   * @returns Settlement context or undefined
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
