import {
  buildCacheKey,
  buildPrefixPattern,
  buildEntityPattern,
  buildBranchPattern,
  buildComputedFieldsKey,
  buildEntityListKey,
  buildSpatialQueryKey,
  parseCacheKey,
} from './cache-key.builder';

describe('CacheKeyBuilder', () => {
  describe('buildCacheKey', () => {
    it('should build key with all parameters', () => {
      const result = buildCacheKey({
        prefix: 'computed-fields',
        entityType: 'settlement',
        entityId: '123',
        branchId: 'main',
      });

      expect(result).toBe('computed-fields:settlement:123:main');
    });

    it('should build key with only prefix and branchId', () => {
      const result = buildCacheKey({
        prefix: 'global-cache',
        branchId: 'main',
      });

      expect(result).toBe('global-cache:main');
    });

    it('should build key with entityType but no entityId', () => {
      const result = buildCacheKey({
        prefix: 'settlements',
        entityType: 'kingdom',
        branchId: 'main',
      });

      expect(result).toBe('settlements:kingdom:main');
    });

    it('should include additional segments in correct order', () => {
      const result = buildCacheKey({
        prefix: 'spatial',
        branchId: 'main',
        additionalSegments: ['settlements-in-region', '789'],
      });

      expect(result).toBe('spatial:settlements-in-region:789:main');
    });

    it('should place branchId last regardless of parameter order', () => {
      const result = buildCacheKey({
        prefix: 'computed-fields',
        entityType: 'settlement',
        entityId: '123',
        additionalSegments: ['extra', 'data'],
        branchId: 'alternate-timeline-1',
      });

      expect(result).toBe('computed-fields:settlement:123:extra:data:alternate-timeline-1');
    });

    it('should handle empty additional segments array', () => {
      const result = buildCacheKey({
        prefix: 'test',
        branchId: 'main',
        additionalSegments: [],
      });

      expect(result).toBe('test:main');
    });

    it('should handle multiple additional segments', () => {
      const result = buildCacheKey({
        prefix: 'spatial',
        branchId: 'main',
        additionalSegments: ['entities-within-bounds', '0,0', '10,10', 'extra'],
      });

      expect(result).toBe('spatial:entities-within-bounds:0,0:10,10:extra:main');
    });

    it('should handle entityId without entityType', () => {
      const result = buildCacheKey({
        prefix: 'test',
        entityId: '456',
        branchId: 'main',
      });

      // entityId is only added if entityType is also present
      expect(result).toBe('test:456:main');
    });
  });

  describe('buildPrefixPattern', () => {
    it('should append wildcard to simple prefix', () => {
      expect(buildPrefixPattern('computed-fields')).toBe('computed-fields:*');
    });

    it('should append wildcard to multi-segment prefix', () => {
      expect(buildPrefixPattern('settlements:kingdom:123')).toBe('settlements:kingdom:123:*');
    });

    it('should handle single character prefix', () => {
      expect(buildPrefixPattern('x')).toBe('x:*');
    });

    it('should handle prefix with special characters', () => {
      expect(buildPrefixPattern('cache-v2.0')).toBe('cache-v2.0:*');
    });
  });

  describe('buildEntityPattern', () => {
    it('should build pattern for entity in main branch', () => {
      const result = buildEntityPattern('settlement', '123', 'main');
      expect(result).toBe('*:settlement:123:main');
    });

    it('should build pattern for entity in alternate branch', () => {
      const result = buildEntityPattern('kingdom', '456', 'alternate-timeline-1');
      expect(result).toBe('*:kingdom:456:alternate-timeline-1');
    });

    it('should handle entity with special characters in ID', () => {
      const result = buildEntityPattern('settlement', 'uuid-abc-123-def', 'main');
      expect(result).toBe('*:settlement:uuid-abc-123-def:main');
    });

    it('should handle entity with numeric ID', () => {
      const result = buildEntityPattern('structure', '999', 'main');
      expect(result).toBe('*:structure:999:main');
    });
  });

  describe('buildBranchPattern', () => {
    it('should build pattern for main branch', () => {
      expect(buildBranchPattern('main')).toBe('*:main');
    });

    it('should build pattern for alternate branch', () => {
      expect(buildBranchPattern('alternate-timeline-1')).toBe('*:alternate-timeline-1');
    });

    it('should build pattern for branch with special characters', () => {
      expect(buildBranchPattern('feature/new-timeline')).toBe('*:feature/new-timeline');
    });

    it('should handle short branch names', () => {
      expect(buildBranchPattern('v2')).toBe('*:v2');
    });
  });

  describe('buildComputedFieldsKey', () => {
    it('should build computed fields key for settlement', () => {
      const result = buildComputedFieldsKey('settlement', '123', 'main');
      expect(result).toBe('computed-fields:settlement:123:main');
    });

    it('should build computed fields key for kingdom', () => {
      const result = buildComputedFieldsKey('kingdom', '456', 'main');
      expect(result).toBe('computed-fields:kingdom:456:main');
    });

    it('should build computed fields key for alternate branch', () => {
      const result = buildComputedFieldsKey('settlement', '789', 'alternate-timeline-1');
      expect(result).toBe('computed-fields:settlement:789:alternate-timeline-1');
    });

    it('should build computed fields key for structure', () => {
      const result = buildComputedFieldsKey('structure', 'uuid-abc', 'main');
      expect(result).toBe('computed-fields:structure:uuid-abc:main');
    });
  });

  describe('buildEntityListKey', () => {
    it('should build key for settlements in kingdom', () => {
      const result = buildEntityListKey('settlements', 'kingdom', '456', 'main');
      expect(result).toBe('settlements:kingdom:456:main');
    });

    it('should build key for structures in settlement', () => {
      const result = buildEntityListKey('structures', 'settlement', '123', 'main');
      expect(result).toBe('structures:settlement:123:main');
    });

    it('should build key for entities in alternate branch', () => {
      const result = buildEntityListKey('events', 'campaign', 'c1', 'alternate-timeline-1');
      expect(result).toBe('events:campaign:c1:alternate-timeline-1');
    });

    it('should build key for nested parent-child relationships', () => {
      const result = buildEntityListKey('rooms', 'building', 'b789', 'main');
      expect(result).toBe('rooms:building:b789:main');
    });
  });

  describe('buildSpatialQueryKey', () => {
    it('should build key for settlements in region', () => {
      const result = buildSpatialQueryKey('settlements-in-region', ['789'], 'main');
      expect(result).toBe('spatial:settlements-in-region:789:main');
    });

    it('should build key for entities within bounds', () => {
      const result = buildSpatialQueryKey('entities-within-bounds', ['0,0', '10,10'], 'main');
      expect(result).toBe('spatial:entities-within-bounds:0,0:10,10:main');
    });

    it('should build key with no query parameters', () => {
      const result = buildSpatialQueryKey('all-settlements', [], 'main');
      expect(result).toBe('spatial:all-settlements:main');
    });

    it('should build key with multiple complex parameters', () => {
      const result = buildSpatialQueryKey(
        'intersecting-geometries',
        ['POLYGON((0 0,1 0,1 1,0 1,0 0))', 'settlement', 'kingdom'],
        'main'
      );
      expect(result).toBe(
        'spatial:intersecting-geometries:POLYGON((0 0,1 0,1 1,0 1,0 0)):settlement:kingdom:main'
      );
    });

    it('should build key for spatial query in alternate branch', () => {
      const result = buildSpatialQueryKey(
        'nearby-settlements',
        ['123', '50km'],
        'alternate-timeline-1'
      );
      expect(result).toBe('spatial:nearby-settlements:123:50km:alternate-timeline-1');
    });
  });

  describe('parseCacheKey', () => {
    it('should parse computed fields key', () => {
      const result = parseCacheKey('computed-fields:settlement:123:main');

      expect(result).toEqual({
        prefix: 'computed-fields',
        segments: ['settlement', '123'],
        branchId: 'main',
      });
    });

    it('should parse entity list key', () => {
      const result = parseCacheKey('settlements:kingdom:456:main');

      expect(result).toEqual({
        prefix: 'settlements',
        segments: ['kingdom', '456'],
        branchId: 'main',
      });
    });

    it('should parse spatial query key with multiple segments', () => {
      const result = parseCacheKey('spatial:settlements-in-region:789:extra:main');

      expect(result).toEqual({
        prefix: 'spatial',
        segments: ['settlements-in-region', '789', 'extra'],
        branchId: 'main',
      });
    });

    it('should parse minimal key with only prefix and branchId', () => {
      const result = parseCacheKey('global:main');

      expect(result).toEqual({
        prefix: 'global',
        segments: [],
        branchId: 'main',
      });
    });

    it('should parse key with empty middle segments', () => {
      const result = parseCacheKey('prefix:seg1:seg2:seg3:branchId');

      expect(result).toEqual({
        prefix: 'prefix',
        segments: ['seg1', 'seg2', 'seg3'],
        branchId: 'branchId',
      });
    });

    it('should return null for invalid key with single segment', () => {
      const result = parseCacheKey('invalid');
      expect(result).toBeNull();
    });

    it('should return null for empty key', () => {
      const result = parseCacheKey('');
      expect(result).toBeNull();
    });

    it('should handle key with special characters', () => {
      const result = parseCacheKey('cache-v2.0:entity-type:uuid-abc-123:main');

      expect(result).toEqual({
        prefix: 'cache-v2.0',
        segments: ['entity-type', 'uuid-abc-123'],
        branchId: 'main',
      });
    });

    it('should handle key with alternate branch', () => {
      const result = parseCacheKey('computed-fields:settlement:123:alternate-timeline-1');

      expect(result).toEqual({
        prefix: 'computed-fields',
        segments: ['settlement', '123'],
        branchId: 'alternate-timeline-1',
      });
    });
  });

  describe('Integration: round-trip key building and parsing', () => {
    it('should successfully round-trip computed fields key', () => {
      const originalKey = buildComputedFieldsKey('settlement', '123', 'main');
      const parsed = parseCacheKey(originalKey);

      expect(parsed).not.toBeNull();
      expect(parsed!.prefix).toBe('computed-fields');
      expect(parsed!.segments).toEqual(['settlement', '123']);
      expect(parsed!.branchId).toBe('main');
    });

    it('should successfully round-trip entity list key', () => {
      const originalKey = buildEntityListKey('settlements', 'kingdom', '456', 'main');
      const parsed = parseCacheKey(originalKey);

      expect(parsed).not.toBeNull();
      expect(parsed!.prefix).toBe('settlements');
      expect(parsed!.segments).toEqual(['kingdom', '456']);
      expect(parsed!.branchId).toBe('main');
    });

    it('should successfully round-trip spatial query key', () => {
      const originalKey = buildSpatialQueryKey('entities-within-bounds', ['0,0', '10,10'], 'main');
      const parsed = parseCacheKey(originalKey);

      expect(parsed).not.toBeNull();
      expect(parsed!.prefix).toBe('spatial');
      expect(parsed!.segments).toEqual(['entities-within-bounds', '0,0', '10,10']);
      expect(parsed!.branchId).toBe('main');
    });

    it('should successfully round-trip complex cache key', () => {
      const originalKey = buildCacheKey({
        prefix: 'custom',
        entityType: 'settlement',
        entityId: '999',
        additionalSegments: ['extra', 'data'],
        branchId: 'alternate-timeline-1',
      });
      const parsed = parseCacheKey(originalKey);

      expect(parsed).not.toBeNull();
      expect(parsed!.prefix).toBe('custom');
      expect(parsed!.segments).toEqual(['settlement', '999', 'extra', 'data']);
      expect(parsed!.branchId).toBe('alternate-timeline-1');
    });
  });

  describe('Pattern matching validation', () => {
    it('should generate prefix pattern that matches specific keys', () => {
      const pattern = buildPrefixPattern('computed-fields');
      const key1 = buildComputedFieldsKey('settlement', '123', 'main');
      const key2 = buildComputedFieldsKey('kingdom', '456', 'alternate');

      // Both keys should start with the prefix
      expect(key1).toMatch(/^computed-fields:/);
      expect(key2).toMatch(/^computed-fields:/);
      expect(pattern).toBe('computed-fields:*');
    });

    it('should generate entity pattern that uniquely identifies entity', () => {
      const pattern = buildEntityPattern('settlement', '123', 'main');
      const computedFieldsKey = buildComputedFieldsKey('settlement', '123', 'main');

      // Pattern should match the computed fields key for this entity
      expect(computedFieldsKey).toContain(':settlement:123:main');
      expect(pattern).toBe('*:settlement:123:main');
    });

    it('should generate branch pattern that matches all keys in branch', () => {
      const pattern = buildBranchPattern('main');
      const key1 = buildComputedFieldsKey('settlement', '123', 'main');
      const key2 = buildEntityListKey('settlements', 'kingdom', '456', 'main');
      const key3 = buildSpatialQueryKey('test-query', [], 'main');

      // All keys should end with :main
      expect(key1).toMatch(/:main$/);
      expect(key2).toMatch(/:main$/);
      expect(key3).toMatch(/:main$/);
      expect(pattern).toBe('*:main');
    });

    it('should not match keys from different branches', () => {
      const key1 = buildComputedFieldsKey('settlement', '123', 'main');
      const key2 = buildComputedFieldsKey('settlement', '123', 'alternate');

      expect(key1).not.toBe(key2);
      expect(key1).toMatch(/:main$/);
      expect(key2).toMatch(/:alternate$/);
    });
  });
});
