/**
 * Settlement Operators Service Tests
 * Tests for custom JSONLogic operators for Settlement queries
 */

import { Test, TestingModule } from '@nestjs/testing';

import type { SettlementRulesContext } from '../../graphql/services/settlement-context-builder.service';
import { SettlementContextBuilderService } from '../../graphql/services/settlement-context-builder.service';
import { OperatorRegistry } from '../operator-registry';

import { SettlementOperatorsService } from './settlement-operators.service';

describe('SettlementOperatorsService', () => {
  let service: SettlementOperatorsService;
  let operatorRegistry: OperatorRegistry;
  let settlementContextBuilder: SettlementContextBuilderService;

  // Mock settlement context
  const mockSettlementContext: SettlementRulesContext = {
    id: 'settlement-123',
    name: 'Riverside',
    level: 5,
    kingdomId: 'kingdom-456',
    locationId: 'location-789',
    variables: {
      population: 8500,
      prosperity: 'thriving',
      defenseRating: 7,
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

  beforeEach(async () => {
    // Create mocks
    const mockContextBuilder = {
      buildContext: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementOperatorsService,
        OperatorRegistry,
        {
          provide: SettlementContextBuilderService,
          useValue: mockContextBuilder,
        },
      ],
    }).compile();

    service = module.get<SettlementOperatorsService>(SettlementOperatorsService);
    operatorRegistry = module.get<OperatorRegistry>(OperatorRegistry);
    settlementContextBuilder = module.get<SettlementContextBuilderService>(
      SettlementContextBuilderService
    );
  });

  afterEach(() => {
    // Clear registry between tests
    operatorRegistry.clear();
  });

  describe('registerOperators', () => {
    it('should register all 6 settlement operators', () => {
      service.registerOperators();

      expect(operatorRegistry.has('settlement.level')).toBe(true);
      expect(operatorRegistry.has('settlement.var')).toBe(true);
      expect(operatorRegistry.has('settlement.hasStructureType')).toBe(true);
      expect(operatorRegistry.has('settlement.structureCount')).toBe(true);
      expect(operatorRegistry.has('settlement.inKingdom')).toBe(true);
      expect(operatorRegistry.has('settlement.atLocation')).toBe(true);
    });

    it('should have descriptions for all operators', () => {
      service.registerOperators();

      const allOperators = operatorRegistry.getAll();
      expect(allOperators).toHaveLength(6);

      for (const operator of allOperators) {
        expect(operator.description).toBeDefined();
        expect(operator.description).not.toBe('');
      }
    });
  });

  describe('onModuleInit', () => {
    it('should register operators on module initialization', async () => {
      await service.onModuleInit();

      expect(operatorRegistry.getAll()).toHaveLength(6);
    });
  });

  describe('settlement.level operator', () => {
    beforeEach(() => {
      service.registerOperators();
    });

    it('should return settlement level with explicit ID', async () => {
      jest.spyOn(settlementContextBuilder, 'buildContext').mockResolvedValue(mockSettlementContext);

      const operator = operatorRegistry.get('settlement.level');
      expect(operator).toBeDefined();

      const result = await operator!.implementation('settlement-123');

      expect(result).toBe(5);
      expect(settlementContextBuilder.buildContext).toHaveBeenCalledWith('settlement-123');
    });

    it('should return 0 when settlement not found', async () => {
      jest
        .spyOn(settlementContextBuilder, 'buildContext')
        .mockRejectedValue(new Error('Not found'));

      const operator = operatorRegistry.get('settlement.level');
      const result = await operator!.implementation('nonexistent');

      expect(result).toBe(0);
    });

    it('should return 0 when no settlement ID provided', async () => {
      const operator = operatorRegistry.get('settlement.level');
      const result = await operator!.implementation();

      expect(result).toBe(0);
    });
  });

  describe('settlement.var operator', () => {
    beforeEach(() => {
      service.registerOperators();
    });

    it('should return variable value with explicit ID', async () => {
      jest.spyOn(settlementContextBuilder, 'buildContext').mockResolvedValue(mockSettlementContext);

      const operator = operatorRegistry.get('settlement.var');
      expect(operator).toBeDefined();

      const result = await operator!.implementation('population', 'settlement-123');

      expect(result).toBe(8500);
      expect(settlementContextBuilder.buildContext).toHaveBeenCalledWith('settlement-123');
    });

    it('should return string variable value', async () => {
      jest.spyOn(settlementContextBuilder, 'buildContext').mockResolvedValue(mockSettlementContext);

      const operator = operatorRegistry.get('settlement.var');
      const result = await operator!.implementation('prosperity', 'settlement-123');

      expect(result).toBe('thriving');
    });

    it('should return undefined for nonexistent variable', async () => {
      jest.spyOn(settlementContextBuilder, 'buildContext').mockResolvedValue(mockSettlementContext);

      const operator = operatorRegistry.get('settlement.var');
      const result = await operator!.implementation('nonexistent', 'settlement-123');

      expect(result).toBeUndefined();
    });

    it('should return undefined when no variable name provided', async () => {
      const operator = operatorRegistry.get('settlement.var');
      const result = await operator!.implementation('', 'settlement-123');

      expect(result).toBeUndefined();
    });

    it('should return undefined when settlement not found', async () => {
      jest
        .spyOn(settlementContextBuilder, 'buildContext')
        .mockRejectedValue(new Error('Not found'));

      const operator = operatorRegistry.get('settlement.var');
      const result = await operator!.implementation('population', 'nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('settlement.hasStructureType operator', () => {
    beforeEach(() => {
      service.registerOperators();
    });

    it('should return true when settlement has structure type', async () => {
      jest.spyOn(settlementContextBuilder, 'buildContext').mockResolvedValue(mockSettlementContext);

      const operator = operatorRegistry.get('settlement.hasStructureType');
      expect(operator).toBeDefined();

      const result = await operator!.implementation('temple', 'settlement-123');

      expect(result).toBe(true);
    });

    it('should return false when settlement does not have structure type', async () => {
      jest.spyOn(settlementContextBuilder, 'buildContext').mockResolvedValue(mockSettlementContext);

      const operator = operatorRegistry.get('settlement.hasStructureType');
      const result = await operator!.implementation('cathedral', 'settlement-123');

      expect(result).toBe(false);
    });

    it('should return false when no structure type provided', async () => {
      const operator = operatorRegistry.get('settlement.hasStructureType');
      const result = await operator!.implementation('', 'settlement-123');

      expect(result).toBe(false);
    });

    it('should return false when settlement not found', async () => {
      jest
        .spyOn(settlementContextBuilder, 'buildContext')
        .mockRejectedValue(new Error('Not found'));

      const operator = operatorRegistry.get('settlement.hasStructureType');
      const result = await operator!.implementation('temple', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('settlement.structureCount operator', () => {
    beforeEach(() => {
      service.registerOperators();
    });

    it('should return total structure count when no type specified', async () => {
      jest.spyOn(settlementContextBuilder, 'buildContext').mockResolvedValue(mockSettlementContext);

      const operator = operatorRegistry.get('settlement.structureCount');
      expect(operator).toBeDefined();

      const result = await operator!.implementation(undefined, 'settlement-123');

      expect(result).toBe(12);
    });

    it('should return count of specific structure type', async () => {
      jest.spyOn(settlementContextBuilder, 'buildContext').mockResolvedValue(mockSettlementContext);

      const operator = operatorRegistry.get('settlement.structureCount');

      const barracksCount = await operator!.implementation('barracks', 'settlement-123');
      expect(barracksCount).toBe(1);

      const marketCount = await operator!.implementation('market', 'settlement-123');
      expect(marketCount).toBe(3);
    });

    it('should return 0 for nonexistent structure type', async () => {
      jest.spyOn(settlementContextBuilder, 'buildContext').mockResolvedValue(mockSettlementContext);

      const operator = operatorRegistry.get('settlement.structureCount');
      const result = await operator!.implementation('cathedral', 'settlement-123');

      expect(result).toBe(0);
    });

    it('should return 0 when settlement not found', async () => {
      jest
        .spyOn(settlementContextBuilder, 'buildContext')
        .mockRejectedValue(new Error('Not found'));

      const operator = operatorRegistry.get('settlement.structureCount');
      const result = await operator!.implementation('temple', 'nonexistent');

      expect(result).toBe(0);
    });
  });

  describe('settlement.inKingdom operator', () => {
    beforeEach(() => {
      service.registerOperators();
    });

    it('should return true when settlement belongs to kingdom', async () => {
      jest.spyOn(settlementContextBuilder, 'buildContext').mockResolvedValue(mockSettlementContext);

      const operator = operatorRegistry.get('settlement.inKingdom');
      expect(operator).toBeDefined();

      const result = await operator!.implementation('kingdom-456', 'settlement-123');

      expect(result).toBe(true);
    });

    it('should return false when settlement belongs to different kingdom', async () => {
      jest.spyOn(settlementContextBuilder, 'buildContext').mockResolvedValue(mockSettlementContext);

      const operator = operatorRegistry.get('settlement.inKingdom');
      const result = await operator!.implementation('kingdom-999', 'settlement-123');

      expect(result).toBe(false);
    });

    it('should return false when no kingdom ID provided', async () => {
      const operator = operatorRegistry.get('settlement.inKingdom');
      const result = await operator!.implementation('', 'settlement-123');

      expect(result).toBe(false);
    });

    it('should return false when settlement not found', async () => {
      jest
        .spyOn(settlementContextBuilder, 'buildContext')
        .mockRejectedValue(new Error('Not found'));

      const operator = operatorRegistry.get('settlement.inKingdom');
      const result = await operator!.implementation('kingdom-456', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('settlement.atLocation operator', () => {
    beforeEach(() => {
      service.registerOperators();
    });

    it('should return true when settlement is at location', async () => {
      jest.spyOn(settlementContextBuilder, 'buildContext').mockResolvedValue(mockSettlementContext);

      const operator = operatorRegistry.get('settlement.atLocation');
      expect(operator).toBeDefined();

      const result = await operator!.implementation('location-789', 'settlement-123');

      expect(result).toBe(true);
    });

    it('should return false when settlement is at different location', async () => {
      jest.spyOn(settlementContextBuilder, 'buildContext').mockResolvedValue(mockSettlementContext);

      const operator = operatorRegistry.get('settlement.atLocation');
      const result = await operator!.implementation('location-999', 'settlement-123');

      expect(result).toBe(false);
    });

    it('should return false when no location ID provided', async () => {
      const operator = operatorRegistry.get('settlement.atLocation');
      const result = await operator!.implementation('', 'settlement-123');

      expect(result).toBe(false);
    });

    it('should return false when settlement not found', async () => {
      jest
        .spyOn(settlementContextBuilder, 'buildContext')
        .mockRejectedValue(new Error('Not found'));

      const operator = operatorRegistry.get('settlement.atLocation');
      const result = await operator!.implementation('location-789', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('operator implementations', () => {
    beforeEach(() => {
      service.registerOperators();
    });

    it('should all be async functions', () => {
      const operators = operatorRegistry.getAll();

      for (const operator of operators) {
        const result = operator.implementation();
        expect(result).toBeInstanceOf(Promise);
      }
    });
  });
});
