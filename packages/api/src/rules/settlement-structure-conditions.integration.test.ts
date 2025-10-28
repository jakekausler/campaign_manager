/**
 * Settlement & Structure Condition Examples - Integration Tests
 *
 * This test suite demonstrates real-world Settlement and Structure condition
 * examples using custom JSONLogic operators. These examples serve both as
 * documentation and as verification that the operators work correctly in
 * realistic scenarios.
 *
 * Part of TICKET-037 Stage 5.
 */

import { Test, TestingModule } from '@nestjs/testing';
import * as jsonLogic from 'json-logic-js';

import type { SettlementRulesContext } from '../graphql/services/settlement-context-builder.service';
import { SettlementContextBuilderService } from '../graphql/services/settlement-context-builder.service';
import type { StructureRulesContext } from '../graphql/services/structure-context-builder.service';
import { StructureContextBuilderService } from '../graphql/services/structure-context-builder.service';

import { OperatorRegistry } from './operator-registry';
import { SettlementOperatorsService } from './operators/settlement-operators.service';
import { StructureOperatorsService } from './operators/structure-operators.service';

// Helper type for JSONLogic conditions with custom operators
// JSONLogic conditions can be primitives, arrays, or objects with operator keys
type JSONLogicCondition =
  | string
  | number
  | boolean
  | null
  | JSONLogicCondition[]
  | { [key: string]: JSONLogicCondition };

// Global operator registry reference for applyAsync helper
let operatorRegistry: OperatorRegistry;

/**
 * Helper function to apply async JSONLogic conditions
 * JSONLogic doesn't natively support async operations, so we need to:
 * 1. Pre-process the condition tree to evaluate all custom operators
 * 2. Apply the resolved condition tree to JSONLogic
 */
async function applyAsync(condition: JSONLogicCondition, data: unknown): Promise<unknown> {
  // Pre-process the condition to resolve all custom operator calls
  async function preprocessCondition(node: JSONLogicCondition): Promise<JSONLogicCondition> {
    if (node === null || node === undefined) {
      return node;
    }

    // If it's an array, process each element
    if (Array.isArray(node)) {
      return await Promise.all(node.map((item) => preprocessCondition(item)));
    }

    // If it's an object, check if it's a custom operator call
    if (typeof node === 'object') {
      const keys = Object.keys(node);

      // Check if this is a custom operator (settlement.* or structure.*)
      if (
        keys.length === 1 &&
        (keys[0].startsWith('settlement.') || keys[0].startsWith('structure.'))
      ) {
        const operatorName = keys[0];
        const args = node[operatorName];

        // Get the operator from the registry
        const operator = operatorRegistry.get(operatorName);
        if (operator) {
          // Call the operator with the args and await the result
          const argsArray = Array.isArray(args) ? args : [args];
          const result = await operator.implementation(...argsArray);
          return result as JSONLogicCondition;
        }
      }

      // Otherwise, recursively process all values
      const processed: { [key: string]: JSONLogicCondition } = {};
      for (const key of keys) {
        processed[key] = await preprocessCondition(node[key]);
      }
      return processed;
    }

    // Return primitive values as-is
    return node;
  }

  // Preprocess the condition to resolve all async operators
  const processedCondition = await preprocessCondition(condition);

  // Now apply the fully-resolved condition with standard JSONLogic
  // eslint-disable-next-line import/no-named-as-default-member
  return jsonLogic.apply(processedCondition, data);
}

