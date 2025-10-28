/**
 * Structure Operators Service
 * Registers custom JSONLogic operators for querying Structure entities
 * Enables rule expressions to access structure properties, variables, and operational status
 */

import { Injectable, OnModuleInit } from '@nestjs/common';

import type { StructureRulesContext } from '../../graphql/services/structure-context-builder.service';
import { StructureContextBuilderService } from '../../graphql/services/structure-context-builder.service';
import { OperatorRegistry } from '../operator-registry';
import type { CustomOperator } from '../types/expression.types';

@Injectable()
export class StructureOperatorsService implements OnModuleInit {
  constructor(
    private readonly operatorRegistry: OperatorRegistry,
    private readonly structureContextBuilder: StructureContextBuilderService
  ) {}

  /**
   * Register all structure operators on module initialization
   */
  async onModuleInit(): Promise<void> {
    this.registerOperators();
  }

  /**
   * Register all 5 structure custom operators
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
   * structure.level - Get structure level
   * Usage: { "structure.level": [] } or { "structure.level": ["structure-id"] }
   *
   * @returns Structure level (0 if structure not found)
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
   * structure.type - Get structure type
   * Usage: { "structure.type": [] } or { "structure.type": ["structure-id"] }
   *
   * @returns Structure type (undefined if structure not found)
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
   * structure.var - Get structure typed variable value
   * Usage: { "structure.var": ["variableName"] } or { "structure.var": ["variableName", "structure-id"] }
   *
   * @returns Variable value (undefined if not found)
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
   * structure.isOperational - Check if structure is operational
   * Usage: { "structure.isOperational": [] } or { "structure.isOperational": ["structure-id"] }
   *
   * @returns True if structure is operational
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
   * structure.inSettlement - Check if structure belongs to specific settlement
   * Usage: { "structure.inSettlement": ["settlement-id"] } or { "structure.inSettlement": ["settlement-id", "structure-id"] }
   *
   * @returns True if structure belongs to the settlement
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
   * Get structure context by ID
   * If no ID provided, returns undefined (would come from evaluation context in full implementation)
   *
   * @param structureId - Optional structure ID
   * @returns Structure context or undefined
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
