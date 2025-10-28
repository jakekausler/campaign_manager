/**
 * Structure Operators Service Tests
 * Tests for custom JSONLogic operators for Structure queries
 */

import { Test, TestingModule } from '@nestjs/testing';

import type { StructureRulesContext } from '../../graphql/services/structure-context-builder.service';
import { StructureContextBuilderService } from '../../graphql/services/structure-context-builder.service';
import { OperatorRegistry } from '../operator-registry';

import { StructureOperatorsService } from './structure-operators.service';

describe('StructureOperatorsService', () => {
  let service: StructureOperatorsService;
  let operatorRegistry: OperatorRegistry;
  let structureContextBuilder: StructureContextBuilderService;

  // Mock structure context
  const mockStructureContext: StructureRulesContext = {
    id: 'structure-456',
    name: 'Grand Temple',
    type: 'temple',
    level: 3,
    settlementId: 'settlement-123',
    variables: {
      integrity: 95,
      worshippers: 250,
      dedication: 'war',
    },
    operational: true,
  };

  beforeEach(async () => {
    // Create mocks
    const mockContextBuilder = {
      buildContext: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StructureOperatorsService,
        OperatorRegistry,
        {
          provide: StructureContextBuilderService,
          useValue: mockContextBuilder,
        },
      ],
    }).compile();

    service = module.get<StructureOperatorsService>(StructureOperatorsService);
    operatorRegistry = module.get<OperatorRegistry>(OperatorRegistry);
    structureContextBuilder = module.get<StructureContextBuilderService>(
      StructureContextBuilderService
    );
  });

  afterEach(() => {
    // Clear registry between tests
    operatorRegistry.clear();
  });

  describe('registerOperators', () => {
    it('should register all 5 structure operators', () => {
      service.registerOperators();

      expect(operatorRegistry.has('structure.level')).toBe(true);
      expect(operatorRegistry.has('structure.type')).toBe(true);
      expect(operatorRegistry.has('structure.var')).toBe(true);
      expect(operatorRegistry.has('structure.isOperational')).toBe(true);
      expect(operatorRegistry.has('structure.inSettlement')).toBe(true);
    });

    it('should have descriptions for all operators', () => {
      service.registerOperators();

      const allOperators = operatorRegistry.getAll();
      expect(allOperators).toHaveLength(5);

      for (const operator of allOperators) {
        expect(operator.description).toBeDefined();
        expect(operator.description).not.toBe('');
      }
    });
  });

  describe('onModuleInit', () => {
    it('should register operators on module initialization', async () => {
      await service.onModuleInit();

      expect(operatorRegistry.getAll()).toHaveLength(5);
    });
  });

  describe('structure.level operator', () => {
    beforeEach(() => {
      service.registerOperators();
    });

    it('should return structure level with explicit ID', async () => {
      jest.spyOn(structureContextBuilder, 'buildContext').mockResolvedValue(mockStructureContext);

      const operator = operatorRegistry.get('structure.level');
      expect(operator).toBeDefined();

      const result = await operator!.implementation('structure-456');

      expect(result).toBe(3);
      expect(structureContextBuilder.buildContext).toHaveBeenCalledWith('structure-456');
    });

    it('should return 0 when structure not found', async () => {
      jest.spyOn(structureContextBuilder, 'buildContext').mockRejectedValue(new Error('Not found'));

      const operator = operatorRegistry.get('structure.level');
      const result = await operator!.implementation('nonexistent');

      expect(result).toBe(0);
    });

    it('should return 0 when no structure ID provided', async () => {
      const operator = operatorRegistry.get('structure.level');
      const result = await operator!.implementation();

      expect(result).toBe(0);
    });
  });

  describe('structure.type operator', () => {
    beforeEach(() => {
      service.registerOperators();
    });

    it('should return structure type with explicit ID', async () => {
      jest.spyOn(structureContextBuilder, 'buildContext').mockResolvedValue(mockStructureContext);

      const operator = operatorRegistry.get('structure.type');
      expect(operator).toBeDefined();

      const result = await operator!.implementation('structure-456');

      expect(result).toBe('temple');
      expect(structureContextBuilder.buildContext).toHaveBeenCalledWith('structure-456');
    });

    it('should return undefined when structure not found', async () => {
      jest.spyOn(structureContextBuilder, 'buildContext').mockRejectedValue(new Error('Not found'));

      const operator = operatorRegistry.get('structure.type');
      const result = await operator!.implementation('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should return undefined when no structure ID provided', async () => {
      const operator = operatorRegistry.get('structure.type');
      const result = await operator!.implementation();

      expect(result).toBeUndefined();
    });
  });

  describe('structure.var operator', () => {
    beforeEach(() => {
      service.registerOperators();
    });

    it('should return variable value with explicit ID', async () => {
      jest.spyOn(structureContextBuilder, 'buildContext').mockResolvedValue(mockStructureContext);

      const operator = operatorRegistry.get('structure.var');
      expect(operator).toBeDefined();

      const result = await operator!.implementation('integrity', 'structure-456');

      expect(result).toBe(95);
      expect(structureContextBuilder.buildContext).toHaveBeenCalledWith('structure-456');
    });

    it('should return number variable value', async () => {
      jest.spyOn(structureContextBuilder, 'buildContext').mockResolvedValue(mockStructureContext);

      const operator = operatorRegistry.get('structure.var');
      const result = await operator!.implementation('worshippers', 'structure-456');

      expect(result).toBe(250);
    });

    it('should return string variable value', async () => {
      jest.spyOn(structureContextBuilder, 'buildContext').mockResolvedValue(mockStructureContext);

      const operator = operatorRegistry.get('structure.var');
      const result = await operator!.implementation('dedication', 'structure-456');

      expect(result).toBe('war');
    });

    it('should return undefined for nonexistent variable', async () => {
      jest.spyOn(structureContextBuilder, 'buildContext').mockResolvedValue(mockStructureContext);

      const operator = operatorRegistry.get('structure.var');
      const result = await operator!.implementation('nonexistent', 'structure-456');

      expect(result).toBeUndefined();
    });

    it('should return undefined when no variable name provided', async () => {
      const operator = operatorRegistry.get('structure.var');
      const result = await operator!.implementation('', 'structure-456');

      expect(result).toBeUndefined();
    });

    it('should return undefined when structure not found', async () => {
      jest.spyOn(structureContextBuilder, 'buildContext').mockRejectedValue(new Error('Not found'));

      const operator = operatorRegistry.get('structure.var');
      const result = await operator!.implementation('integrity', 'nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('structure.isOperational operator', () => {
    beforeEach(() => {
      service.registerOperators();
    });

    it('should return true when structure is operational', async () => {
      jest.spyOn(structureContextBuilder, 'buildContext').mockResolvedValue(mockStructureContext);

      const operator = operatorRegistry.get('structure.isOperational');
      expect(operator).toBeDefined();

      const result = await operator!.implementation('structure-456');

      expect(result).toBe(true);
    });

    it('should return false when structure is not operational', async () => {
      const nonOperationalStructure = { ...mockStructureContext, operational: false };
      jest
        .spyOn(structureContextBuilder, 'buildContext')
        .mockResolvedValue(nonOperationalStructure);

      const operator = operatorRegistry.get('structure.isOperational');
      const result = await operator!.implementation('structure-456');

      expect(result).toBe(false);
    });

    it('should return false when structure not found', async () => {
      jest.spyOn(structureContextBuilder, 'buildContext').mockRejectedValue(new Error('Not found'));

      const operator = operatorRegistry.get('structure.isOperational');
      const result = await operator!.implementation('nonexistent');

      expect(result).toBe(false);
    });

    it('should return false when no structure ID provided', async () => {
      const operator = operatorRegistry.get('structure.isOperational');
      const result = await operator!.implementation();

      expect(result).toBe(false);
    });
  });

  describe('structure.inSettlement operator', () => {
    beforeEach(() => {
      service.registerOperators();
    });

    it('should return true when structure belongs to settlement', async () => {
      jest.spyOn(structureContextBuilder, 'buildContext').mockResolvedValue(mockStructureContext);

      const operator = operatorRegistry.get('structure.inSettlement');
      expect(operator).toBeDefined();

      const result = await operator!.implementation('settlement-123', 'structure-456');

      expect(result).toBe(true);
    });

    it('should return false when structure belongs to different settlement', async () => {
      jest.spyOn(structureContextBuilder, 'buildContext').mockResolvedValue(mockStructureContext);

      const operator = operatorRegistry.get('structure.inSettlement');
      const result = await operator!.implementation('settlement-999', 'structure-456');

      expect(result).toBe(false);
    });

    it('should return false when no settlement ID provided', async () => {
      const operator = operatorRegistry.get('structure.inSettlement');
      const result = await operator!.implementation('', 'structure-456');

      expect(result).toBe(false);
    });

    it('should return false when structure not found', async () => {
      jest.spyOn(structureContextBuilder, 'buildContext').mockRejectedValue(new Error('Not found'));

      const operator = operatorRegistry.get('structure.inSettlement');
      const result = await operator!.implementation('settlement-123', 'nonexistent');

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
