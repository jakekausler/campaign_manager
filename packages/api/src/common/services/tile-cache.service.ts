/**
 * Tile Cache Service
 * In-memory caching for map tile GeoJSON FeatureCollections
 */

import { Injectable } from '@nestjs/common';

import type { BoundingBox, GeoJSONFeatureCollection } from '@campaign/shared';

/**
 * Map filter options for cache key generation
 */
export interface MapFilters {
  locationTypes?: string[];
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  size: number;
  keys: string[];
}

/**
 * TileCacheService
 * Provides in-memory caching for map tiles (GeoJSON FeatureCollections)
 * with world-based invalidation support
 *
 * NOTE: This implementation has no size limits or TTL. For production use,
 * consider adding LRU eviction or TTL-based expiration to prevent unbounded
 * memory growth. Cache invalidation relies on explicit world-level invalidation
 * when data changes.
 */
@Injectable()
export class TileCacheService {
  private cache: Map<string, GeoJSONFeatureCollection> = new Map();

  /**
   * Generate cache key from worldId, bounding box, and optional filters
   * Format: world:<worldId>:bbox:<west>,<south>,<east>,<north>[:filters:<serialized>]
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
   * Get cached FeatureCollection by key
   * Returns null if not found
   */
  get(key: string): GeoJSONFeatureCollection | null {
    return this.cache.get(key) || null;
  }

  /**
   * Store FeatureCollection in cache
   */
  set(key: string, featureCollection: GeoJSONFeatureCollection): void {
    this.cache.set(key, featureCollection);
  }

  /**
   * Invalidate specific cache entry by key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries for a specific world
   * Useful when locations/settlements in a world are updated
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
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): CacheStats {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
