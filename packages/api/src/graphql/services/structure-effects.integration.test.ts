/**
 * Structure Effects Integration Tests
 *
 * Demonstrates how to use JSON Patch operations to implement Structure-specific effects:
 * - structure.setLevel: Update structure level
 * - structure.setVariable: Update typed variable
 * - structure.setOperational: Change operational status
 * - structure.upgrade: Upgrade structure level
 *
 * These tests verify that the existing EffectExecutionService and EffectPatchService
 * can correctly handle Structure entity state mutations.
 */

import { Test, TestingModule } from '@nestjs/testing';
import type { Operation } from 'fast-json-patch';

import { PrismaService } from '../../database/prisma.service';

import { EffectExecutionService } from './effect-execution.service';
import { EffectPatchService } from './effect-patch.service';

describe('Structure Effects Integration', () => {
  let module: TestingModule;
  let effectPatchService: EffectPatchService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [EffectExecutionService, EffectPatchService, PrismaService],
    }).compile();

    effectPatchService = module.get<EffectPatchService>(EffectPatchService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('structure.setLevel effect', () => {
    it('should apply JSON Patch to update structure level', () => {
      // Arrange: Mock structure entity
      const structure = {
        id: 'structure-1',
        settlementId: 'settlement-1',
        type: 'temple',
        name: 'Temple of Light',
        level: 2,
        variables: { integrity: 95 },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Upgrade structure to level 3
      const patch: Operation[] = [{ op: 'replace', path: '/level', value: 3 }];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(structure, patch, 'STRUCTURE');

      // Assert: Level was updated
      expect(result.success).toBe(true);
      expect(result.patchedEntity).toMatchObject({
        id: structure.id,
        name: structure.name,
        type: structure.type,
        level: 3,
        settlementId: structure.settlementId,
        variables: structure.variables,
      });
      expect(result.errors).toEqual([]);
    });

    it('should apply JSON Patch to dynamically calculate new level', () => {
      // Arrange: Structure entity
      const structure = {
        id: 'structure-1',
        settlementId: 'settlement-1',
        type: 'barracks',
        name: 'Military Barracks',
        level: 3,
        variables: { capacity: 50, operational: true },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Upgrade level by 1 (calculated by rules engine)
      const newLevel = structure.level + 1;
      const patch: Operation[] = [{ op: 'replace', path: '/level', value: newLevel }];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(structure, patch, 'STRUCTURE');

      // Assert: Level was incremented
      expect(result.success).toBe(true);
      expect(result.patchedEntity?.level).toBe(4);
    });
  });

  describe('structure.setVariable effect', () => {
    it('should apply JSON Patch to add new variable', () => {
      // Arrange: Structure entity
      const structure = {
        id: 'structure-1',
        settlementId: 'settlement-1',
        type: 'temple',
        name: 'Temple of Light',
        level: 3,
        variables: { integrity: 95 },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Add operational status variable
      const patch: Operation[] = [{ op: 'add', path: '/variables/operational', value: true }];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(structure, patch, 'STRUCTURE');

      // Assert: Variable was added
      expect(result.success).toBe(true);
      expect(result.patchedEntity).toMatchObject({
        id: structure.id,
        name: structure.name,
        type: structure.type,
        level: structure.level,
        settlementId: structure.settlementId,
        variables: {
          integrity: 95,
          operational: true,
        },
      });
    });

    it('should apply JSON Patch to update existing variable', () => {
      // Arrange: Structure entity with existing variables
      const structure = {
        id: 'structure-1',
        settlementId: 'settlement-1',
        type: 'temple',
        name: 'Temple of Light',
        level: 3,
        variables: {
          integrity: 95,
          operational: true,
          lastMaintenance: '2025-01-01',
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Update integrity after damage
      const patch: Operation[] = [{ op: 'replace', path: '/variables/integrity', value: 75 }];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(structure, patch, 'STRUCTURE');

      // Assert: Variable was updated
      expect(result.success).toBe(true);
      expect(result.patchedEntity?.variables?.integrity).toBe(75);
    });

    it('should apply JSON Patch to increment numeric variable', () => {
      // Arrange: Structure entity
      const structure = {
        id: 'structure-1',
        settlementId: 'settlement-1',
        type: 'market',
        name: 'Grand Market',
        level: 4,
        variables: {
          dailyRevenue: 100,
          operational: true,
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Increase daily revenue by 25 (calculated by rules engine)
      const newRevenue = (structure.variables.dailyRevenue as number) + 25;
      const patch: Operation[] = [
        { op: 'replace', path: '/variables/dailyRevenue', value: newRevenue },
      ];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(structure, patch, 'STRUCTURE');

      // Assert: Revenue was incremented
      expect(result.success).toBe(true);
      expect(result.patchedEntity?.variables?.dailyRevenue).toBe(125);
    });
  });

  describe('structure.setOperational effect', () => {
    it('should apply JSON Patch to set operational status to true', () => {
      // Arrange: Structure entity (currently not operational)
      const structure = {
        id: 'structure-1',
        settlementId: 'settlement-1',
        type: 'temple',
        name: 'Temple of Light',
        level: 3,
        variables: {
          integrity: 95,
          operational: false,
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Set operational to true after repairs
      const patch: Operation[] = [{ op: 'replace', path: '/variables/operational', value: true }];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(structure, patch, 'STRUCTURE');

      // Assert: Operational status was updated
      expect(result.success).toBe(true);
      expect(result.patchedEntity?.variables?.operational).toBe(true);
    });

    it('should apply JSON Patch to set operational status to false', () => {
      // Arrange: Structure entity (currently operational)
      const structure = {
        id: 'structure-1',
        settlementId: 'settlement-1',
        type: 'barracks',
        name: 'Military Barracks',
        level: 4,
        variables: {
          capacity: 75,
          operational: true,
          integrity: 30, // Damaged
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Set operational to false due to low integrity
      const patch: Operation[] = [{ op: 'replace', path: '/variables/operational', value: false }];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(structure, patch, 'STRUCTURE');

      // Assert: Operational status was updated
      expect(result.success).toBe(true);
      expect(result.patchedEntity?.variables?.operational).toBe(false);
    });
  });

  describe('structure.upgrade effect', () => {
    it('should apply JSON Patch to upgrade structure with level and variable changes', () => {
      // Arrange: Structure entity
      const structure = {
        id: 'structure-1',
        settlementId: 'settlement-1',
        type: 'market',
        name: 'Trading Post',
        level: 2,
        variables: {
          dailyRevenue: 50,
          capacity: 20,
          operational: true,
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Upgrade to level 3 with improved stats
      const patch: Operation[] = [
        { op: 'replace', path: '/level', value: 3 },
        { op: 'replace', path: '/name', value: 'Market Square' },
        { op: 'replace', path: '/variables/dailyRevenue', value: 100 },
        { op: 'replace', path: '/variables/capacity', value: 40 },
      ];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(structure, patch, 'STRUCTURE');

      // Assert: All upgrade changes were applied
      expect(result.success).toBe(true);
      expect(result.patchedEntity?.level).toBe(3);
      expect(result.patchedEntity?.name).toBe('Market Square');
      expect(result.patchedEntity?.variables?.dailyRevenue).toBe(100);
      expect(result.patchedEntity?.variables?.capacity).toBe(40);
    });
  });

  describe('Complex structure effects', () => {
    it('should apply damage effect with multiple variable updates', () => {
      // Arrange: Structure entity
      const structure = {
        id: 'structure-1',
        settlementId: 'settlement-1',
        type: 'forge',
        name: 'Blacksmith Forge',
        level: 3,
        variables: {
          integrity: 90,
          operational: true,
          productionRate: 10,
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Apply damage from disaster
      const patch: Operation[] = [
        { op: 'replace', path: '/variables/integrity', value: 45 },
        { op: 'replace', path: '/variables/operational', value: false },
        { op: 'replace', path: '/variables/productionRate', value: 0 },
        { op: 'add', path: '/variables/needsRepair', value: true },
      ];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(structure, patch, 'STRUCTURE');

      // Assert: All damage effects were applied
      expect(result.success).toBe(true);
      expect(result.patchedEntity?.variables?.integrity).toBe(45);
      expect(result.patchedEntity?.variables?.operational).toBe(false);
      expect((result.patchedEntity?.variables as Record<string, unknown>)?.productionRate).toBe(0);
      expect((result.patchedEntity?.variables as Record<string, unknown>)?.needsRepair).toBe(true);
    });

    it('should apply repair effect with integrity restoration', () => {
      // Arrange: Damaged structure
      const structure = {
        id: 'structure-1',
        settlementId: 'settlement-1',
        type: 'library',
        name: 'Grand Library',
        level: 4,
        variables: {
          integrity: 60,
          operational: false,
          booksCount: 500,
          needsRepair: true,
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Apply repairs
      const patch: Operation[] = [
        { op: 'replace', path: '/variables/integrity', value: 95 },
        { op: 'replace', path: '/variables/operational', value: true },
        { op: 'remove', path: '/variables/needsRepair' },
        { op: 'add', path: '/variables/lastRepairDate', value: '2025-10-28' },
      ];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(structure, patch, 'STRUCTURE');

      // Assert: All repair effects were applied
      expect(result.success).toBe(true);
      expect(result.patchedEntity?.variables?.integrity).toBe(95);
      expect(result.patchedEntity?.variables?.operational).toBe(true);
      expect(
        (result.patchedEntity?.variables as Record<string, unknown>)?.needsRepair
      ).toBeUndefined();
      expect((result.patchedEntity?.variables as Record<string, unknown>)?.lastRepairDate).toBe(
        '2025-10-28'
      );
    });
  });

  describe('Structure effect validation', () => {
    it('should reject patches to protected fields', () => {
      // Arrange: Structure entity
      const structure = {
        id: 'structure-1',
        settlementId: 'settlement-1',
        type: 'temple',
        name: 'Temple of Light',
        level: 3,
        variables: { integrity: 95 },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Try to modify protected id field (INVALID)
      const patch: Operation[] = [{ op: 'replace', path: '/id', value: 'hacked-id' }];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(structure, patch, 'STRUCTURE');

      // Assert: Patch was rejected
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('not allowed');
    });

    it('should reject patches to entity-specific protected fields', () => {
      // Arrange: Structure entity
      const structure = {
        id: 'structure-1',
        settlementId: 'settlement-1',
        type: 'temple',
        name: 'Temple of Light',
        level: 3,
        variables: { integrity: 95 },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Try to modify protected settlementId field (INVALID)
      const patch: Operation[] = [
        { op: 'replace', path: '/settlementId', value: 'different-settlement' },
      ];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(structure, patch, 'STRUCTURE');

      // Assert: Patch was rejected
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not allowed');
      expect(result.errors[0]).toContain('settlementId');
    });

    it('should allow modification of whitelisted fields', () => {
      // Arrange: Structure entity
      const structure = {
        id: 'structure-1',
        settlementId: 'settlement-1',
        type: 'tavern',
        name: 'The Prancing Pony',
        level: 2,
        variables: { patrons: 30 },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Modify allowed fields (name, level, type, variables)
      const patch: Operation[] = [
        { op: 'replace', path: '/name', value: 'The Golden Goblet' },
        { op: 'replace', path: '/level', value: 3 },
        { op: 'replace', path: '/type', value: 'inn' },
        { op: 'add', path: '/variables/rooms', value: 10 },
      ];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(structure, patch, 'STRUCTURE');

      // Assert: Patch was applied successfully
      expect(result.success).toBe(true);
      expect(result.patchedEntity?.name).toBe('The Golden Goblet');
      expect(result.patchedEntity?.level).toBe(3);
      expect(result.patchedEntity?.type).toBe('inn');
      expect((result.patchedEntity?.variables as Record<string, unknown>)?.rooms).toBe(10);
    });
  });
});
