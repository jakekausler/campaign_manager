/**
 * Spatial Operators Tests
 */

import { MockSpatialService } from './__mocks__/spatial.service.mock';
import { createInsideOperator, createDistanceFromOperator } from './spatial.operators';

describe('Spatial Operators', () => {
  let spatialService: MockSpatialService;

  beforeEach(() => {
    spatialService = new MockSpatialService();

    // Set up test data
    spatialService.addLocation('castle', { x: 100, y: 100 });
    spatialService.addLocation('village', { x: 50, y: 50 });
    spatialService.addLocation('forest', { x: 200, y: 200 });

    spatialService.addRegion('kingdom', {
      points: [
        { x: 0, y: 0 },
        { x: 150, y: 0 },
        { x: 150, y: 150 },
        { x: 0, y: 150 },
      ],
    });
    spatialService.addRegion('wilderness', {
      points: [
        { x: 150, y: 150 },
        { x: 250, y: 150 },
        { x: 250, y: 250 },
        { x: 150, y: 250 },
      ],
    });
  });

  afterEach(() => {
    spatialService.clear();
  });

  describe('inside operator', () => {
    it('should create operator with correct name and description', () => {
      const operator = createInsideOperator(spatialService);

      expect(operator.name).toBe('inside');
      expect(operator.description).toBe('Check if a location is inside a region');
      expect(operator.implementation).toBeInstanceOf(Function);
    });

    it('should return true when location is inside region', () => {
      const operator = createInsideOperator(spatialService);

      const result = operator.implementation('castle', 'kingdom');

      expect(result).toBe(true);
    });

    it('should return true when location is inside different region', () => {
      const operator = createInsideOperator(spatialService);

      const result = operator.implementation('forest', 'wilderness');

      expect(result).toBe(true);
    });

    it('should return false when location is outside region', () => {
      const operator = createInsideOperator(spatialService);

      const result = operator.implementation('forest', 'kingdom');

      expect(result).toBe(false);
    });

    it('should return false for non-existent location', () => {
      const operator = createInsideOperator(spatialService);

      const result = operator.implementation('unknown', 'kingdom');

      expect(result).toBe(false);
    });

    it('should return false for non-existent region', () => {
      const operator = createInsideOperator(spatialService);

      const result = operator.implementation('castle', 'unknown');

      expect(result).toBe(false);
    });

    it('should return false when locationId is not a string', () => {
      const operator = createInsideOperator(spatialService);

      const result = operator.implementation(123, 'kingdom');

      expect(result).toBe(false);
    });

    it('should return false when regionId is not a string', () => {
      const operator = createInsideOperator(spatialService);

      const result = operator.implementation('castle', 456);

      expect(result).toBe(false);
    });

    it('should return false when both arguments are invalid', () => {
      const operator = createInsideOperator(spatialService);

      const result = operator.implementation(null, undefined);

      expect(result).toBe(false);
    });
  });

  describe('distanceFrom operator', () => {
    it('should create operator with correct name and description', () => {
      const operator = createDistanceFromOperator(spatialService);

      expect(operator.name).toBe('distanceFrom');
      expect(operator.description).toBe('Calculate distance between current location and target');
      expect(operator.implementation).toBeInstanceOf(Function);
    });

    it('should calculate distance between two locations', () => {
      const operator = createDistanceFromOperator(spatialService);

      const result = operator.implementation('castle', 'village');

      // Distance from (100, 100) to (50, 50)
      // sqrt((100-50)^2 + (100-50)^2) = sqrt(2500 + 2500) = sqrt(5000) ≈ 70.71
      expect(result).toBeCloseTo(70.71, 2);
    });

    it('should calculate distance to different location', () => {
      const operator = createDistanceFromOperator(spatialService);

      const result = operator.implementation('village', 'forest');

      // Distance from (50, 50) to (200, 200)
      // sqrt((200-50)^2 + (200-50)^2) = sqrt(22500 + 22500) = sqrt(45000) ≈ 212.13
      expect(result).toBeCloseTo(212.13, 2);
    });

    it('should return 0 for distance from location to itself', () => {
      const operator = createDistanceFromOperator(spatialService);

      const result = operator.implementation('castle', 'castle');

      expect(result).toBe(0);
    });

    it('should return null for non-existent current location', () => {
      const operator = createDistanceFromOperator(spatialService);

      const result = operator.implementation('unknown', 'castle');

      expect(result).toBeNull();
    });

    it('should return null for non-existent target location', () => {
      const operator = createDistanceFromOperator(spatialService);

      const result = operator.implementation('castle', 'unknown');

      expect(result).toBeNull();
    });

    it('should return null when currentLocationId is not a string', () => {
      const operator = createDistanceFromOperator(spatialService);

      const result = operator.implementation(123, 'castle');

      expect(result).toBeNull();
    });

    it('should return null when targetLocationId is not a string', () => {
      const operator = createDistanceFromOperator(spatialService);

      const result = operator.implementation('castle', 456);

      expect(result).toBeNull();
    });

    it('should return null when both arguments are invalid', () => {
      const operator = createDistanceFromOperator(spatialService);

      const result = operator.implementation(null, undefined);

      expect(result).toBeNull();
    });
  });
});
