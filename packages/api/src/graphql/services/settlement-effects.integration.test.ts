/**
 * Settlement Effects Integration Tests
 *
 * Demonstrates how to use JSON Patch operations to implement Settlement-specific effects:
 * - settlement.setLevel: Update settlement level
 * - settlement.setVariable: Update typed variable
 * - settlement.addStructure: Create new structure (via service call, not patch)
 * - settlement.updateProsperity: Change prosperity status variable
 *
 * These tests verify that the existing EffectExecutionService and EffectPatchService
 * can correctly handle Settlement entity state mutations.
 */

import { Test, TestingModule } from '@nestjs/testing';
import type { Operation } from 'fast-json-patch';

import { PrismaService } from '../../database/prisma.service';

import { EffectExecutionService } from './effect-execution.service';
import { EffectPatchService } from './effect-patch.service';

describe('Settlement Effects Integration', () => {
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

  describe('settlement.setLevel effect', () => {
    it('should apply JSON Patch to update settlement level', () => {
      // Arrange: Mock settlement entity
      const settlement = {
        id: 'settlement-1',
        kingdomId: 'kingdom-1',
        locationId: 'location-1',
        name: 'Riverside',
        level: 3,
        variables: { population: 5000 },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Increase settlement level by 1
      const patch: Operation[] = [{ op: 'replace', path: '/level', value: 4 }];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(settlement, patch, 'SETTLEMENT');

      // Assert: Level was updated
      expect(result.success).toBe(true);
      expect(result.patchedEntity).toMatchObject({
        id: settlement.id,
        name: settlement.name,
        level: 4,
        kingdomId: settlement.kingdomId,
        locationId: settlement.locationId,
        variables: settlement.variables,
      });
      expect(result.errors).toEqual([]);
    });

    it('should apply JSON Patch to dynamically calculate new level', () => {
      // Arrange: Settlement entity
      const settlement = {
        id: 'settlement-1',
        kingdomId: 'kingdom-1',
        locationId: 'location-1',
        name: 'Riverside',
        level: 3,
        variables: { population: 5000 },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Increase level by 1 (would be calculated by rules engine)
      const newLevel = settlement.level + 1;
      const patch: Operation[] = [{ op: 'replace', path: '/level', value: newLevel }];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(settlement, patch, 'SETTLEMENT');

      // Assert: Level was incremented
      expect(result.success).toBe(true);
      expect(result.patchedEntity?.level).toBe(4);
    });
  });

  describe('settlement.setVariable effect', () => {
    it('should apply JSON Patch to add new variable', () => {
      // Arrange: Settlement entity
      const settlement = {
        id: 'settlement-1',
        kingdomId: 'kingdom-1',
        locationId: 'location-1',
        name: 'Riverside',
        level: 5,
        variables: { population: 8500 },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Add prosperity variable
      const patch: Operation[] = [{ op: 'add', path: '/variables/prosperity', value: 'thriving' }];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(settlement, patch, 'SETTLEMENT');

      // Assert: Variable was added
      expect(result.success).toBe(true);
      expect(result.patchedEntity).toMatchObject({
        id: settlement.id,
        name: settlement.name,
        level: settlement.level,
        kingdomId: settlement.kingdomId,
        locationId: settlement.locationId,
        variables: {
          population: 8500,
          prosperity: 'thriving',
        },
      });
    });

    it('should apply JSON Patch to update existing variable', () => {
      // Arrange: Settlement entity with existing variable
      const settlement = {
        id: 'settlement-1',
        kingdomId: 'kingdom-1',
        locationId: 'location-1',
        name: 'Riverside',
        level: 5,
        variables: {
          population: 8500,
          prosperity: 'stable',
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Update prosperity to thriving
      const patch: Operation[] = [
        { op: 'replace', path: '/variables/prosperity', value: 'thriving' },
      ];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(settlement, patch, 'SETTLEMENT');

      // Assert: Variable was updated
      expect(result.success).toBe(true);
      expect(result.patchedEntity?.variables).toEqual({
        population: 8500,
        prosperity: 'thriving',
      });
    });

    it('should apply JSON Patch to increment numeric variable', () => {
      // Arrange: Settlement entity
      const settlement = {
        id: 'settlement-1',
        kingdomId: 'kingdom-1',
        locationId: 'location-1',
        name: 'Riverside',
        level: 5,
        variables: {
          population: 8500,
          defenseRating: 7,
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Increase population by 500 (calculated by rules engine)
      const newPopulation = (settlement.variables.population as number) + 500;
      const patch: Operation[] = [
        { op: 'replace', path: '/variables/population', value: newPopulation },
      ];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(settlement, patch, 'SETTLEMENT');

      // Assert: Population was incremented
      expect(result.success).toBe(true);
      expect(result.patchedEntity?.variables?.population).toBe(9000);
    });
  });

  describe('settlement.updateProsperity effect', () => {
    it('should apply JSON Patch to change prosperity status', () => {
      // Arrange: Settlement entity
      const settlement = {
        id: 'settlement-1',
        kingdomId: 'kingdom-1',
        locationId: 'location-1',
        name: 'Riverside',
        level: 5,
        variables: {
          population: 8500,
          prosperity: 'stable',
          defenseRating: 7,
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Update prosperity to thriving
      const patch: Operation[] = [
        { op: 'replace', path: '/variables/prosperity', value: 'thriving' },
      ];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(settlement, patch, 'SETTLEMENT');

      // Assert: Prosperity was updated
      expect(result.success).toBe(true);
      expect(result.patchedEntity?.variables?.prosperity).toBe('thriving');
    });

    it('should handle prosperity downgrade', () => {
      // Arrange: Settlement entity with high prosperity
      const settlement = {
        id: 'settlement-1',
        kingdomId: 'kingdom-1',
        locationId: 'location-1',
        name: 'Riverside',
        level: 5,
        variables: {
          population: 8500,
          prosperity: 'thriving',
          defenseRating: 7,
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Downgrade prosperity due to disaster
      const patch: Operation[] = [
        { op: 'replace', path: '/variables/prosperity', value: 'declining' },
      ];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(settlement, patch, 'SETTLEMENT');

      // Assert: Prosperity was downgraded
      expect(result.success).toBe(true);
      expect(result.patchedEntity?.variables?.prosperity).toBe('declining');
    });
  });

  describe('settlement.addStructure effect', () => {
    it('should document that structure creation requires StructureService', () => {
      // NOTE: Adding a structure is NOT done via JSON Patch on Settlement
      // Instead, it requires creating a new Structure entity via StructureService
      // with settlementId foreign key. This is a relationship operation, not a patch.

      // Effect: This would be implemented as:
      // await structureService.create({
      //   settlementId: 'settlement-1',
      //   type: 'temple',
      //   name: 'Temple of Light',
      //   level: 1,
      //   variables: {},
      // });

      // This test documents that settlement.addStructure is not a patch operation
      expect(true).toBe(true);
    });
  });

  describe('Complex settlement effects', () => {
    it('should apply multiple changes in a single patch', () => {
      // Arrange: Settlement entity
      const settlement = {
        id: 'settlement-1',
        kingdomId: 'kingdom-1',
        locationId: 'location-1',
        name: 'Riverside',
        level: 4,
        variables: {
          population: 7000,
          prosperity: 'stable',
          defenseRating: 5,
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Level up settlement with multiple improvements
      const patch: Operation[] = [
        { op: 'replace', path: '/level', value: 5 },
        { op: 'replace', path: '/variables/population', value: 8500 },
        { op: 'replace', path: '/variables/prosperity', value: 'thriving' },
        { op: 'replace', path: '/variables/defenseRating', value: 7 },
      ];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(settlement, patch, 'SETTLEMENT');

      // Assert: All changes were applied
      expect(result.success).toBe(true);
      expect(result.patchedEntity).toMatchObject({
        id: settlement.id,
        name: settlement.name,
        level: 5,
        kingdomId: settlement.kingdomId,
        locationId: settlement.locationId,
        variables: {
          population: 8500,
          prosperity: 'thriving',
          defenseRating: 7,
        },
      });
    });

    it('should handle conditional variable updates', () => {
      // Arrange: Settlement entity
      const settlement = {
        id: 'settlement-1',
        kingdomId: 'kingdom-1',
        locationId: 'location-1',
        name: 'Riverside',
        level: 5,
        variables: {
          population: 8500,
          prosperity: 'thriving',
          defenseRating: 7,
          tradeBonus: 10,
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Add economic boom bonus (calculated by rules engine)
      const currentBonus = (settlement.variables.tradeBonus as number) || 0;
      const newBonus = currentBonus + 5;

      const patch: Operation[] = [
        { op: 'replace', path: '/variables/tradeBonus', value: newBonus },
        { op: 'add', path: '/variables/economicBoomActive', value: true },
      ];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(settlement, patch, 'SETTLEMENT');

      // Assert: Bonus was applied
      expect(result.success).toBe(true);
      expect(result.patchedEntity?.variables?.tradeBonus).toBe(15);
      expect((result.patchedEntity?.variables as Record<string, unknown>)?.economicBoomActive).toBe(
        true
      );
    });
  });

  describe('Settlement effect validation', () => {
    it('should reject patches to protected fields', () => {
      // Arrange: Settlement entity
      const settlement = {
        id: 'settlement-1',
        kingdomId: 'kingdom-1',
        locationId: 'location-1',
        name: 'Riverside',
        level: 5,
        variables: { population: 8500 },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Try to modify protected id field (INVALID)
      const patch: Operation[] = [{ op: 'replace', path: '/id', value: 'hacked-id' }];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(settlement, patch, 'SETTLEMENT');

      // Assert: Patch was rejected
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('not allowed');
    });

    it('should reject patches to entity-specific protected fields', () => {
      // Arrange: Settlement entity
      const settlement = {
        id: 'settlement-1',
        kingdomId: 'kingdom-1',
        locationId: 'location-1',
        name: 'Riverside',
        level: 5,
        variables: { population: 8500 },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Try to modify protected kingdomId field (INVALID)
      const patch: Operation[] = [
        { op: 'replace', path: '/kingdomId', value: 'different-kingdom' },
      ];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(settlement, patch, 'SETTLEMENT');

      // Assert: Patch was rejected
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not allowed');
      expect(result.errors[0]).toContain('kingdomId');
    });

    it('should allow modification of whitelisted fields', () => {
      // Arrange: Settlement entity
      const settlement = {
        id: 'settlement-1',
        kingdomId: 'kingdom-1',
        locationId: 'location-1',
        name: 'Riverside',
        level: 5,
        variables: { population: 8500 },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Effect: Modify allowed fields (name, level, variables)
      const patch: Operation[] = [
        { op: 'replace', path: '/name', value: 'Riverside City' },
        { op: 'replace', path: '/level', value: 6 },
        { op: 'add', path: '/variables/renamed', value: true },
      ];

      // Act: Apply patch
      const result = effectPatchService.applyPatch(settlement, patch, 'SETTLEMENT');

      // Assert: Patch was applied successfully
      expect(result.success).toBe(true);
      expect(result.patchedEntity?.name).toBe('Riverside City');
      expect(result.patchedEntity?.level).toBe(6);
      expect((result.patchedEntity?.variables as Record<string, unknown>)?.renamed).toBe(true);
    });
  });
});
