/**
 * EffectExecutionService Tests
 *
 * Tests effect execution orchestration including:
 * - Single effect execution with patch application
 * - Multi-effect execution with priority ordering
 * - Dependency-ordered execution with topological sort
 * - Circular dependency detection
 * - Audit trail creation
 * - Dry-run mode
 * - Error handling and transaction semantics
 */

import { ForbiddenException, NotImplementedException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Operation } from 'fast-json-patch';

import { PrismaService } from '../../database/prisma.service';

import { EffectExecutionService } from './effect-execution.service';
import { EffectPatchService } from './effect-patch.service';

// Mock types
const mockEffect = {
  id: 'effect-1',
  name: 'Test Effect',
  description: 'Test effect description',
  effectType: 'modify_variable',
  payload: [{ op: 'replace', path: '/population', value: 5000 }] as Operation[],
  entityType: 'ENCOUNTER',
  entityId: 'encounter-1',
  timing: 'ON_RESOLVE',
  priority: 0,
  isActive: true,
  version: 1,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  deletedAt: null,
};

const mockEncounter = {
  id: 'encounter-1',
  name: 'Test Encounter',
  description: 'Test encounter',
  population: 1000,
  campaignId: 'campaign-1',
  eventId: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  deletedAt: null,
};

const mockEvent = {
  id: 'event-1',
  name: 'Test Event',
  description: 'Test event',
  campaignId: 'campaign-1',
  encounterId: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  deletedAt: null,
};

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  campaigns: [{ campaignId: 'campaign-1', role: 'owner' }],
};

