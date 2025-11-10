/**
 * @fileoverview Tile Cache Service - In-memory caching for map tile GeoJSON FeatureCollections
 *
 * Provides high-performance in-memory caching for map tiles to reduce database queries
 * and improve map rendering performance. Supports cache invalidation at the world level
 * to maintain data consistency when locations or settlements are updated.
 *
 * Key Features:
 * - Bounding box-based tile caching with coordinate precision handling
 * - Optional filter support for location type filtering
 * - World-level cache invalidation for data consistency
 * - Cache statistics for monitoring memory usage
 *
 * Cache Key Format:
 * world:<worldId>:bbox:<west>,<south>,<east>,<north>[:filters:<serialized>]
 *
 * NOTE: This implementation has no size limits or TTL. For production use,
 * consider adding LRU eviction or TTL-based expiration to prevent unbounded
 * memory growth.
 *
 * @module TileCacheService
 * @since 1.0.0
 */

import { Injectable } from '@nestjs/common';

import type { BoundingBox, GeoJSONFeatureCollection } from '@campaign/shared';

/**
 * Map filter options for cache key generation
 *
 * Used to generate unique cache keys when filtering map tiles by entity types.
 */
export interface MapFilters {
  /**
   * Optional array of location type strings to filter by
   * Examples: ['city', 'town', 'village']
   */
  locationTypes?: string[];
}

/**
 * Cache statistics for monitoring
 *
 * Provides insight into cache memory usage and key distribution.
 */
export interface CacheStats {
  /**
   * Total number of cached entries
   */
  size: number;

  /**
   * Array of all cache keys currently stored
   * Useful for debugging and cache analysis
   */
  keys: string[];
}

/**
 * Tile Cache Service
 *
 * Provides in-memory caching for map tiles (GeoJSON FeatureCollections) with
 * world-based invalidation support. This service is designed to reduce database
 * queries for frequently accessed map regions and improve map rendering performance.
 *
 * Architecture:
 * - Uses JavaScript Map for O(1) cache lookups
 * - Cache keys encode world, bounding box, and optional filters
 * - Coordinates rounded to 6 decimal places (~0.1m precision) for consistent keys
 * - World-level invalidation ensures data consistency after mutations
 *
 * Performance Considerations:
 * - No size limits: Unbounded memory growth possible
 * - No TTL: Entries persist until explicit invalidation
 * - No LRU eviction: Consider adding for production use
 * - String-based keys: Fast hashing but verbose for debugging
 *
 * Usage Example:
 * ```typescript
 * const key = tileCacheService.generateTileKey(worldId, bbox, { locationTypes: ['city'] });
 * const cached = tileCacheService.get(key);
 * if (!cached) {
 *   const data = await fetchFromDatabase();
 *   tileCacheService.set(key, data);
 * }
 * ```
 *
 * @class TileCacheService
 * @injectable
 */
@Injectable()
export class TileCacheService {
  /**
   * Internal cache storage mapping cache keys to GeoJSON FeatureCollections
   * @private
   */
  private cache: Map<string, GeoJSONFeatureCollection> = new Map();

  /**
   * Generate a deterministic cache key from world ID, bounding box, and filters
   *
   * Creates a unique string key that encodes all parameters affecting the cached
   * tile data. Coordinates are rounded to 6 decimal places to handle floating-point
   * precision issues and ensure consistent keys for effectively identical bounding boxes.
   *
   * Key Format:
   * - Base: `world:<worldId>:bbox:<west>,<south>,<east>,<north>`
   * - With filters: `world:<worldId>:bbox:<west>,<south>,<east>,<north>:filters:<json>`
   *
   * @param worldId - The unique identifier of the world
   * @param bbox - The bounding box defining the tile region
   * @param filters - Optional filters for location types or other criteria
   * @returns A deterministic string cache key
   *
   * @example
   * ```typescript
   * const key = generateTileKey('world-123', {
   *   west: -122.5, south: 37.7, east: -122.3, north: 37.8
   * });
   * // Returns: "world:world-123:bbox:-122.500000,37.700000,-122.300000,37.800000"
   *
   * const keyWithFilters = generateTileKey('world-123', bbox, {
   *   locationTypes: ['city', 'town']
   * });
   * // Returns: "world:world-123:bbox:...:filters:{\"locationTypes\":[\"city\",\"town\"]}"
   * ```
   */
  generateTileKey(worldId: string, bbox: BoundingBox, filters?: MapFilters): string {
    // Round coordinates to 6 decimal places to handle floating-point precision
    const w = bbox.west.toFixed(6);
    const s = bbox.south.toFixed(6);
    const e = bbox.east.toFixed(6);
    const n = bbox.north.toFixed(6);

    let key = `world:${worldId}:bbox:${w},${s},${e},${n}`;

    // Include filters in key if provided
    if (filters) {
      const filterStr = JSON.stringify(filters);
      key += `:filters:${filterStr}`;
    }

    return key;
  }

