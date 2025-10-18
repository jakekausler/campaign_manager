/**
 * Effect Resolver Tests
 * Integration tests for Effect GraphQL queries and mutations
 */

import type { Effect as PrismaEffect } from '@prisma/client';

import type { AuthenticatedUser } from '../context/graphql-context';
import type {
  CreateEffectInput,
  UpdateEffectInput,
  ExecuteEffectInput,
  ExecuteEffectsForEntityInput,
  EffectWhereInput,
  EffectOrderByInput,
} from '../inputs/effect.input';
import { EffectSortField } from '../inputs/effect.input';
import { SortOrder } from '../inputs/filter.input';
import type {
  EffectExecutionService,
  EffectExecutionResult as ServiceEffectExecutionResult,
  EffectExecutionSummary as ServiceEffectExecutionSummary,
} from '../services/effect-execution.service';
import type { EffectService } from '../services/effect.service';
import { EffectTiming } from '../types/effect.type';

import { EffectResolver } from './effect.resolver';

describe('EffectResolver', () => {
  let resolver: EffectResolver;
  let mockEffectService: jest.Mocked<EffectService>;
  let mockEffectExecutionService: jest.Mocked<EffectExecutionService>;
  let mockUser: AuthenticatedUser;

  beforeEach(() => {
    // Create mock EffectService
    mockEffectService = {
      create: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      findForEntity: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      toggleActive: jest.fn(),
    } as unknown as jest.Mocked<EffectService>;

    // Create mock EffectExecutionService
    mockEffectExecutionService = {
      executeEffect: jest.fn(),
      executeEffectsForEntity: jest.fn(),
    } as unknown as jest.Mocked<EffectExecutionService>;

    // Create resolver with mocks
    resolver = new EffectResolver(mockEffectService, mockEffectExecutionService);

    // Create mock user
    mockUser = {
      id: 'user-123',
      email: 'gm@example.com',
      role: 'gm',
    } as AuthenticatedUser;
  });

  // ============= Query Resolvers Tests =============

  describe('getEffect', () => {
    it('should return effect when found', async () => {
      const mockEffect: PrismaEffect = {
        id: 'effect-123',
        name: 'Increase Population',
        description: 'Increases settlement population',
        effectType: 'patch',
        payload: [{ op: 'replace', path: '/population', value: 1000 }] as any,
        entityType: 'encounter',
        entityId: 'encounter-456',
        timing: EffectTiming.ON_RESOLVE as any,
        priority: 0,
        isActive: true,
        version: 1,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      };

      mockEffectService.findById.mockResolvedValue(mockEffect);

      const result = await resolver.getEffect('effect-123', mockUser);

      expect(mockEffectService.findById).toHaveBeenCalledWith('effect-123', mockUser);
      expect(result).toEqual(mockEffect);
    });

    it('should return null when effect not found', async () => {
      mockEffectService.findById.mockResolvedValue(null);

      const result = await resolver.getEffect('nonexistent-id', mockUser);

      expect(mockEffectService.findById).toHaveBeenCalledWith('nonexistent-id', mockUser);
      expect(result).toBeNull();
    });
  });

  describe('listEffects', () => {
    it('should list effects without filters', async () => {
      const mockEffects: PrismaEffect[] = [
        {
          id: 'effect-1',
          name: 'Effect 1',
          description: null,
          effectType: 'patch',
          payload: [{ op: 'replace', path: '/field1', value: 'value1' }] as any,
          entityType: 'encounter',
          entityId: 'encounter-1',
          timing: EffectTiming.PRE as any,
          priority: 0,
          isActive: true,
          version: 1,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          deletedAt: null,
        },
        {
          id: 'effect-2',
          name: 'Effect 2',
          description: null,
          effectType: 'patch',
          payload: [{ op: 'replace', path: '/field2', value: 'value2' }] as any,
          entityType: 'event',
          entityId: 'event-1',
          timing: EffectTiming.POST as any,
          priority: 1,
          isActive: true,
          version: 1,
          createdAt: new Date('2025-01-02'),
          updatedAt: new Date('2025-01-02'),
          deletedAt: null,
        },
      ];

      mockEffectService.findMany.mockResolvedValue(mockEffects);

      const result = await resolver.listEffects(
        undefined,
        undefined,
        undefined,
        undefined,
        mockUser
      );

      expect(mockEffectService.findMany).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        undefined,
        mockUser
      );
      expect(result).toEqual(mockEffects);
    });

    it('should list effects with filters and pagination', async () => {
      const where: EffectWhereInput = {
        entityType: 'encounter',
        entityId: 'encounter-1',
        timing: EffectTiming.ON_RESOLVE as any,
        isActive: true,
      };
      const orderBy: EffectOrderByInput = {
        field: EffectSortField.PRIORITY,
        order: SortOrder.ASC,
      };

      mockEffectService.findMany.mockResolvedValue([]);

      await resolver.listEffects(where, orderBy, 0, 10, mockUser);

      expect(mockEffectService.findMany).toHaveBeenCalledWith(where, orderBy, 0, 10, mockUser);
    });
  });

  describe('getEffectsForEntity', () => {
    it('should get effects for specific entity and timing', async () => {
      const mockEffects: PrismaEffect[] = [
        {
          id: 'effect-1',
          name: 'Effect 1',
          description: null,
          effectType: 'patch',
          payload: [{ op: 'replace', path: '/field1', value: 'value1' }] as any,
          entityType: 'encounter',
          entityId: 'encounter-1',
          timing: EffectTiming.PRE as any,
          priority: 0,
          isActive: true,
          version: 1,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          deletedAt: null,
        },
      ];

      mockEffectService.findForEntity.mockResolvedValue(mockEffects);

      const result = await resolver.getEffectsForEntity(
        'encounter',
        'encounter-1',
        EffectTiming.PRE as any,
        mockUser
      );

      expect(mockEffectService.findForEntity).toHaveBeenCalledWith(
        'encounter',
        'encounter-1',
        EffectTiming.PRE as any,
        mockUser
      );
      expect(result).toEqual(mockEffects);
    });
  });

  // ============= Mutation Resolvers Tests =============

  describe('createEffect', () => {
    it('should create effect successfully', async () => {
      const input: CreateEffectInput = {
        name: 'Test Effect',
        description: 'Test description',
        effectType: 'patch',
        payload: { op: 'replace', path: '/field', value: 'value' },
        entityType: 'encounter',
        entityId: 'encounter-1',
        timing: EffectTiming.ON_RESOLVE as any,
        priority: 0,
      };

      const mockCreatedEffect: PrismaEffect = {
        id: 'effect-123',
        name: input.name,
        description: input.description ?? null,
        effectType: input.effectType,
        payload: input.payload as any,
        entityType: input.entityType,
        entityId: input.entityId,
        timing: input.timing as any,
        priority: input.priority ?? 0,
        isActive: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockEffectService.create.mockResolvedValue(mockCreatedEffect);

      const result = await resolver.createEffect(input, mockUser);

      expect(mockEffectService.create).toHaveBeenCalledWith(input, mockUser);
      expect(result).toEqual(mockCreatedEffect);
    });
  });

  describe('updateEffect', () => {
    it('should update effect successfully', async () => {
      const input: UpdateEffectInput = {
        name: 'Updated Effect',
        description: 'Updated description',
        expectedVersion: 1,
      };

      const mockUpdatedEffect: PrismaEffect = {
        id: 'effect-123',
        name: 'Updated Effect',
        description: 'Updated description',
        effectType: 'patch',
        payload: [{ op: 'replace', path: '/field', value: 'value' }] as any,
        entityType: 'encounter',
        entityId: 'encounter-1',
        timing: EffectTiming.ON_RESOLVE as any,
        priority: 0,
        isActive: true,
        version: 2,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
        deletedAt: null,
      };

      mockEffectService.update.mockResolvedValue(mockUpdatedEffect);

      const result = await resolver.updateEffect('effect-123', input, mockUser);

      expect(mockEffectService.update).toHaveBeenCalledWith('effect-123', input, mockUser);
      expect(result).toEqual(mockUpdatedEffect);
    });
  });

  describe('deleteEffect', () => {
    it('should delete effect successfully', async () => {
      mockEffectService.delete.mockResolvedValue({
        id: 'effect-123',
        name: 'Deleted Effect',
        description: null,
        effectType: 'patch',
        payload: [{ op: 'replace', path: '/field', value: 'value' }] as any,
        entityType: 'encounter',
        entityId: 'encounter-1',
        timing: EffectTiming.ON_RESOLVE as any,
        priority: 0,
        isActive: true,
        version: 1,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
        deletedAt: new Date('2025-01-02'),
      });

      const result = await resolver.deleteEffect('effect-123', mockUser);

      expect(mockEffectService.delete).toHaveBeenCalledWith('effect-123', mockUser);
      expect(result).toBe(true);
    });
  });

  describe('toggleEffectActive', () => {
    it('should toggle effect active status', async () => {
      const mockToggledEffect: PrismaEffect = {
        id: 'effect-123',
        name: 'Effect',
        description: null,
        effectType: 'patch',
        payload: [{ op: 'replace', path: '/field', value: 'value' }] as any,
        entityType: 'encounter',
        entityId: 'encounter-1',
        timing: EffectTiming.ON_RESOLVE as any,
        priority: 0,
        isActive: false,
        version: 2,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
        deletedAt: null,
      };

      mockEffectService.toggleActive.mockResolvedValue(mockToggledEffect);

      const result = await resolver.toggleEffectActive('effect-123', false, mockUser);

      expect(mockEffectService.toggleActive).toHaveBeenCalledWith('effect-123', false, mockUser);
      expect(result).toEqual(mockToggledEffect);
    });
  });

  describe('executeEffect', () => {
    it('should execute effect successfully', async () => {
      const input: ExecuteEffectInput = {
        effectId: 'effect-123',
        context: { field: 'initial_value' },
        dryRun: false,
      };

      const mockResult: ServiceEffectExecutionResult = {
        effectId: 'effect-123',
        success: true,
        patchApplied: [{ op: 'replace', path: '/field', value: 'new_value' }],
        error: null,
        executionId: 'execution-456',
      };

      mockEffectExecutionService.executeEffect.mockResolvedValue(mockResult);

      const result = await resolver.executeEffect(input, mockUser);

      expect(mockEffectExecutionService.executeEffect).toHaveBeenCalledWith(
        'effect-123',
        { field: 'initial_value' },
        mockUser,
        false
      );
      expect(result).toEqual(mockResult);
    });

    it('should execute effect in dry-run mode', async () => {
      const input: ExecuteEffectInput = {
        effectId: 'effect-123',
        dryRun: true,
      };

      const mockResult: ServiceEffectExecutionResult = {
        effectId: 'effect-123',
        success: true,
        patchApplied: [{ op: 'replace', path: '/field', value: 'new_value' }],
        error: null,
        executionId: null,
      };

      mockEffectExecutionService.executeEffect.mockResolvedValue(mockResult);

      const result = await resolver.executeEffect(input, mockUser);

      expect(mockEffectExecutionService.executeEffect).toHaveBeenCalledWith(
        'effect-123',
        undefined,
        mockUser,
        true
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('executeEffectsForEntity', () => {
    it('should execute all effects for entity at timing phase', async () => {
      const input: ExecuteEffectsForEntityInput = {
        entityType: 'encounter',
        entityId: 'encounter-1',
        timing: EffectTiming.ON_RESOLVE as any,
        dryRun: false,
      };

      const mockSummary: ServiceEffectExecutionSummary = {
        total: 2,
        succeeded: 2,
        failed: 0,
        results: [
          {
            effectId: 'effect-1',
            success: true,
            patchApplied: [{ op: 'replace', path: '/field1', value: 'value1' }],
            error: null,
            executionId: 'execution-1',
          },
          {
            effectId: 'effect-2',
            success: true,
            patchApplied: [{ op: 'replace', path: '/field2', value: 'value2' }],
            error: null,
            executionId: 'execution-2',
          },
        ],
        executionOrder: ['effect-1', 'effect-2'],
      };

      mockEffectExecutionService.executeEffectsForEntity.mockResolvedValue(mockSummary);

      const result = await resolver.executeEffectsForEntity(input, mockUser);

      expect(mockEffectExecutionService.executeEffectsForEntity).toHaveBeenCalledWith(
        'ENCOUNTER',
        'encounter-1',
        EffectTiming.ON_RESOLVE as any,
        mockUser
      );
      expect(result).toEqual(mockSummary);
    });

    it('should handle failed effect executions', async () => {
      const input: ExecuteEffectsForEntityInput = {
        entityType: 'encounter',
        entityId: 'encounter-1',
        timing: EffectTiming.POST as any,
        dryRun: false,
      };

      const mockSummary: ServiceEffectExecutionSummary = {
        total: 2,
        succeeded: 1,
        failed: 1,
        results: [
          {
            effectId: 'effect-1',
            success: true,
            patchApplied: [{ op: 'replace', path: '/field1', value: 'value1' }],
            error: null,
            executionId: 'execution-1',
          },
          {
            effectId: 'effect-2',
            success: false,
            patchApplied: null,
            error: 'Failed to apply patch',
            executionId: 'execution-2',
          },
        ],
        executionOrder: ['effect-1', 'effect-2'],
      };

      mockEffectExecutionService.executeEffectsForEntity.mockResolvedValue(mockSummary);

      const result = await resolver.executeEffectsForEntity(input, mockUser);

      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
    });
  });
});
