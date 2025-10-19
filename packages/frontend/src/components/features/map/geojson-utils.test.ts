import { describe, it, expect } from 'vitest';

import {
  createLocationPointFeature,
  createLocationRegionFeature,
  createSettlementFeature,
  createStructureFeature,
  filterValidFeatures,
} from './geojson-utils';

describe('geojson-utils', () => {
  describe('createLocationPointFeature', () => {
    it('should create a valid location point feature', () => {
      const location = {
        id: 'loc-1',
        name: 'Test Location',
        description: 'A test location',
        worldId: 'world-1',
        longitude: -122.4194,
        latitude: 37.7749,
      };

      const feature = createLocationPointFeature(location);

      expect(feature).not.toBeNull();
      expect(feature?.type).toBe('Feature');
      expect(feature?.geometry.type).toBe('Point');
      expect(feature?.geometry.coordinates).toEqual([-122.4194, 37.7749]);
      expect(feature?.properties.type).toBe('location-point');
      expect(feature?.properties.id).toBe('loc-1');
      expect(feature?.properties.name).toBe('Test Location');
      expect(feature?.properties.description).toBe('A test location');
      expect(feature?.properties.worldId).toBe('world-1');
    });

    it('should handle location without description', () => {
      const location = {
        id: 'loc-2',
        name: 'No Description',
        worldId: 'world-1',
        longitude: 0,
        latitude: 0,
      };

      const feature = createLocationPointFeature(location);

      expect(feature).not.toBeNull();
      expect(feature?.properties.description).toBeUndefined();
    });

    it('should return null for missing longitude', () => {
      const location = {
        id: 'loc-3',
        name: 'Missing Longitude',
        worldId: 'world-1',
        longitude: null as unknown as number,
        latitude: 37.7749,
      };

      const feature = createLocationPointFeature(location);

      expect(feature).toBeNull();
    });

    it('should return null for missing latitude', () => {
      const location = {
        id: 'loc-4',
        name: 'Missing Latitude',
        worldId: 'world-1',
        longitude: -122.4194,
        latitude: undefined as unknown as number,
      };

      const feature = createLocationPointFeature(location);

      expect(feature).toBeNull();
    });

    it('should return null for NaN coordinates', () => {
      const location = {
        id: 'loc-5',
        name: 'NaN Coordinates',
        worldId: 'world-1',
        longitude: NaN,
        latitude: 37.7749,
      };

      const feature = createLocationPointFeature(location);

      expect(feature).toBeNull();
    });

    it('should return null for Infinity coordinates', () => {
      const location = {
        id: 'loc-6',
        name: 'Infinity Coordinates',
        worldId: 'world-1',
        longitude: -122.4194,
        latitude: Infinity,
      };

      const feature = createLocationPointFeature(location);

      expect(feature).toBeNull();
    });

    it('should handle zero coordinates', () => {
      const location = {
        id: 'loc-7',
        name: 'Zero Coordinates',
        worldId: 'world-1',
        longitude: 0,
        latitude: 0,
      };

      const feature = createLocationPointFeature(location);

      expect(feature).not.toBeNull();
      expect(feature?.geometry.coordinates).toEqual([0, 0]);
    });
  });

  describe('createLocationRegionFeature', () => {
    it('should create a valid location region feature', () => {
      const location = {
        id: 'region-1',
        name: 'Test Region',
        description: 'A test region',
        worldId: 'world-1',
        rings: [
          [
            [-122.4, 37.7],
            [-122.5, 37.8],
            [-122.3, 37.9],
            [-122.4, 37.7], // Close the ring
          ],
        ],
      };

      const feature = createLocationRegionFeature(location);

      expect(feature).not.toBeNull();
      expect(feature?.type).toBe('Feature');
      expect(feature?.geometry.type).toBe('Polygon');
      expect(feature?.geometry.coordinates).toEqual(location.rings);
      expect(feature?.properties.type).toBe('location-region');
      expect(feature?.properties.id).toBe('region-1');
      expect(feature?.properties.name).toBe('Test Region');
    });

    it('should handle polygon with holes', () => {
      const location = {
        id: 'region-2',
        name: 'Region with Holes',
        worldId: 'world-1',
        rings: [
          // Outer ring
          [
            [-122.5, 37.7],
            [-122.5, 37.9],
            [-122.3, 37.9],
            [-122.3, 37.7],
            [-122.5, 37.7],
          ],
          // Hole
          [
            [-122.45, 37.75],
            [-122.45, 37.85],
            [-122.35, 37.85],
            [-122.35, 37.75],
            [-122.45, 37.75],
          ],
        ],
      };

      const feature = createLocationRegionFeature(location);

      expect(feature).not.toBeNull();
      expect(feature?.geometry.coordinates).toHaveLength(2);
    });

    it('should return null for empty rings array', () => {
      const location = {
        id: 'region-3',
        name: 'Empty Rings',
        worldId: 'world-1',
        rings: [],
      };

      const feature = createLocationRegionFeature(location);

      expect(feature).toBeNull();
    });

    it('should return null for missing rings', () => {
      const location = {
        id: 'region-4',
        name: 'Missing Rings',
        worldId: 'world-1',
        rings: null as unknown as number[][][],
      };

      const feature = createLocationRegionFeature(location);

      expect(feature).toBeNull();
    });

    it('should return null for ring with too few coordinates', () => {
      const location = {
        id: 'region-5',
        name: 'Invalid Ring',
        worldId: 'world-1',
        rings: [
          [
            [-122.4, 37.7],
            [-122.5, 37.8],
            // Missing third coordinate (polygons need at least 3)
          ],
        ],
      };

      const feature = createLocationRegionFeature(location);

      expect(feature).toBeNull();
    });
  });

  describe('createSettlementFeature', () => {
    it('should create a valid settlement feature', () => {
      const settlement = {
        id: 'settlement-1',
        name: 'Test Settlement',
        level: 2,
        kingdomId: 'kingdom-1',
        locationId: 'loc-1',
        typedVariables: { population: 1000, wealth: 500 },
        location: {
          longitude: -122.4194,
          latitude: 37.7749,
        },
      };

      const feature = createSettlementFeature(settlement);

      expect(feature).not.toBeNull();
      expect(feature?.type).toBe('Feature');
      expect(feature?.geometry.type).toBe('Point');
      expect(feature?.geometry.coordinates).toEqual([-122.4194, 37.7749]);
      expect(feature?.properties.type).toBe('settlement');
      expect(feature?.properties.id).toBe('settlement-1');
      expect(feature?.properties.name).toBe('Test Settlement');
      expect(feature?.properties.level).toBe(2);
      expect(feature?.properties.kingdomId).toBe('kingdom-1');
      expect(feature?.properties.locationId).toBe('loc-1');
      expect(feature?.properties.typedVariables).toEqual({ population: 1000, wealth: 500 });
    });

    it('should handle settlement without kingdom', () => {
      const settlement = {
        id: 'settlement-2',
        name: 'Independent Settlement',
        level: 1,
        locationId: 'loc-2',
        location: {
          longitude: 0,
          latitude: 0,
        },
      };

      const feature = createSettlementFeature(settlement);

      expect(feature).not.toBeNull();
      expect(feature?.properties.kingdomId).toBeUndefined();
    });

    it('should handle settlement without typed variables', () => {
      const settlement = {
        id: 'settlement-3',
        name: 'No Variables',
        level: 1,
        locationId: 'loc-3',
        location: {
          longitude: 0,
          latitude: 0,
        },
      };

      const feature = createSettlementFeature(settlement);

      expect(feature).not.toBeNull();
      expect(feature?.properties.typedVariables).toBeUndefined();
    });

    it('should return null for missing location', () => {
      const settlement = {
        id: 'settlement-4',
        name: 'Missing Location',
        level: 1,
        locationId: 'loc-4',
        location: null as unknown as { longitude: number; latitude: number },
      };

      const feature = createSettlementFeature(settlement);

      expect(feature).toBeNull();
    });

    it('should return null for invalid location coordinates', () => {
      const settlement = {
        id: 'settlement-5',
        name: 'Invalid Coordinates',
        level: 1,
        locationId: 'loc-5',
        location: {
          longitude: NaN,
          latitude: 37.7749,
        },
      };

      const feature = createSettlementFeature(settlement);

      expect(feature).toBeNull();
    });
  });

  describe('createStructureFeature', () => {
    it('should create a valid structure feature', () => {
      const structure = {
        id: 'structure-1',
        name: 'Test Structure',
        structureType: 'fort',
        level: 3,
        settlementId: 'settlement-1',
        locationId: 'loc-1',
        typedVariables: { defense: 50, garrison: 100 },
        location: {
          longitude: -122.4194,
          latitude: 37.7749,
        },
      };

      const feature = createStructureFeature(structure);

      expect(feature).not.toBeNull();
      expect(feature?.type).toBe('Feature');
      expect(feature?.geometry.type).toBe('Point');
      expect(feature?.geometry.coordinates).toEqual([-122.4194, 37.7749]);
      expect(feature?.properties.type).toBe('structure');
      expect(feature?.properties.id).toBe('structure-1');
      expect(feature?.properties.name).toBe('Test Structure');
      expect(feature?.properties.structureType).toBe('fort');
      expect(feature?.properties.level).toBe(3);
      expect(feature?.properties.settlementId).toBe('settlement-1');
      expect(feature?.properties.locationId).toBe('loc-1');
      expect(feature?.properties.typedVariables).toEqual({ defense: 50, garrison: 100 });
    });

    it('should handle structure without settlement', () => {
      const structure = {
        id: 'structure-2',
        name: 'Independent Structure',
        structureType: 'tower',
        level: 1,
        locationId: 'loc-2',
        location: {
          longitude: 0,
          latitude: 0,
        },
      };

      const feature = createStructureFeature(structure);

      expect(feature).not.toBeNull();
      expect(feature?.properties.settlementId).toBeUndefined();
    });

    it('should handle structure without typed variables', () => {
      const structure = {
        id: 'structure-3',
        name: 'No Variables',
        structureType: 'wall',
        level: 1,
        locationId: 'loc-3',
        location: {
          longitude: 0,
          latitude: 0,
        },
      };

      const feature = createStructureFeature(structure);

      expect(feature).not.toBeNull();
      expect(feature?.properties.typedVariables).toBeUndefined();
    });

    it('should return null for missing location', () => {
      const structure = {
        id: 'structure-4',
        name: 'Missing Location',
        structureType: 'gate',
        level: 1,
        locationId: 'loc-4',
        location: null as unknown as { longitude: number; latitude: number },
      };

      const feature = createStructureFeature(structure);

      expect(feature).toBeNull();
    });

    it('should return null for invalid location coordinates', () => {
      const structure = {
        id: 'structure-5',
        name: 'Invalid Coordinates',
        structureType: 'keep',
        level: 2,
        locationId: 'loc-5',
        location: {
          longitude: -122.4194,
          latitude: Infinity,
        },
      };

      const feature = createStructureFeature(structure);

      expect(feature).toBeNull();
    });
  });

  describe('filterValidFeatures', () => {
    it('should filter out null features', () => {
      const features = [
        createLocationPointFeature({
          id: 'loc-1',
          name: 'Valid',
          worldId: 'world-1',
          longitude: 0,
          latitude: 0,
        }),
        null,
        createLocationPointFeature({
          id: 'loc-2',
          name: 'Also Valid',
          worldId: 'world-1',
          longitude: 1,
          latitude: 1,
        }),
        null,
      ];

      const filtered = filterValidFeatures(features);

      expect(filtered).toHaveLength(2);
      expect(filtered[0]?.properties.id).toBe('loc-1');
      expect(filtered[1]?.properties.id).toBe('loc-2');
    });

    it('should return empty array when all features are null', () => {
      const features = [null, null, null];

      const filtered = filterValidFeatures(features);

      expect(filtered).toHaveLength(0);
    });

    it('should return all features when none are null', () => {
      const features = [
        createLocationPointFeature({
          id: 'loc-1',
          name: 'Valid',
          worldId: 'world-1',
          longitude: 0,
          latitude: 0,
        }),
        createLocationPointFeature({
          id: 'loc-2',
          name: 'Also Valid',
          worldId: 'world-1',
          longitude: 1,
          latitude: 1,
        }),
      ];

      const filtered = filterValidFeatures(features);

      expect(filtered).toHaveLength(2);
    });

    it('should handle empty array', () => {
      const features: (null | never)[] = [];

      const filtered = filterValidFeatures(features);

      expect(filtered).toHaveLength(0);
    });
  });
});