  /**
   * Retrieve a cached GeoJSON FeatureCollection by cache key
   *
   * Performs an O(1) lookup in the internal Map. Returns null if the key
   * does not exist in the cache, indicating a cache miss.
   *
   * @param key - The cache key generated by generateTileKey()
   * @returns The cached GeoJSON FeatureCollection, or null if not found
   *
   * @example
   * ```typescript
   * const key = tileCacheService.generateTileKey(worldId, bbox);
   * const cached = tileCacheService.get(key);
   * if (cached) {
   *   return cached; // Cache hit
   * } else {
   *   // Cache miss - fetch from database
   * }
   * ```
   */
  get(key: string): GeoJSONFeatureCollection | null {
    return this.cache.get(key) || null;
  }

  /**
   * Store a GeoJSON FeatureCollection in the cache
   *
   * Adds or updates the cache entry for the given key. If the key already exists,
   * the old value is replaced. This operation is O(1).
   *
   * Note: There are no size limits or TTL, so cached entries will persist until
   * explicitly invalidated or the service is restarted.
   *
   * @param key - The cache key generated by generateTileKey()
   * @param featureCollection - The GeoJSON FeatureCollection to cache
   * @returns void
   *
   * @example
   * ```typescript
   * const key = tileCacheService.generateTileKey(worldId, bbox, filters);
   * const data = await fetchTileDataFromDatabase(worldId, bbox, filters);
   * tileCacheService.set(key, data);
   * ```
   */
  set(key: string, featureCollection: GeoJSONFeatureCollection): void {
    this.cache.set(key, featureCollection);
  }

  /**
   * Invalidate a specific cache entry by key
   *
   * Removes the cache entry for the given key. This is typically used for
   * fine-grained cache invalidation when a specific tile's data changes.
   * This operation is O(1).
   *
   * If the key does not exist, this operation is a no-op (no error thrown).
   *
   * @param key - The cache key to invalidate
   * @returns void
   *
   * @example
   * ```typescript
   * const key = tileCacheService.generateTileKey(worldId, bbox);
   * tileCacheService.invalidate(key); // Remove specific tile from cache
   * ```
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries for a specific world
   *
   * Removes all cached tiles belonging to the specified world by matching the
   * cache key prefix. This is the primary cache invalidation strategy when
   * locations, settlements, or other map features are created, updated, or
   * deleted within a world.
   *
   * This operation is O(n) where n is the total number of cached entries, as it
   * must iterate through all keys to find matches. JavaScript Maps support safe
   * deletion during iteration.
   *
   * Use Cases:
   * - After creating/updating/deleting locations or settlements
   * - After bulk imports of map data
   * - After world configuration changes affecting map rendering
   * - When resolving events that modify world state
   *
   * @param worldId - The unique identifier of the world to invalidate
   * @returns void
   *
   * @example
   * ```typescript
   * // After creating a new location in a world
   * await locationService.create(worldId, locationData);
   * tileCacheService.invalidateWorld(worldId); // Invalidate all tiles for this world
   *
   * // After bulk update
   * await locationService.bulkUpdate(worldId, updates);
   * tileCacheService.invalidateWorld(worldId);
   * ```
   */
  invalidateWorld(worldId: string): void {
    const prefix = `world:${worldId}:`;

    // Delete matching keys in single iteration (safe to delete while iterating Map)
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear the entire cache
   *
   * Removes all cached entries across all worlds. This is a destructive operation
   * typically used during testing, debugging, or emergency cache purges. This
   * operation is O(1).
   *
   * Consider using invalidateWorld() for more targeted cache invalidation in
   * production scenarios.
   *
   * @returns void
   *
   * @example
   * ```typescript
   * // During testing
   * beforeEach(() => {
   *   tileCacheService.clear(); // Clean slate for each test
   * });
   *
   * // Emergency cache purge
   * tileCacheService.clear();
   * ```
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Retrieve cache statistics for monitoring and debugging
   *
   * Returns current cache size and all cache keys. Useful for monitoring
   * memory usage, debugging cache behavior, and analyzing cache hit patterns.
   *
   * Warning: Calling this method with a large cache can be memory-intensive,
   * as it creates an array copy of all cache keys. Use judiciously in production.
   *
   * @returns Cache statistics including size and all cache keys
   *
   * @example
   * ```typescript
   * const stats = tileCacheService.getStats();
   * console.log(`Cache size: ${stats.size} entries`);
   * console.log(`Cache keys:`, stats.keys);
   *
   * // Check if specific world has cached tiles
   * const worldKeys = stats.keys.filter(k => k.startsWith('world:world-123:'));
   * console.log(`Tiles cached for world-123: ${worldKeys.length}`);
   * ```
   */
  getStats(): CacheStats {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