describe('Settlement & Structure Condition Examples (Integration)', () => {
  let settlementOperators: SettlementOperatorsService;
  let structureOperators: StructureOperatorsService;

  // Mock settlement context - a thriving level 5 settlement with multiple structures
  const thrivingSettlement: SettlementRulesContext = {
    id: 'settlement-001',
    name: 'Riverside',
    level: 5,
    kingdomId: 'kingdom-001',
    locationId: 'location-001',
    variables: {
      population: 8500,
      prosperity: 'thriving',
      defenseRating: 7,
      tradeIncome: 1200,
    },
    structures: {
      count: 12,
      byType: {
        temple: 2,
        barracks: 1,
        market: 3,
        library: 1,
        forge: 2,
        tavern: 3,
      },
      averageLevel: 4.2,
    },
  };

  // Mock settlement context - a small struggling settlement
  const strugglingSettlement: SettlementRulesContext = {
    id: 'settlement-002',
    name: 'Dustville',
    level: 2,
    kingdomId: 'kingdom-001',
    locationId: 'location-002',
    variables: {
      population: 500,
      prosperity: 'struggling',
      defenseRating: 2,
      tradeIncome: 50,
    },
    structures: {
      count: 3,
      byType: {
        tavern: 1,
        market: 1,
        temple: 1,
      },
      averageLevel: 1.3,
    },
  };

  // Mock structure contexts
  const operationalTemple: StructureRulesContext = {
    id: 'structure-001',
    name: 'Temple of Light',
    type: 'temple',
    level: 5,
    settlementId: 'settlement-001',
    variables: {
      integrity: 95,
      holiness: 'high',
      priestCount: 12,
    },
    operational: true,
  };

  const damagedBarracks: StructureRulesContext = {
    id: 'structure-002',
    name: 'Old Barracks',
    type: 'barracks',
    level: 2,
    settlementId: 'settlement-001',
    variables: {
      integrity: 45,
      soldierCount: 8,
      trainingQuality: 'poor',
    },
    operational: false,
  };

  const flourishingMarket: StructureRulesContext = {
    id: 'structure-003',
    name: 'Grand Market',
    type: 'market',
    level: 4,
    settlementId: 'settlement-001',
    variables: {
      integrity: 90,
      merchantCount: 25,
      dailyRevenue: 450,
    },
    operational: true,
  };

  beforeAll(async () => {
    const mockSettlementContextBuilder = {
      buildContext: jest.fn((id: string) => {
        if (id === 'settlement-001') return Promise.resolve(thrivingSettlement);
        if (id === 'settlement-002') return Promise.resolve(strugglingSettlement);
        return Promise.reject(new Error(`Settlement ${id} not found`));
      }),
    };

    const mockStructureContextBuilder = {
      buildContext: jest.fn((id: string) => {
        if (id === 'structure-001') return Promise.resolve(operationalTemple);
        if (id === 'structure-002') return Promise.resolve(damagedBarracks);
        if (id === 'structure-003') return Promise.resolve(flourishingMarket);
        return Promise.reject(new Error(`Structure ${id} not found`));
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementOperatorsService,
        StructureOperatorsService,
        OperatorRegistry,
        {
          provide: SettlementContextBuilderService,
          useValue: mockSettlementContextBuilder,
        },
        {
          provide: StructureContextBuilderService,
          useValue: mockStructureContextBuilder,
        },
      ],
    }).compile();

    settlementOperators = module.get<SettlementOperatorsService>(SettlementOperatorsService);
    structureOperators = module.get<StructureOperatorsService>(StructureOperatorsService);
    operatorRegistry = module.get<OperatorRegistry>(OperatorRegistry);

    // Register all operators
    settlementOperators.registerOperators();
    structureOperators.registerOperators();

    // Install operators into jsonLogic
    for (const operator of operatorRegistry.getAll()) {
      // eslint-disable-next-line import/no-named-as-default-member
      jsonLogic.add_operation(operator.name, operator.implementation);
    }
  });

  afterAll(() => {
    operatorRegistry.clear();
  });

  describe('Settlement Condition Examples', () => {
    describe('Example 1: Settlement Level Threshold', () => {
      it('should check if settlement is level 5 or higher', async () => {
        // Condition: settlement.level >= 5
        const condition: JSONLogicCondition = {
          '>=': [{ 'settlement.level': ['settlement-001'] }, 5],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(true);
      });

      it('should reject settlement below level 5', async () => {
        const condition: JSONLogicCondition = {
          '>=': [{ 'settlement.level': ['settlement-002'] }, 5],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(false);
      });
    });

    describe('Example 2: Settlement Population Requirements', () => {
      it('should check if population exceeds 10000', async () => {
        // Condition: settlement.var('population') > 10000
        const condition: JSONLogicCondition = {
          '>': [{ 'settlement.var': ['population', 'settlement-001'] }, 10000],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(false); // Riverside has 8500
      });

      it('should detect large population settlements', async () => {
        const condition: JSONLogicCondition = {
          '>': [{ 'settlement.var': ['population', 'settlement-001'] }, 5000],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(true); // Riverside has 8500
      });
    });

    describe('Example 3: Settlement Structure Composition', () => {
      it('should verify settlement has both temple and market', async () => {
        // Condition: settlement has temple AND market
        const condition: JSONLogicCondition = {
          and: [
            { 'settlement.hasStructureType': ['temple', 'settlement-001'] },
            { 'settlement.hasStructureType': ['market', 'settlement-001'] },
          ],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(true);
      });

      it('should detect missing structure types', async () => {
        const condition: JSONLogicCondition = {
          'settlement.hasStructureType': ['library', 'settlement-002'],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(false); // Dustville has no library
      });

      it('should count structures of specific type', async () => {
        // Condition: settlement has at least 2 temples
        const condition: JSONLogicCondition = {
          '>=': [{ 'settlement.structureCount': ['temple', 'settlement-001'] }, 2],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(true); // Riverside has 2 temples
      });
    });

    describe('Example 4: Settlement Prosperity Check', () => {
      it('should identify thriving settlements with good defenses', async () => {
        // Condition: prosperity == 'thriving' AND defenseRating >= 7
        const condition: JSONLogicCondition = {
          and: [
            { '==': [{ 'settlement.var': ['prosperity', 'settlement-001'] }, 'thriving'] },
            { '>=': [{ 'settlement.var': ['defenseRating', 'settlement-001'] }, 7] },
          ],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(true);
      });

      it('should reject struggling settlements', async () => {
        const condition: JSONLogicCondition = {
          '==': [{ 'settlement.var': ['prosperity', 'settlement-002'] }, 'thriving'],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(false);
      });
    });

    describe('Example 5: Complex Combined Condition', () => {
      it('should identify well-defended trade hubs', async () => {
        // Complex condition: Large, thriving settlement with strong defenses and commerce
        const condition: JSONLogicCondition = {
          and: [
            // Level 5+
            { '>=': [{ 'settlement.level': ['settlement-001'] }, 5] },
            // Thriving economy
            { '==': [{ 'settlement.var': ['prosperity', 'settlement-001'] }, 'thriving'] },
            // Good defenses
            { '>=': [{ 'settlement.var': ['defenseRating', 'settlement-001'] }, 7] },
            // Has military presence
            { 'settlement.hasStructureType': ['barracks', 'settlement-001'] },
            // Multiple markets for trade
            { '>=': [{ 'settlement.structureCount': ['market', 'settlement-001'] }, 2] },
          ],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(true); // Riverside meets all criteria
      });
    });
  });

  describe('Structure Condition Examples', () => {
    describe('Example 1: Structure Level Requirements', () => {
      it('should check if structure is level 3 or higher', async () => {
        // Condition: structure.level >= 3
        const condition: JSONLogicCondition = {
          '>=': [{ 'structure.level': ['structure-001'] }, 3],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(true); // Temple is level 5
      });

      it('should reject low-level structures', async () => {
        const condition: JSONLogicCondition = {
          '>=': [{ 'structure.level': ['structure-002'] }, 3],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(false); // Barracks is level 2
      });
    });

    describe('Example 2: Structure Type Checks', () => {
      it('should identify temple structures', async () => {
        // Condition: structure.type == 'temple'
        const condition: JSONLogicCondition = {
          '==': [{ 'structure.type': ['structure-001'] }, 'temple'],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(true);
      });

      it('should distinguish between structure types', async () => {
        const condition: JSONLogicCondition = {
          '==': [{ 'structure.type': ['structure-003'] }, 'temple'],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(false); // Grand Market is not a temple
      });
    });

    describe('Example 3: Structure Operational Status', () => {
      it('should detect operational structures', async () => {
        // Condition: structure.isOperational
        const condition: JSONLogicCondition = {
          'structure.isOperational': ['structure-001'],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(true); // Temple is operational
      });

      it('should detect non-operational structures', async () => {
        const condition: JSONLogicCondition = {
          'structure.isOperational': ['structure-002'],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(false); // Old Barracks is not operational
      });
    });

    describe('Example 4: Structure Integrity Thresholds', () => {
      it('should check if structure integrity is above 80%', async () => {
        // Condition: structure.var('integrity') > 80
        const condition: JSONLogicCondition = {
          '>': [{ 'structure.var': ['integrity', 'structure-001'] }, 80],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(true); // Temple has 95% integrity
      });

      it('should detect damaged structures', async () => {
        const condition: JSONLogicCondition = {
          '<': [{ 'structure.var': ['integrity', 'structure-002'] }, 50],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(true); // Barracks has 45% integrity
      });
    });

    describe('Example 5: Complex Structure Conditions', () => {
      it('should identify high-quality operational temples', async () => {
        // Complex condition: Operational high-level temple with good integrity
        const condition: JSONLogicCondition = {
          and: [
            // Is a temple
            { '==': [{ 'structure.type': ['structure-001'] }, 'temple'] },
            // Level 5+
            { '>=': [{ 'structure.level': ['structure-001'] }, 5] },
            // Operational
            { 'structure.isOperational': ['structure-001'] },
            // High integrity
            { '>': [{ 'structure.var': ['integrity', 'structure-001'] }, 90] },
          ],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(true); // Temple of Light meets all criteria
      });

      it('should detect structures needing repair', async () => {
        // Condition: Low integrity OR not operational
        const condition: JSONLogicCondition = {
          or: [
            { '<': [{ 'structure.var': ['integrity', 'structure-002'] }, 50] },
            { '!': { 'structure.isOperational': ['structure-002'] } },
          ],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(true); // Old Barracks needs attention
      });

      it('should identify profitable market structures', async () => {
        // Condition: Market with good revenue and operational
        const condition: JSONLogicCondition = {
          and: [
            { '==': [{ 'structure.type': ['structure-003'] }, 'market'] },
            { 'structure.isOperational': ['structure-003'] },
            { '>': [{ 'structure.var': ['dailyRevenue', 'structure-003'] }, 400] },
          ],
        };

        const result = await applyAsync(condition, {});

        expect(result).toBe(true); // Grand Market generates 450/day
      });
    });
  });

  describe('Cross-Entity Condition Examples', () => {
    it('should check settlement and its structures together', async () => {
      // Condition: Settlement is thriving AND has operational high-level temple
      const condition: JSONLogicCondition = {
        and: [
          // Settlement criteria
          { '>=': [{ 'settlement.level': ['settlement-001'] }, 5] },
          { '==': [{ 'settlement.var': ['prosperity', 'settlement-001'] }, 'thriving'] },
          // Structure criteria (temple)
          { 'settlement.hasStructureType': ['temple', 'settlement-001'] },
          // Assuming we can query specific structure operational status
          { 'structure.isOperational': ['structure-001'] },
        ],
      };

      const result = await applyAsync(condition, {});

      expect(result).toBe(true);
    });
  });
});