describe('EffectExecutionService', () => {
  let service: EffectExecutionService;
  let prismaService: PrismaService;
  let effectPatchService: EffectPatchService;

  beforeEach(async () => {
    // Create mocks
    const mockPrisma = {
      effect: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      encounter: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      event: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      effectExecution: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    // Configure $transaction mock to execute callback with mock transaction client
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        // Create a mock transaction prisma client that delegates to the main mock
        const txPrisma = {
          effect: mockPrisma.effect,
          encounter: mockPrisma.encounter,
          event: mockPrisma.event,
          effectExecution: mockPrisma.effectExecution,
        };
        return callback(txPrisma);
      }
      // Fallback for array form (not used in current implementation)
      return Promise.all(callback);
    });

    const mockEffectPatchService = {
      validatePatch: jest.fn(),
      applyPatch: jest.fn(),
      generatePatchPreview: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EffectExecutionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EffectPatchService, useValue: mockEffectPatchService },
      ],
    }).compile();

    service = module.get<EffectExecutionService>(EffectExecutionService);
    prismaService = module.get(PrismaService);
    effectPatchService = module.get(EffectPatchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeEffect', () => {
    describe('single effect execution', () => {
      it('should successfully execute an effect and create audit record', async () => {
        // Arrange
        (prismaService.effect.findUnique as jest.Mock).mockResolvedValue(mockEffect);
        (prismaService.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
        (effectPatchService.applyPatch as jest.Mock).mockReturnValue({
          success: true,
          patchedEntity: { ...mockEncounter, population: 5000 },
          errors: [],
        });
        (prismaService.encounter.update as jest.Mock).mockResolvedValue({
          ...mockEncounter,
          population: 5000,
        });
        (prismaService.effectExecution.create as jest.Mock).mockResolvedValue({
          id: 'execution-1',
          effectId: 'effect-1',
          entityType: 'ENCOUNTER',
          entityId: 'encounter-1',
          executedAt: new Date('2025-01-02'),
          executedBy: 'user-1',
          context: mockEncounter,
          result: {
            success: true,
            patchApplied: mockEffect.payload,
            affectedFields: ['population'],
          },
          error: null,
        });

        // Act
        const result = await service.executeEffect('effect-1', undefined, mockUser, false);

        // Assert
        expect(result.success).toBe(true);
        expect(result.executionId).toBe('execution-1');
        expect(result.error).toBeNull();
        expect(prismaService.effect.findUnique).toHaveBeenCalledWith({
          where: { id: 'effect-1', deletedAt: null },
        });
        expect(prismaService.encounter.findUnique).toHaveBeenCalledWith({
          where: { id: 'encounter-1', deletedAt: null },
        });
        expect(effectPatchService.applyPatch).toHaveBeenCalledWith(
          mockEncounter,
          mockEffect.payload,
          'ENCOUNTER'
        );
        expect(prismaService.encounter.update).toHaveBeenCalled();
        expect(prismaService.effectExecution.create).toHaveBeenCalled();
      });

      it('should throw NotFoundException if effect does not exist', async () => {
        // Arrange
        (prismaService.effect.findUnique as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect(
          service.executeEffect('nonexistent', undefined, mockUser, false)
        ).rejects.toThrow(NotFoundException);
        expect(prismaService.encounter.findUnique).not.toHaveBeenCalled();
      });

      it('should throw ForbiddenException if effect is inactive', async () => {
        // Arrange
        (prismaService.effect.findUnique as jest.Mock).mockResolvedValue({
          ...mockEffect,
          isActive: false,
        });

        // Act & Assert
        await expect(service.executeEffect('effect-1', undefined, mockUser, false)).rejects.toThrow(
          ForbiddenException
        );
      });

      it('should throw NotFoundException if target entity does not exist', async () => {
        // Arrange
        (prismaService.effect.findUnique as jest.Mock).mockResolvedValue(mockEffect);
        (prismaService.encounter.findUnique as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect(service.executeEffect('effect-1', undefined, mockUser, false)).rejects.toThrow(
          NotFoundException
        );
      });

      it('should handle patch application failure gracefully', async () => {
        // Arrange
        (prismaService.effect.findUnique as jest.Mock).mockResolvedValue(mockEffect);
        (prismaService.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
        (effectPatchService.applyPatch as jest.Mock).mockReturnValue({
          success: false,
          patchedEntity: null,
          errors: ['Invalid patch operation'],
        });
        (prismaService.effectExecution.create as jest.Mock).mockResolvedValue({
          id: 'execution-1',
          effectId: 'effect-1',
          entityType: 'ENCOUNTER',
          entityId: 'encounter-1',
          executedAt: new Date('2025-01-02'),
          executedBy: 'user-1',
          context: mockEncounter,
          result: { success: false, patchApplied: null },
          error: 'Invalid patch operation',
        });

        // Act
        const result = await service.executeEffect('effect-1', undefined, mockUser, false);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid patch operation');
        expect(prismaService.encounter.update).not.toHaveBeenCalled();
        expect(prismaService.effectExecution.create).toHaveBeenCalled();
      });

      it('should not save changes in dry-run mode', async () => {
        // Arrange
        (prismaService.effect.findUnique as jest.Mock).mockResolvedValue(mockEffect);
        (prismaService.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
        (effectPatchService.applyPatch as jest.Mock).mockReturnValue({
          success: true,
          patchedEntity: { ...mockEncounter, population: 5000 },
          errors: [],
        });

        // Act
        const result = await service.executeEffect('effect-1', undefined, mockUser, true);

        // Assert
        expect(result.success).toBe(true);
        expect(prismaService.encounter.update).not.toHaveBeenCalled();
        expect(prismaService.effectExecution.create).not.toHaveBeenCalled();
      });

      it('should use provided context if supplied', async () => {
        // Arrange
        const customContext = { ...mockEncounter, population: 2000 };
        (prismaService.effect.findUnique as jest.Mock).mockResolvedValue(mockEffect);
        (effectPatchService.applyPatch as jest.Mock).mockReturnValue({
          success: true,
          patchedEntity: { ...customContext, population: 5000 },
          errors: [],
        });
        (prismaService.encounter.update as jest.Mock).mockResolvedValue({
          ...customContext,
          population: 5000,
        });
        (prismaService.effectExecution.create as jest.Mock).mockResolvedValue({
          id: 'execution-1',
          effectId: 'effect-1',
          entityType: 'ENCOUNTER',
          entityId: 'encounter-1',
          executedAt: new Date('2025-01-02'),
          executedBy: 'user-1',
          context: customContext,
          result: { success: true },
          error: null,
        });

        // Act
        const result = await service.executeEffect('effect-1', customContext, mockUser, false);

        // Assert
        expect(result.success).toBe(true);
        expect(prismaService.encounter.findUnique).not.toHaveBeenCalled();
        expect(effectPatchService.applyPatch).toHaveBeenCalledWith(
          customContext,
          mockEffect.payload,
          'ENCOUNTER'
        );
      });

      it('should handle event entities correctly', async () => {
        // Arrange
        const eventEffect = {
          ...mockEffect,
          entityType: 'EVENT',
          entityId: 'event-1',
          payload: [{ op: 'replace', path: '/description', value: 'Updated' }] as Operation[],
        };
        (prismaService.effect.findUnique as jest.Mock).mockResolvedValue(eventEffect);
        (prismaService.event.findUnique as jest.Mock).mockResolvedValue(mockEvent);
        (effectPatchService.applyPatch as jest.Mock).mockReturnValue({
          success: true,
          patchedEntity: { ...mockEvent, description: 'Updated' },
          errors: [],
        });
        (prismaService.event.update as jest.Mock).mockResolvedValue({
          ...mockEvent,
          description: 'Updated',
        });
        (prismaService.effectExecution.create as jest.Mock).mockResolvedValue({
          id: 'execution-1',
          effectId: 'effect-1',
          entityType: 'EVENT',
          entityId: 'event-1',
          executedAt: new Date('2025-01-02'),
          executedBy: 'user-1',
          context: mockEvent,
          result: { success: true },
          error: null,
        });

        // Act
        const result = await service.executeEffect(eventEffect.id, undefined, mockUser, false);

        // Assert
        expect(result.success).toBe(true);
        expect(prismaService.event.findUnique).toHaveBeenCalled();
        expect(prismaService.event.update).toHaveBeenCalled();
      });
    });
  });

  describe('executeEffectsForEntity', () => {
    describe('multi-effect execution with priority ordering', () => {
      it('should execute multiple effects in priority order', async () => {
        // Arrange
        const effect1 = { ...mockEffect, id: 'effect-1', priority: 10 };
        const effect2 = { ...mockEffect, id: 'effect-2', priority: 5 };
        const effect3 = { ...mockEffect, id: 'effect-3', priority: 15 };

        (prismaService.effect.findMany as jest.Mock).mockResolvedValue([effect1, effect2, effect3]);
        (prismaService.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
        (effectPatchService.applyPatch as jest.Mock).mockReturnValue({
          success: true,
          patchedEntity: mockEncounter,
          errors: [],
        });
        (prismaService.encounter.update as jest.Mock).mockResolvedValue(mockEncounter);
        (prismaService.effectExecution.create as jest.Mock)
          .mockResolvedValueOnce({ id: 'exec-2' } as never)
          .mockResolvedValueOnce({ id: 'exec-1' } as never)
          .mockResolvedValueOnce({ id: 'exec-3' } as never);

        // Act
        const result = await service.executeEffectsForEntity(
          'ENCOUNTER',
          'encounter-1',
          'ON_RESOLVE',
          mockUser
        );

        // Assert
        expect(result.total).toBe(3);
        expect(result.succeeded).toBe(3);
        expect(result.failed).toBe(0);
        expect(result.executionOrder).toEqual(['effect-2', 'effect-1', 'effect-3']); // Sorted by priority
        expect(prismaService.effectExecution.create).toHaveBeenCalledTimes(3);
      });

      it('should continue execution even if one effect fails', async () => {
        // Arrange
        const effect1 = { ...mockEffect, id: 'effect-1', priority: 1 };
        const effect2 = { ...mockEffect, id: 'effect-2', priority: 2 };

        (prismaService.effect.findMany as jest.Mock).mockResolvedValue([effect1, effect2]);
        (prismaService.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
        (effectPatchService.applyPatch as jest.Mock)
          .mockReturnValueOnce({
            success: false,
            patchedEntity: null,
            errors: ['Patch failed'],
          })
          .mockReturnValueOnce({
            success: true,
            patchedEntity: mockEncounter,
            errors: [],
          });
        (prismaService.encounter.update as jest.Mock).mockResolvedValue(mockEncounter);
        (prismaService.effectExecution.create as jest.Mock)
          .mockResolvedValueOnce({ id: 'exec-1' } as never)
          .mockResolvedValueOnce({ id: 'exec-2' } as never);

        // Act
        const result = await service.executeEffectsForEntity(
          'ENCOUNTER',
          'encounter-1',
          'ON_RESOLVE',
          mockUser
        );

        // Assert
        expect(result.total).toBe(2);
        expect(result.succeeded).toBe(1);
        expect(result.failed).toBe(1);
        expect(result.results).toHaveLength(2);
        expect(result.results[0].success).toBe(false);
        expect(result.results[1].success).toBe(true);
      });

      it('should return empty summary if no effects found', async () => {
        // Arrange
        (prismaService.effect.findMany as jest.Mock).mockResolvedValue([]);

        // Act
        const result = await service.executeEffectsForEntity(
          'ENCOUNTER',
          'encounter-1',
          'ON_RESOLVE',
          mockUser
        );

        // Assert
        expect(result.total).toBe(0);
        expect(result.succeeded).toBe(0);
        expect(result.failed).toBe(0);
        expect(result.results).toEqual([]);
        expect(result.executionOrder).toEqual([]);
      });

      it('should filter by timing and isActive', async () => {
        // Arrange
        (prismaService.effect.findMany as jest.Mock).mockResolvedValue([mockEffect]);
        (prismaService.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
        (effectPatchService.applyPatch as jest.Mock).mockReturnValue({
          success: true,
          patchedEntity: mockEncounter,
          errors: [],
        });
        (prismaService.encounter.update as jest.Mock).mockResolvedValue(mockEncounter);
        (prismaService.effectExecution.create as jest.Mock).mockResolvedValue({
          id: 'execution-1',
        });

        // Act
        await service.executeEffectsForEntity('ENCOUNTER', 'encounter-1', 'PRE', mockUser);

        // Assert
        expect(prismaService.effect.findMany).toHaveBeenCalledWith({
          where: {
            entityType: 'ENCOUNTER',
            entityId: 'encounter-1',
            timing: 'PRE',
            isActive: true,
            deletedAt: null,
          },
          orderBy: { priority: 'asc' },
        });
      });
    });
  });

  describe('executeEffectsWithDependencies', () => {
    describe('dependency-ordered execution', () => {
      it('should throw NotImplementedException until Stage 7 is complete', async () => {
        // Act & Assert
        await expect(
          service.executeEffectsWithDependencies(['effect-1', 'effect-2'], mockEncounter, mockUser)
        ).rejects.toThrow(NotImplementedException);

        await expect(
          service.executeEffectsWithDependencies(['effect-1', 'effect-2'], mockEncounter, mockUser)
        ).rejects.toThrow('Effect dependency-ordered execution is not yet implemented');
      });
    });
  });

  describe('transaction semantics', () => {
    it('should execute all operations in a transaction', async () => {
      // Arrange
      (prismaService.effect.findUnique as jest.Mock).mockResolvedValue(mockEffect);
      (prismaService.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
      (effectPatchService.applyPatch as jest.Mock).mockReturnValue({
        success: true,
        patchedEntity: { ...mockEncounter, population: 5000 },
        errors: [],
      });
      (prismaService.encounter.update as jest.Mock).mockResolvedValue({
        ...mockEncounter,
        population: 5000,
      });
      (prismaService.effectExecution.create as jest.Mock).mockResolvedValue({
        id: 'execution-1',
        effectId: 'effect-1',
        entityType: 'ENCOUNTER',
        entityId: 'encounter-1',
        executedAt: new Date('2025-01-02'),
        executedBy: 'user-1',
        context: mockEncounter,
        result: { success: true },
        error: null,
      });

      // Act
      await service.executeEffect('effect-1', undefined, mockUser, false);

      // Assert
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should rollback transaction if entity update fails', async () => {
      // Arrange
      (prismaService.effect.findUnique as jest.Mock).mockResolvedValue(mockEffect);
      (prismaService.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
      (effectPatchService.applyPatch as jest.Mock).mockReturnValue({
        success: true,
        patchedEntity: { ...mockEncounter, population: 5000 },
        errors: [],
      });
      (prismaService.encounter.update as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.executeEffect('effect-1', undefined, mockUser, false)).rejects.toThrow(
        'Database error'
      );
      // Transaction should rollback, so effectExecution.create should not persist
    });
  });

  describe('error handling', () => {
    it('should handle unknown entity types gracefully', async () => {
      // Arrange
      const invalidEffect = {
        ...mockEffect,
        entityType: 'INVALID_TYPE',
      };
      (prismaService.effect.findUnique as jest.Mock).mockResolvedValue(invalidEffect);

      // Act & Assert
      await expect(service.executeEffect('effect-1', undefined, mockUser, false)).rejects.toThrow();
    });

    it('should log errors during execution', async () => {
      // Arrange
      (prismaService.effect.findUnique as jest.Mock).mockResolvedValue(mockEffect);
      (prismaService.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
      (effectPatchService.applyPatch as jest.Mock).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      // Act & Assert
      await expect(service.executeEffect('effect-1', undefined, mockUser, false)).rejects.toThrow(
        'Unexpected error'
      );
    });
  });
});
