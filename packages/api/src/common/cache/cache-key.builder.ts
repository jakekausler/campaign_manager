/**
 * Cache key generation utilities
 *
 * Provides functions for building hierarchical, predictable cache keys
 * that support targeted invalidation by prefix patterns.
 *
 * Key Pattern: {prefix}:{entityType}:{entityId}:{branchId}
 * Example: 'computed-fields:settlement:123:main'
 */

import { CacheKeyParams } from './cache.types';

/**
 * Builds a hierarchical cache key from parameters
 *
 * Creates a colon-separated key following the pattern:
 * {prefix}:{entityType}:{entityId}:{branchId}:{additionalSegments}
 *
 * All segments are optional except prefix and branchId, allowing
 * flexible key structures while maintaining hierarchy.
 *
 * @param params - Key generation parameters
 * @returns Fully qualified cache key
 *
 * @example
 * ```typescript
 * // Entity-specific computed fields cache
 * buildCacheKey({
 *   prefix: 'computed-fields',
 *   entityType: 'settlement',
 *   entityId: '123',
 *   branchId: 'main'
 * });
 * // Returns: 'computed-fields:settlement:123:main'
 *
 * // Entity list cache (no entityId)
 * buildCacheKey({
 *   prefix: 'settlements',
 *   entityType: 'kingdom',
 *   entityId: '456',
 *   branchId: 'main'
 * });
 * // Returns: 'settlements:kingdom:456:main'
 *
 * // Spatial query cache with additional segments
 * buildCacheKey({
 *   prefix: 'spatial',
 *   branchId: 'main',
 *   additionalSegments: ['settlements-in-region', '789']
 * });
 * // Returns: 'spatial:settlements-in-region:789:main'
 * ```
 */
export function buildCacheKey(params: CacheKeyParams): string {
  const segments: string[] = [params.prefix];

  // Add entityType and entityId if provided
  if (params.entityType) {
    segments.push(params.entityType);
  }
  if (params.entityId) {
    segments.push(params.entityId);
  }

  // Add any additional segments
  if (params.additionalSegments && params.additionalSegments.length > 0) {
    segments.push(...params.additionalSegments);
  }

  // branchId always comes last to enable branch-level invalidation
  segments.push(params.branchId);

  return segments.join(':');
}

/**
 * Builds a wildcard pattern for deleting keys by prefix
 *
 * Creates a Redis SCAN pattern that matches all keys starting with
 * the given prefix. Useful for invalidating entire cache namespaces.
 *
 * @param prefix - Cache namespace prefix
 * @returns Redis wildcard pattern
 *
 * @example
 * ```typescript
 * buildPrefixPattern('computed-fields');
 * // Returns: 'computed-fields:*'
 *
 * buildPrefixPattern('settlements:kingdom:123');
 * // Returns: 'settlements:kingdom:123:*'
 * ```
 */
export function buildPrefixPattern(prefix: string): string {
  return `${prefix}:*`;
}

/**
 * Builds a pattern for deleting all keys for a specific entity
 *
 * Matches all cache keys for a given entity across all prefixes.
 * Useful for invalidating all cached data related to a specific entity.
 *
 * @param entityType - Type of entity
 * @param entityId - Entity identifier
 * @param branchId - Branch identifier
 * @returns Redis wildcard pattern
 *
 * @example
 * ```typescript
 * buildEntityPattern('settlement', '123', 'main');
 * // Returns: '*:settlement:123:main'
 * ```
 */
export function buildEntityPattern(entityType: string, entityId: string, branchId: string): string {
  return `*:${entityType}:${entityId}:${branchId}`;
}

/**
 * Builds a pattern for deleting all keys for a specific branch
 *
 * Matches all cache keys for a given branch across all prefixes and entities.
 * Critical for branch deletion or branch merging operations.
 *
 * @param branchId - Branch identifier
 * @returns Redis wildcard pattern
 *
 * @example
 * ```typescript
 * buildBranchPattern('alternate-timeline-1');
 * // Returns: '*:alternate-timeline-1'
 * ```
 */
