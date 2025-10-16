/**
 * Tile Cache Service Tests
 * Unit tests for in-memory tile caching
 */

import type { GeoJSONFeatureCollection } from '@campaign/shared';

import { TileCacheService } from './tile-cache.service';

describe('TileCacheService', () => {
  let service: TileCacheService;

  beforeEach(() => {
    service = new TileCacheService();
  });

  describe('generateTileKey', () => {
    it('should generate consistent key from bounding box', () => {
      const bbox = { west: -122.5, south: 37.7, east: -122.4, north: 37.8 };
      const key1 = service.generateTileKey('world-123', bbox);
      const key2 = service.generateTileKey('world-123', bbox);

      expect(key1).toBe(key2);
      expect(key1).toContain('world-123');
    });

    it('should generate different keys for different bounding boxes', () => {
      const bbox1 = { west: -122.5, south: 37.7, east: -122.4, north: 37.8 };
      const bbox2 = { west: -122.6, south: 37.6, east: -122.5, north: 37.7 };
      const key1 = service.generateTileKey('world-123', bbox1);
      const key2 = service.generateTileKey('world-123', bbox2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different worlds', () => {
      const bbox = { west: -122.5, south: 37.7, east: -122.4, north: 37.8 };
      const key1 = service.generateTileKey('world-123', bbox);
      const key2 = service.generateTileKey('world-456', bbox);

      expect(key1).not.toBe(key2);
    });

    it('should include filters in key when provided', () => {
      const bbox = { west: -122.5, south: 37.7, east: -122.4, north: 37.8 };
      const filters = { locationTypes: ['city', 'region'] };
      const key1 = service.generateTileKey('world-123', bbox);
      const key2 = service.generateTileKey('world-123', bbox, filters);

      expect(key1).not.toBe(key2);
    });
  });

  describe('get and set', () => {
    it('should return null for non-existent cache key', () => {
      const key = 'nonexistent-key';
      const result = service.get(key);

      expect(result).toBeNull();
    });

    it('should cache and retrieve GeoJSON FeatureCollection', () => {
      const key = 'test-key';
      const featureCollection: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'loc-1',
            geometry: { type: 'Point', coordinates: [-122.5, 37.7] },
            properties: { name: 'Test Location' },
          },
        ],
      };

      service.set(key, featureCollection);
      const result = service.get(key);

      expect(result).toEqual(featureCollection);
    });

    it('should overwrite existing cache entry', () => {
      const key = 'test-key';
      const fc1: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };
      const fc2: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'loc-1',
            geometry: { type: 'Point', coordinates: [-122.5, 37.7] },
            properties: { name: 'Updated' },
          },
        ],
      };

      service.set(key, fc1);
      service.set(key, fc2);
      const result = service.get(key);

      expect(result).toEqual(fc2);
    });
  });

  describe('invalidate', () => {
    it('should remove single cache entry by key', () => {
      const key = 'test-key';
      const featureCollection: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };

      service.set(key, featureCollection);
      expect(service.get(key)).toEqual(featureCollection);

      service.invalidate(key);
      expect(service.get(key)).toBeNull();
    });

    it('should be idempotent (invalidating non-existent key does not error)', () => {
      expect(() => service.invalidate('nonexistent-key')).not.toThrow();
    });
  });

  describe('invalidateWorld', () => {
    it('should invalidate all cache entries for a world', () => {
      const bbox1 = { west: -122.5, south: 37.7, east: -122.4, north: 37.8 };
      const bbox2 = { west: -122.6, south: 37.6, east: -122.5, north: 37.7 };
      const fc: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };

      const key1 = service.generateTileKey('world-123', bbox1);
      const key2 = service.generateTileKey('world-123', bbox2);
      const key3 = service.generateTileKey('world-456', bbox1);

      service.set(key1, fc);
      service.set(key2, fc);
      service.set(key3, fc);

      service.invalidateWorld('world-123');

      // world-123 cache entries should be invalidated
      expect(service.get(key1)).toBeNull();
      expect(service.get(key2)).toBeNull();

      // world-456 cache entry should remain
      expect(service.get(key3)).toEqual(fc);
    });

    it('should handle invalidating world with no cache entries', () => {
      expect(() => service.invalidateWorld('world-999')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear entire cache', () => {
      const bbox1 = { west: -122.5, south: 37.7, east: -122.4, north: 37.8 };
      const bbox2 = { west: -122.6, south: 37.6, east: -122.5, north: 37.7 };
      const fc: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };

      const key1 = service.generateTileKey('world-123', bbox1);
      const key2 = service.generateTileKey('world-456', bbox2);

      service.set(key1, fc);
      service.set(key2, fc);

      service.clear();

      expect(service.get(key1)).toBeNull();
      expect(service.get(key2)).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const bbox = { west: -122.5, south: 37.7, east: -122.4, north: 37.8 };
      const fc: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };

      const key = service.generateTileKey('world-123', bbox);
      service.set(key, fc);

      const stats = service.getStats();

      expect(stats.size).toBe(1);
      expect(stats.keys).toContain(key);
    });

    it('should return zero size for empty cache', () => {
      const stats = service.getStats();

      expect(stats.size).toBe(0);
      expect(stats.keys).toHaveLength(0);
    });
  });
});
