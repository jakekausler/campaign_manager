/**
 * EffectPatchService Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import type { Operation } from 'fast-json-patch';

import { EffectPatchService } from './effect-patch.service';

describe('EffectPatchService', () => {
  let service: EffectPatchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EffectPatchService],
    }).compile();

    service = module.get<EffectPatchService>(EffectPatchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validatePatch', () => {
    describe('patch format validation', () => {
      it('should accept valid add operation', () => {
        const patch: Operation[] = [{ op: 'add', path: '/name', value: 'Test Settlement' }];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should accept valid replace operation', () => {
        const patch: Operation[] = [{ op: 'replace', path: '/population', value: 5000 }];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should accept valid remove operation', () => {
        const patch: Operation[] = [{ op: 'remove', path: '/description' }];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should accept valid copy operation', () => {
        const patch: Operation[] = [{ op: 'copy', from: '/name', path: '/displayName' }];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should accept valid move operation', () => {
        const patch: Operation[] = [{ op: 'move', from: '/oldName', path: '/name' }];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should accept valid test operation', () => {
        const patch: Operation[] = [{ op: 'test', path: '/population', value: 1000 }];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject patch with missing op field', () => {
        const patch = [{ path: '/name', value: 'Test' }] as Operation[];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid patch format: operation 0 missing "op" field');
      });

      it('should reject patch with missing path field', () => {
        const patch = [{ op: 'add', value: 'Test' }] as Operation[];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid patch format: operation 0 missing "path" field');
      });

      it('should reject patch with invalid operation type', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const patch = [{ op: 'invalid', path: '/name', value: 'Test' }] as any as Operation[];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('Invalid operation type');
      });

      it('should reject add/replace operations missing value', () => {
        const patch = [{ op: 'add', path: '/name' }] as Operation[];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Operation "add" requires a "value" field');
      });

      it('should reject copy/move operations missing from', () => {
        const patch = [{ op: 'copy', path: '/name' }] as Operation[];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Operation "copy" requires a "from" field');
      });
    });

    describe('path whitelisting - Settlement', () => {
      it('should allow modification of name field', () => {
        const patch: Operation[] = [{ op: 'replace', path: '/name', value: 'New Name' }];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(true);
      });

      it('should allow modification of population field', () => {
        const patch: Operation[] = [{ op: 'replace', path: '/population', value: 5000 }];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(true);
      });

      it('should allow modification of description field', () => {
        const patch: Operation[] = [
          { op: 'replace', path: '/description', value: 'Updated description' },
        ];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(true);
      });

      it('should allow modification of tags array', () => {
        const patch: Operation[] = [{ op: 'add', path: '/tags/-', value: 'new_tag' }];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(true);
      });

      it('should reject modification of id field', () => {
        const patch: Operation[] = [{ op: 'replace', path: '/id', value: 'new-id' }];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('not allowed');
        expect(result.errors[0]).toContain('/id');
      });

      it('should reject modification of createdAt field', () => {
        const patch: Operation[] = [{ op: 'replace', path: '/createdAt', value: '2025-01-01' }];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('not allowed');
      });

      it('should reject modification of updatedAt field', () => {
        const patch: Operation[] = [{ op: 'replace', path: '/updatedAt', value: '2025-01-01' }];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('not allowed');
      });

      it('should reject modification of deletedAt field', () => {
        const patch: Operation[] = [{ op: 'replace', path: '/deletedAt', value: '2025-01-01' }];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('not allowed');
      });

      it('should reject modification of campaignId field', () => {
        const patch: Operation[] = [
          { op: 'replace', path: '/campaignId', value: 'new-campaign-id' },
        ];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('not allowed');
      });
    });

    describe('path whitelisting - Structure', () => {
      it('should allow modification of name field', () => {
        const patch: Operation[] = [{ op: 'replace', path: '/name', value: 'Updated Structure' }];

        const result = service.validatePatch(patch, 'STRUCTURE');

        expect(result.valid).toBe(true);
      });

      it('should allow modification of level field', () => {
        const patch: Operation[] = [{ op: 'replace', path: '/level', value: 5 }];

        const result = service.validatePatch(patch, 'STRUCTURE');

        expect(result.valid).toBe(true);
      });

      it('should reject modification of id field', () => {
        const patch: Operation[] = [{ op: 'replace', path: '/id', value: 'new-id' }];

        const result = service.validatePatch(patch, 'STRUCTURE');

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('not allowed');
      });
    });

    describe('path whitelisting - Kingdom', () => {
      it('should allow modification of name field', () => {
        const patch: Operation[] = [{ op: 'replace', path: '/name', value: 'Updated Kingdom' }];

        const result = service.validatePatch(patch, 'KINGDOM');

        expect(result.valid).toBe(true);
      });

      it('should allow modification of stability field', () => {
        const patch: Operation[] = [{ op: 'replace', path: '/stability', value: 75 }];

        const result = service.validatePatch(patch, 'KINGDOM');

        expect(result.valid).toBe(true);
      });

      it('should reject modification of id field', () => {
        const patch: Operation[] = [{ op: 'replace', path: '/id', value: 'new-id' }];

        const result = service.validatePatch(patch, 'KINGDOM');

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('not allowed');
      });
    });

    describe('nested path handling', () => {
      it('should allow modification of nested paths', () => {
        const patch: Operation[] = [{ op: 'replace', path: '/metadata/key1', value: 'value1' }];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(true);
      });

      it('should reject nested paths that start with protected fields', () => {
        const patch: Operation[] = [{ op: 'replace', path: '/id/nested', value: 'value' }];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('not allowed');
      });
    });

    describe('multiple operations', () => {
      it('should validate all operations in a patch', () => {
        const patch: Operation[] = [
          { op: 'replace', path: '/name', value: 'New Name' },
          { op: 'replace', path: '/population', value: 5000 },
          { op: 'add', path: '/tags/-', value: 'trade' },
        ];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should return all errors for invalid operations', () => {
        const patch: Operation[] = [
          { op: 'replace', path: '/id', value: 'new-id' },
          { op: 'replace', path: '/createdAt', value: '2025-01-01' },
          { op: 'replace', path: '/population', value: 5000 }, // valid
        ];

        const result = service.validatePatch(patch, 'SETTLEMENT');

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(2);
        expect(result.errors[0]).toContain('/id');
        expect(result.errors[1]).toContain('/createdAt');
      });
    });
  });

  describe('applyPatch', () => {
    describe('successful patch application', () => {
      it('should apply add operation to entity', () => {
        const entity = { name: 'Test', population: 1000 };
        const patch: Operation[] = [
          { op: 'add', path: '/description', value: 'A test settlement' },
        ];

        const result = service.applyPatch(entity, patch, 'SETTLEMENT');

        expect(result.success).toBe(true);
        expect(result.patchedEntity).toEqual({
          name: 'Test',
          population: 1000,
          description: 'A test settlement',
        });
        expect(result.errors).toEqual([]);
      });

      it('should apply replace operation to entity', () => {
        const entity = { name: 'Old Name', population: 1000 };
        const patch: Operation[] = [{ op: 'replace', path: '/name', value: 'New Name' }];

        const result = service.applyPatch(entity, patch, 'SETTLEMENT');

        expect(result.success).toBe(true);
        expect(result.patchedEntity).toEqual({
          name: 'New Name',
          population: 1000,
        });
      });

      it('should apply remove operation to entity', () => {
        const entity = { name: 'Test', population: 1000, description: 'Remove me' };
        const patch: Operation[] = [{ op: 'remove', path: '/description' }];

        const result = service.applyPatch(entity, patch, 'SETTLEMENT');

        expect(result.success).toBe(true);
        expect(result.patchedEntity).toEqual({
          name: 'Test',
          population: 1000,
        });
      });

      it('should apply copy operation to entity', () => {
        const entity = { name: 'Test Settlement', population: 1000 };
        const patch: Operation[] = [{ op: 'copy', from: '/name', path: '/displayName' }];

        const result = service.applyPatch(entity, patch, 'SETTLEMENT');

        expect(result.success).toBe(true);
        expect(result.patchedEntity).toEqual({
          name: 'Test Settlement',
          population: 1000,
          displayName: 'Test Settlement',
        });
      });

      it('should apply move operation to entity', () => {
        const entity = { oldName: 'Test', population: 1000 };
        const patch: Operation[] = [{ op: 'move', from: '/oldName', path: '/name' }];

        const result = service.applyPatch(entity, patch, 'SETTLEMENT');

        expect(result.success).toBe(true);
        expect(result.patchedEntity).toEqual({
          name: 'Test',
          population: 1000,
        });
        expect(result.patchedEntity).not.toHaveProperty('oldName');
      });

      it('should apply multiple operations sequentially', () => {
        const entity = { name: 'Test', population: 1000 };
        const patch: Operation[] = [
          { op: 'replace', path: '/name', value: 'Updated Name' },
          { op: 'replace', path: '/population', value: 5000 },
          { op: 'add', path: '/description', value: 'A thriving settlement' },
        ];

        const result = service.applyPatch(entity, patch, 'SETTLEMENT');

        expect(result.success).toBe(true);
        expect(result.patchedEntity).toEqual({
          name: 'Updated Name',
          population: 5000,
          description: 'A thriving settlement',
        });
      });

      it('should handle array operations', () => {
        const entity = { name: 'Test', tags: ['fortress', 'military'] };
        const patch: Operation[] = [{ op: 'add', path: '/tags/-', value: 'trade' }];

        const result = service.applyPatch(entity, patch, 'SETTLEMENT');

        expect(result.success).toBe(true);
        expect(result.patchedEntity).toEqual({
          name: 'Test',
          tags: ['fortress', 'military', 'trade'],
        });
      });

      it('should handle nested object operations', () => {
        const entity = { name: 'Test', metadata: { key1: 'value1' } };
        const patch: Operation[] = [{ op: 'add', path: '/metadata/key2', value: 'value2' }];

        const result = service.applyPatch(entity, patch, 'SETTLEMENT');

        expect(result.success).toBe(true);
        expect(result.patchedEntity).toEqual({
          name: 'Test',
          metadata: { key1: 'value1', key2: 'value2' },
        });
      });
    });

    describe('immutability', () => {
      it('should not modify the original entity', () => {
        const entity = { name: 'Test', population: 1000 };
        const originalEntity = { ...entity };
        const patch: Operation[] = [{ op: 'replace', path: '/name', value: 'New Name' }];

        const result = service.applyPatch(entity, patch, 'SETTLEMENT');

        expect(result.success).toBe(true);
        expect(entity).toEqual(originalEntity);
        expect(result.patchedEntity).not.toBe(entity);
      });

      it('should create a deep copy for nested objects', () => {
        const entity = { name: 'Test', metadata: { key1: 'value1' } };
        const patch: Operation[] = [{ op: 'add', path: '/metadata/key2', value: 'value2' }];

        const result = service.applyPatch(entity, patch, 'SETTLEMENT');

        expect(result.success).toBe(true);
        expect(entity.metadata).toEqual({ key1: 'value1' });
        expect(result.patchedEntity).not.toBeNull();
        expect(result.patchedEntity!.metadata).toEqual({ key1: 'value1', key2: 'value2' });
      });
    });

    describe('validation errors', () => {
      it('should fail if patch validation fails', () => {
        const entity = { name: 'Test', id: 'test-id' };
        const patch: Operation[] = [{ op: 'replace', path: '/id', value: 'new-id' }];

        const result = service.applyPatch(entity, patch, 'SETTLEMENT');

        expect(result.success).toBe(false);
        expect(result.patchedEntity).toBeNull();
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('not allowed');
      });

      it('should fail if patch format is invalid', () => {
        const entity = { name: 'Test' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const patch = [{ op: 'invalid', path: '/name', value: 'New' }] as any as Operation[];

        const result = service.applyPatch(entity, patch, 'SETTLEMENT');

        expect(result.success).toBe(false);
        expect(result.patchedEntity).toBeNull();
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('application errors', () => {
      it('should handle patch application errors gracefully', () => {
        const entity = { name: 'Test' };
        const patch: Operation[] = [{ op: 'remove', path: '/nonexistent' }];

        const result = service.applyPatch(entity, patch, 'SETTLEMENT');

        expect(result.success).toBe(false);
        expect(result.patchedEntity).toBeNull();
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should handle test operation failures', () => {
        const entity = { name: 'Test', population: 1000 };
        const patch: Operation[] = [
          { op: 'test', path: '/population', value: 5000 }, // Will fail - value is 1000
        ];

        const result = service.applyPatch(entity, patch, 'SETTLEMENT');

        expect(result.success).toBe(false);
        expect(result.patchedEntity).toBeNull();
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('generatePatchPreview', () => {
    it('should generate before/after preview for successful patch', () => {
      const entity = { name: 'Old Name', population: 1000 };
      const patch: Operation[] = [
        { op: 'replace', path: '/name', value: 'New Name' },
        { op: 'replace', path: '/population', value: 5000 },
      ];

      const result = service.generatePatchPreview(entity, patch, 'SETTLEMENT');

      expect(result.success).toBe(true);
      expect(result.before).toEqual(entity);
      expect(result.after).toEqual({
        name: 'New Name',
        population: 5000,
      });
      expect(result.changedFields).toEqual(['name', 'population']);
      expect(result.errors).toEqual([]);
    });

    it('should identify added fields', () => {
      const entity = { name: 'Test' };
      const patch: Operation[] = [{ op: 'add', path: '/description', value: 'New description' }];

      const result = service.generatePatchPreview(entity, patch, 'SETTLEMENT');

      expect(result.success).toBe(true);
      expect(result.changedFields).toEqual(['description']);
      expect(result.after).toHaveProperty('description', 'New description');
    });

    it('should identify removed fields', () => {
      const entity = { name: 'Test', description: 'Remove me' };
      const patch: Operation[] = [{ op: 'remove', path: '/description' }];

      const result = service.generatePatchPreview(entity, patch, 'SETTLEMENT');

      expect(result.success).toBe(true);
      expect(result.changedFields).toEqual(['description']);
      expect(result.after).not.toHaveProperty('description');
    });

    it('should handle nested field changes', () => {
      const entity = { name: 'Test', metadata: { key1: 'value1' } };
      const patch: Operation[] = [{ op: 'add', path: '/metadata/key2', value: 'value2' }];

      const result = service.generatePatchPreview(entity, patch, 'SETTLEMENT');

      expect(result.success).toBe(true);
      expect(result.changedFields).toContain('metadata');
    });

    it('should not modify original entity in preview', () => {
      const entity = { name: 'Test', population: 1000 };
      const originalEntity = { ...entity };
      const patch: Operation[] = [{ op: 'replace', path: '/name', value: 'New Name' }];

      service.generatePatchPreview(entity, patch, 'SETTLEMENT');

      expect(entity).toEqual(originalEntity);
    });

    it('should return failure for invalid patch', () => {
      const entity = { name: 'Test', id: 'test-id' };
      const patch: Operation[] = [{ op: 'replace', path: '/id', value: 'new-id' }];

      const result = service.generatePatchPreview(entity, patch, 'SETTLEMENT');

      expect(result.success).toBe(false);
      expect(result.before).toEqual(entity);
      expect(result.after).toBeNull();
      expect(result.changedFields).toEqual([]);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return empty changedFields for no-op patch', () => {
      const entity = { name: 'Test', population: 1000 };
      const patch: Operation[] = [
        { op: 'replace', path: '/name', value: 'Test' }, // Same value
      ];

      const result = service.generatePatchPreview(entity, patch, 'SETTLEMENT');

      expect(result.success).toBe(true);
      expect(result.changedFields).toEqual([]);
    });
  });
});