export function buildBranchPattern(branchId: string): string {
  return `*:${branchId}`;
}

/**
 * Builds a cache key specifically for computed fields
 *
 * Convenience function for the most common cache use case.
 * Generates keys following the pattern:
 * 'computed-fields:{entityType}:{entityId}:{branchId}'
 *
 * @param entityType - Type of entity
 * @param entityId - Entity identifier
 * @param branchId - Branch identifier
 * @returns Cache key for computed fields
 *
 * @example
 * ```typescript
 * buildComputedFieldsKey('settlement', '123', 'main');
 * // Returns: 'computed-fields:settlement:123:main'
 * ```
 */
export function buildComputedFieldsKey(
  entityType: string,
  entityId: string,
  branchId: string
): string {
  return buildCacheKey({
    prefix: 'computed-fields',
    entityType,
    entityId,
    branchId,
  });
}

/**
 * Builds a cache key for entity list caches
 *
 * Used for caching lists of child entities (e.g., settlements in a kingdom).
 * Generates keys following the pattern:
 * '{childType}:{parentType}:{parentId}:{branchId}'
 *
 * @param childType - Type of child entities being cached
 * @param parentType - Type of parent entity
 * @param parentId - Parent entity identifier
 * @param branchId - Branch identifier
 * @returns Cache key for entity list
 *
 * @example
 * ```typescript
 * buildEntityListKey('settlements', 'kingdom', '456', 'main');
 * // Returns: 'settlements:kingdom:456:main'
 *
 * buildEntityListKey('structures', 'settlement', '123', 'main');
 * // Returns: 'structures:settlement:123:main'
 * ```
 */
export function buildEntityListKey(
  childType: string,
  parentType: string,
  parentId: string,
  branchId: string
): string {
  return buildCacheKey({
    prefix: childType,
    entityType: parentType,
    entityId: parentId,
    branchId,
  });
}

/**
 * Builds a cache key for spatial query results
 *
 * Used for caching expensive PostGIS spatial queries.
 * Includes query type and serialized parameters to ensure uniqueness.
 *
 * @param queryType - Type of spatial query (e.g., 'settlements-in-region')
 * @param queryParams - Query parameters as string array
 * @param branchId - Branch identifier
 * @returns Cache key for spatial query
 *
 * @example
 * ```typescript
 * buildSpatialQueryKey('settlements-in-region', ['789'], 'main');
 * // Returns: 'spatial:settlements-in-region:789:main'
 *
 * buildSpatialQueryKey('entities-within-bounds', ['0,0', '10,10'], 'main');
 * // Returns: 'spatial:entities-within-bounds:0,0:10,10:main'
 * ```
 */
export function buildSpatialQueryKey(
  queryType: string,
  queryParams: string[],
  branchId: string
): string {
  return buildCacheKey({
    prefix: 'spatial',
    branchId,
    additionalSegments: [queryType, ...queryParams],
  });
}

/**
 * Extracts components from a cache key
 *
 * Parses a cache key back into its constituent parts.
 * Useful for logging, debugging, and understanding cache key structure.
 *
 * Returns null if the key doesn't follow the expected format.
 *
 * @param key - Cache key to parse
 * @returns Parsed key components or null if invalid
 *
 * @example
 * ```typescript
 * parseCacheKey('computed-fields:settlement:123:main');
 * // Returns: {
 * //   prefix: 'computed-fields',
 * //   segments: ['settlement', '123'],
 * //   branchId: 'main'
 * // }
 * ```
 */
export function parseCacheKey(key: string): {
  prefix: string;
  segments: string[];
  branchId: string;
} | null {
  const parts = key.split(':');

  // Minimum valid key: prefix:branchId (2 segments)
  if (parts.length < 2) {
    return null;
  }

  return {
    prefix: parts[0],
    segments: parts.slice(1, -1),
    branchId: parts[parts.length - 1],
  };
}
