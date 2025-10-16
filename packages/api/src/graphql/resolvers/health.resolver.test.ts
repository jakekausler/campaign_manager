/**
 * Health Resolver Tests
 * Tests for the GraphQL health check endpoint
 */

import { HealthResolver, HealthCheck } from './health.resolver';

describe('HealthResolver', () => {
  let resolver: HealthResolver;

  beforeEach(() => {
    resolver = new HealthResolver();
  });

  describe('health', () => {
    it('should return health check with status ok', () => {
      const result: HealthCheck = resolver.health();

      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should return a timestamp close to current time', () => {
      const before = new Date();
      const result: HealthCheck = resolver.health();
      const after = new Date();

      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should return version information', () => {
      const result: HealthCheck = resolver.health();

      expect(result.version).toBeDefined();
      expect(typeof result.version).toBe('string');
    });
  });
});
