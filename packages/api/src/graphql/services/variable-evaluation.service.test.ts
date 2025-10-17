/**
 * Variable Evaluation Service Tests
 * Comprehensive unit tests for StateVariable evaluation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { StateVariable } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { ExpressionParserService } from '../../rules/expression-parser.service';
import { VariableScope } from '../types/state-variable.type';

import { VariableEvaluationService } from './variable-evaluation.service';

describe('VariableEvaluationService', () => {
  let service: VariableEvaluationService;

  // Mock Prisma service
  const mockPrisma = {
    campaign: { findUnique: jest.fn() },
    party: { findUnique: jest.fn() },
    kingdom: { findUnique: jest.fn() },
    settlement: { findUnique: jest.fn() },
    structure: { findUnique: jest.fn() },
    character: { findUnique: jest.fn() },
    location: { findUnique: jest.fn() },
    event: { findUnique: jest.fn() },
    encounter: { findUnique: jest.fn() },
  };

  // Mock Expression Parser service
  const mockExpressionParser = {
    evaluate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VariableEvaluationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ExpressionParserService, useValue: mockExpressionParser },
      ],
    }).compile();

    service = module.get<VariableEvaluationService>(VariableEvaluationService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('evaluateVariable', () => {
    it('should return stored value for non-derived string variable', async () => {
      const variable: StateVariable = {
        id: 'var-1',
        scope: 'settlement',
        scopeId: 'settlement-1',
        key: 'name',
        value: 'Rivertown',
        type: 'string',
        formula: null,
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      const result = await service.evaluateVariable(variable);

      expect(result.success).toBe(true);
      expect(result.value).toBe('Rivertown');
      expect(result.error).toBeUndefined();
    });

    it('should return stored value for non-derived integer variable', async () => {
      const variable: StateVariable = {
        id: 'var-2',
        scope: 'settlement',
        scopeId: 'settlement-1',
        key: 'population',
        value: 5000,
        type: 'integer',
        formula: null,
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      const result = await service.evaluateVariable(variable);

      expect(result.success).toBe(true);
      expect(result.value).toBe(5000);
    });

    it('should return stored value for non-derived boolean variable', async () => {
      const variable: StateVariable = {
        id: 'var-3',
        scope: 'structure',
        scopeId: 'structure-1',
        key: 'is_operational',
        value: true,
        type: 'boolean',
        formula: null,
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      const result = await service.evaluateVariable(variable);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should return error for derived variable without formula', async () => {
      const variable: StateVariable = {
        id: 'var-4',
        scope: 'settlement',
        scopeId: 'settlement-1',
        key: 'prosperity_level',
        value: null,
        type: 'derived',
        formula: null,
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      const result = await service.evaluateVariable(variable);

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.error).toBe('Derived variable missing formula');
    });

    it('should evaluate derived variable with formula', async () => {
      const variable: StateVariable = {
        id: 'var-5',
        scope: 'settlement',
        scopeId: 'settlement-1',
        key: 'prosperity_level',
        value: null,
        type: 'derived',
        formula: { '>': [{ var: 'settlement.population' }, 5000] },
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      mockPrisma.settlement.findUnique.mockResolvedValue({
        id: 'settlement-1',
        population: 6000,
      });

      mockExpressionParser.evaluate.mockReturnValue({
        success: true,
        value: true,
      });

      const result = await service.evaluateVariable(variable);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
      expect(mockPrisma.settlement.findUnique).toHaveBeenCalledWith({
        where: { id: 'settlement-1' },
      });
    });

    it('should handle expression parser evaluation failure', async () => {
      const variable: StateVariable = {
        id: 'var-6',
        scope: 'settlement',
        scopeId: 'settlement-1',
        key: 'test',
        value: null,
        type: 'derived',
        formula: { '>': [{ var: 'settlement.population' }, 5000] },
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      mockPrisma.settlement.findUnique.mockResolvedValue({ id: 'settlement-1' });
      mockExpressionParser.evaluate.mockReturnValue({
        success: false,
        value: null,
        error: 'Invalid operator',
      });

      const result = await service.evaluateVariable(variable);

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.error).toBe('Invalid operator');
    });
  });

  describe('evaluateWithTrace', () => {
    it('should return trace for non-derived variable', async () => {
      const variable: StateVariable = {
        id: 'var-7',
        scope: 'settlement',
        scopeId: 'settlement-1',
        key: 'name',
        value: 'Rivertown',
        type: 'string',
        formula: null,
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      const result = await service.evaluateWithTrace(variable);

      expect(result.success).toBe(true);
      expect(result.value).toBe('Rivertown');
      expect(result.trace).toBeDefined();
      expect(result.trace?.length).toBeGreaterThan(0);
      expect(result.trace?.[0].step).toBe('Start evaluation');
      expect(result.trace?.[1].step).toBe('Return stored value');
    });

    it('should return trace with formula validation failure', async () => {
      const variable: StateVariable = {
        id: 'var-8',
        scope: 'settlement',
        scopeId: 'settlement-1',
        key: 'test',
        value: null,
        type: 'derived',
        formula: null,
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      const result = await service.evaluateWithTrace(variable);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Derived variable missing formula');
      expect(result.trace).toBeDefined();
      const validateStep = result.trace?.find((s) => s.step === 'Validate formula');
      expect(validateStep?.passed).toBe(false);
    });

    it('should return trace with formula evaluation', async () => {
      const variable: StateVariable = {
        id: 'var-9',
        scope: 'settlement',
        scopeId: 'settlement-1',
        key: 'is_large',
        value: null,
        type: 'derived',
        formula: { '>': [{ var: 'settlement.population' }, 5000] },
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      mockPrisma.settlement.findUnique.mockResolvedValue({
        id: 'settlement-1',
        population: 6000,
      });

      mockExpressionParser.evaluate.mockReturnValue({
        success: true,
        value: true,
      });

      const result = await service.evaluateWithTrace(variable);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
      expect(result.trace).toBeDefined();
      expect(result.trace?.some((s) => s.step === 'Validate formula structure')).toBe(true);
      expect(result.trace?.some((s) => s.step === 'Build evaluation context')).toBe(true);
      expect(result.trace?.some((s) => s.step === 'Evaluate formula')).toBe(true);
      expect(result.trace?.some((s) => s.step === 'Resolve variables')).toBe(true);
    });

    it('should include variable resolution in trace', async () => {
      const variable: StateVariable = {
        id: 'var-10',
        scope: 'settlement',
        scopeId: 'settlement-1',
        key: 'test',
        value: null,
        type: 'derived',
        formula: {
          and: [
            { '>': [{ var: 'settlement.population' }, 5000] },
            { '>=': [{ var: 'settlement.merchant_count' }, 10] },
          ],
        },
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      mockPrisma.settlement.findUnique.mockResolvedValue({
        id: 'settlement-1',
        population: 6000,
        merchant_count: 15,
      });

      mockExpressionParser.evaluate.mockReturnValue({
        success: true,
        value: true,
      });

      const result = await service.evaluateWithTrace(variable);

      const resolveStep = result.trace?.find((s) => s.step === 'Resolve variables');
      expect(resolveStep).toBeDefined();
      expect(resolveStep?.input).toContain('settlement.population');
      expect(resolveStep?.input).toContain('settlement.merchant_count');
    });
  });

  describe('buildEvaluationContext', () => {
    it('should return empty context for world scope', async () => {
      const context = await service.buildEvaluationContext(VariableScope.WORLD, null);

      expect(context).toEqual({});
      expect(mockPrisma.campaign.findUnique).not.toHaveBeenCalled();
    });

    it('should return additional context for world scope', async () => {
      const additionalContext = { custom_var: 'value' };
      const context = await service.buildEvaluationContext(
        VariableScope.WORLD,
        null,
        additionalContext
      );

      expect(context).toEqual(additionalContext);
    });

    it('should fetch campaign entity for campaign scope', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        id: 'campaign-1',
        name: 'Test Campaign',
      });

      const context = await service.buildEvaluationContext(VariableScope.CAMPAIGN, 'campaign-1');

      expect(mockPrisma.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
      });
      expect(context).toEqual({
        campaign: { id: 'campaign-1', name: 'Test Campaign' },
      });
    });

    it('should fetch settlement entity for settlement scope', async () => {
      mockPrisma.settlement.findUnique.mockResolvedValue({
        id: 'settlement-1',
        name: 'Rivertown',
        population: 5000,
      });

      const context = await service.buildEvaluationContext(
        VariableScope.SETTLEMENT,
        'settlement-1'
      );

      expect(mockPrisma.settlement.findUnique).toHaveBeenCalledWith({
        where: { id: 'settlement-1' },
      });
      expect(context).toEqual({
        settlement: { id: 'settlement-1', name: 'Rivertown', population: 5000 },
      });
    });

    it('should fetch structure entity for structure scope', async () => {
      mockPrisma.structure.findUnique.mockResolvedValue({
        id: 'structure-1',
        name: 'Watchtower',
        integrity: 85,
      });

      const context = await service.buildEvaluationContext(VariableScope.STRUCTURE, 'structure-1');

      expect(mockPrisma.structure.findUnique).toHaveBeenCalledWith({
        where: { id: 'structure-1' },
      });
      expect(context).toEqual({
        structure: { id: 'structure-1', name: 'Watchtower', integrity: 85 },
      });
    });

    it('should fetch party entity for party scope', async () => {
      mockPrisma.party.findUnique.mockResolvedValue({
        id: 'party-1',
        name: 'Adventurers Guild',
      });

      const context = await service.buildEvaluationContext(VariableScope.PARTY, 'party-1');

      expect(mockPrisma.party.findUnique).toHaveBeenCalledWith({
        where: { id: 'party-1' },
      });
      expect(context.party).toBeDefined();
    });

    it('should fetch kingdom entity for kingdom scope', async () => {
      mockPrisma.kingdom.findUnique.mockResolvedValue({
        id: 'kingdom-1',
        name: 'Northern Realm',
      });

      const context = await service.buildEvaluationContext(VariableScope.KINGDOM, 'kingdom-1');

      expect(mockPrisma.kingdom.findUnique).toHaveBeenCalledWith({
        where: { id: 'kingdom-1' },
      });
      expect(context.kingdom).toBeDefined();
    });

    it('should fetch character entity for character scope', async () => {
      mockPrisma.character.findUnique.mockResolvedValue({
        id: 'character-1',
        name: 'Hero',
      });

      const context = await service.buildEvaluationContext(VariableScope.CHARACTER, 'character-1');

      expect(mockPrisma.character.findUnique).toHaveBeenCalledWith({
        where: { id: 'character-1' },
      });
      expect(context.character).toBeDefined();
    });

    it('should fetch location entity for location scope', async () => {
      mockPrisma.location.findUnique.mockResolvedValue({
        id: 'location-1',
        name: 'Dark Forest',
      });

      const context = await service.buildEvaluationContext(VariableScope.LOCATION, 'location-1');

      expect(mockPrisma.location.findUnique).toHaveBeenCalledWith({
        where: { id: 'location-1' },
      });
      expect(context.location).toBeDefined();
    });

    it('should fetch event entity for event scope', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        name: 'Festival',
      });

      const context = await service.buildEvaluationContext(VariableScope.EVENT, 'event-1');

      expect(mockPrisma.event.findUnique).toHaveBeenCalledWith({
        where: { id: 'event-1' },
      });
      expect(context.event).toBeDefined();
    });

    it('should fetch encounter entity for encounter scope', async () => {
      mockPrisma.encounter.findUnique.mockResolvedValue({
        id: 'encounter-1',
        name: 'Bandit Ambush',
      });

      const context = await service.buildEvaluationContext(VariableScope.ENCOUNTER, 'encounter-1');

      expect(mockPrisma.encounter.findUnique).toHaveBeenCalledWith({
        where: { id: 'encounter-1' },
      });
      expect(context.encounter).toBeDefined();
    });

    it('should merge additional context', async () => {
      mockPrisma.settlement.findUnique.mockResolvedValue({
        id: 'settlement-1',
        population: 5000,
      });

      const additionalContext = { custom_var: 'test', override: 123 };
      const context = await service.buildEvaluationContext(
        VariableScope.SETTLEMENT,
        'settlement-1',
        additionalContext
      );

      expect(context.settlement).toBeDefined();
      expect(context.custom_var).toBe('test');
      expect(context.override).toBe(123);
    });

    it('should return empty context when scope entity not found', async () => {
      mockPrisma.settlement.findUnique.mockResolvedValue(null);

      const context = await service.buildEvaluationContext(
        VariableScope.SETTLEMENT,
        'settlement-1'
      );

      expect(context).toEqual({});
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.settlement.findUnique.mockRejectedValue(new Error('Database error'));

      const context = await service.buildEvaluationContext(
        VariableScope.SETTLEMENT,
        'settlement-1'
      );

      expect(context).toEqual({});
    });
  });

  describe('validateFormula', () => {
    it('should validate simple formula', () => {
      const formula = { '>': [{ var: 'population' }, 5000] };
      const result = service.validateFormula(formula);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate complex nested formula', () => {
      const formula = {
        and: [
          { '>': [{ var: 'population' }, 5000] },
          { '>=': [{ var: 'merchant_count' }, 10] },
          { in: ['trade_route', { var: 'tags' }] },
        ],
      };
      const result = service.validateFormula(formula);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null formula', () => {
      const result = service.validateFormula(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Formula cannot be null or undefined');
    });

    it('should reject undefined formula', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = service.validateFormula(undefined as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Formula cannot be null or undefined');
    });

    it('should reject array formula', () => {
      const result = service.validateFormula([1, 2, 3]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Formula must be a valid object');
    });

    it('should reject primitive formula', () => {
      const result = service.validateFormula('not an object');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Formula must be a valid object');
    });

    it('should reject empty object formula', () => {
      const result = service.validateFormula({});

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Formula must contain at least one operator');
    });

    it('should reject formula exceeding max depth', () => {
      // Create deeply nested formula (depth > 10)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let formula: any = { var: 'test' };
      for (let i = 0; i < 12; i++) {
        formula = { and: [formula] };
      }

      const result = service.validateFormula(formula);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('maximum depth'))).toBe(true);
    });

    it('should validate formula at max depth limit', () => {
      // Create formula at exactly max depth (10)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let formula: any = { var: 'test' };
      for (let i = 0; i < 9; i++) {
        formula = { and: [formula] };
      }

      const result = service.validateFormula(formula);

      expect(result.isValid).toBe(true);
    });

    it('should validate formula with arrays', () => {
      const formula = {
        in: ['value', { var: 'array_field' }],
      };

      const result = service.validateFormula(formula);

      expect(result.isValid).toBe(true);
    });

    it('should validate if-then-else formula', () => {
      const formula = {
        if: [
          { '>': [{ var: 'population' }, 10000] },
          'large',
          { '>': [{ var: 'population' }, 5000] },
          'medium',
          'small',
        ],
      };

      const result = service.validateFormula(formula);

      expect(result.isValid).toBe(true);
    });
  });
});
