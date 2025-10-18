import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { mockDeep } from 'jest-mock-extended';

import { CacheService } from './cache.service';
import { DependencyGraphBuilderService } from './dependency-graph-builder.service';
import { DependencyGraphService } from './dependency-graph.service';
import { RedisService } from './redis.service';

/**
 * Integration tests for Redis pub/sub invalidation flow.
 *
 * These tests use a real Redis instance to verify end-to-end pub/sub communication.
 * They test the complete invalidation workflow from message publication to cache/graph invalidation.
 *
 * Prerequisites:
 * - Redis server must be running on localhost:6379
 * - Use REDIS_HOST and REDIS_PORT environment variables to override
 *
 * NOTE: These tests are skipped by default to avoid requiring Redis in CI.
 * To run these tests locally, remove the .skip and ensure Redis is running.
 */
describe.skip('Redis Pub/Sub Integration', () => {
  let redisService: RedisService;
  let cacheService: CacheService;
  let dependencyGraphService: DependencyGraphService;
  let publisherClient: Redis;

  const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

  beforeAll(async () => {
    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();

    // Create publisher client for sending test messages
    publisherClient = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
    });

    // Create real service instances
    cacheService = new CacheService();
    // Mock the graph builder service since we're only testing pub/sub
    const mockGraphBuilder = mockDeep<DependencyGraphBuilderService>();
    dependencyGraphService = new DependencyGraphService(mockGraphBuilder);

    redisService = new RedisService(cacheService, dependencyGraphService);

    // Initialize Redis subscriber
    await redisService.onModuleInit();

    // Wait for Redis to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Cleanup
    await redisService.onModuleDestroy();
    await publisherClient.quit();
  });

  beforeEach(() => {
    // Clear cache before each test
    cacheService.clear();
    jest.clearAllMocks();
  });

  describe('condition.created event', () => {
    it('should invalidate dependency graph when condition.created is published', async () => {
      const invalidateGraphSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      const message = JSON.stringify({
        campaignId: 'campaign-123',
        branchId: 'main',
        entityId: 'condition-456',
        timestamp: new Date().toISOString(),
      });

      // Publish message
      await publisherClient.publish('condition.created', message);

      // Wait for message to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify dependency graph was invalidated
      expect(invalidateGraphSpy).toHaveBeenCalledWith('campaign-123', 'main');
    });
  });

  describe('condition.updated event', () => {
    it('should invalidate cache and dependency graph when condition.updated is published', async () => {
      const invalidateSpy = jest.spyOn(cacheService, 'invalidate');
      const invalidateGraphSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      // Pre-populate cache with a condition result
      cacheService.set(
        { campaignId: 'campaign-123', branchId: 'main', nodeId: 'CONDITION:condition-456' },
        { value: true }
      );

      expect(
        cacheService.has({
          campaignId: 'campaign-123',
          branchId: 'main',
          nodeId: 'CONDITION:condition-456',
        })
      ).toBe(true);

      const message = JSON.stringify({
        campaignId: 'campaign-123',
        branchId: 'main',
        entityId: 'condition-456',
        timestamp: new Date().toISOString(),
      });

      // Publish message
      await publisherClient.publish('condition.updated', message);

      // Wait for message to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify cache was invalidated
      expect(invalidateSpy).toHaveBeenCalledWith({
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:condition-456',
      });

      // Verify dependency graph was invalidated
      expect(invalidateGraphSpy).toHaveBeenCalledWith('campaign-123', 'main');

      // Verify cache entry was actually removed
      expect(
        cacheService.has({
          campaignId: 'campaign-123',
          branchId: 'main',
          nodeId: 'CONDITION:condition-456',
        })
      ).toBe(false);
    });
  });

  describe('condition.deleted event', () => {
    it('should invalidate cache and dependency graph when condition.deleted is published', async () => {
      const invalidateSpy = jest.spyOn(cacheService, 'invalidate');
      const invalidateGraphSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      const message = JSON.stringify({
        campaignId: 'campaign-123',
        branchId: 'main',
        entityId: 'condition-456',
        timestamp: new Date().toISOString(),
      });

      // Publish message
      await publisherClient.publish('condition.deleted', message);

      // Wait for message to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify invalidations
      expect(invalidateSpy).toHaveBeenCalledWith({
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:condition-456',
      });
      expect(invalidateGraphSpy).toHaveBeenCalledWith('campaign-123', 'main');
    });
  });

  describe('variable.created event', () => {
    it('should invalidate dependency graph when variable.created is published', async () => {
      const invalidateGraphSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      const message = JSON.stringify({
        campaignId: 'campaign-123',
        branchId: 'main',
        entityId: 'variable-789',
        timestamp: new Date().toISOString(),
      });

      // Publish message
      await publisherClient.publish('variable.created', message);

      // Wait for message to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify dependency graph was invalidated
      expect(invalidateGraphSpy).toHaveBeenCalledWith('campaign-123', 'main');
    });
  });

  describe('variable.updated event', () => {
    it('should invalidate all cache entries for campaign/branch when variable.updated is published', async () => {
      const invalidateByPrefixSpy = jest.spyOn(cacheService, 'invalidateByPrefix');
      const invalidateGraphSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      // Pre-populate cache with multiple condition results
      cacheService.set(
        { campaignId: 'campaign-123', branchId: 'main', nodeId: 'CONDITION:cond-1' },
        { value: true }
      );
      cacheService.set(
        { campaignId: 'campaign-123', branchId: 'main', nodeId: 'CONDITION:cond-2' },
        { value: false }
      );
      cacheService.set(
        { campaignId: 'campaign-456', branchId: 'main', nodeId: 'CONDITION:cond-3' },
        { value: true }
      );

      expect(cacheService.keysByPrefix('campaign-123', 'main')).toHaveLength(2);

      const message = JSON.stringify({
        campaignId: 'campaign-123',
        branchId: 'main',
        entityId: 'variable-789',
        timestamp: new Date().toISOString(),
      });

      // Publish message
      await publisherClient.publish('variable.updated', message);

      // Wait for message to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify cache was invalidated by prefix
      expect(invalidateByPrefixSpy).toHaveBeenCalledWith('campaign-123', 'main');

      // Verify only campaign-123:main entries were removed
      expect(cacheService.keysByPrefix('campaign-123', 'main')).toHaveLength(0);
      expect(cacheService.keysByPrefix('campaign-456', 'main')).toHaveLength(1);

      // Verify dependency graph was NOT invalidated (only values changed, not structure)
      expect(invalidateGraphSpy).not.toHaveBeenCalled();
    });
  });

  describe('variable.deleted event', () => {
    it('should invalidate cache and dependency graph when variable.deleted is published', async () => {
      const invalidateByPrefixSpy = jest.spyOn(cacheService, 'invalidateByPrefix');
      const invalidateGraphSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      const message = JSON.stringify({
        campaignId: 'campaign-123',
        branchId: 'main',
        entityId: 'variable-789',
        timestamp: new Date().toISOString(),
      });

      // Publish message
      await publisherClient.publish('variable.deleted', message);

      // Wait for message to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify invalidations
      expect(invalidateByPrefixSpy).toHaveBeenCalledWith('campaign-123', 'main');
      expect(invalidateGraphSpy).toHaveBeenCalledWith('campaign-123', 'main');
    });
  });

  describe('multiple campaigns', () => {
    it('should only invalidate caches for the specific campaign/branch', async () => {
      // Pre-populate cache with entries for multiple campaigns/branches
      cacheService.set(
        { campaignId: 'campaign-123', branchId: 'main', nodeId: 'CONDITION:cond-1' },
        { value: true }
      );
      cacheService.set(
        { campaignId: 'campaign-123', branchId: 'feature', nodeId: 'CONDITION:cond-2' },
        { value: true }
      );
      cacheService.set(
        { campaignId: 'campaign-456', branchId: 'main', nodeId: 'CONDITION:cond-3' },
        { value: true }
      );

      const message = JSON.stringify({
        campaignId: 'campaign-123',
        branchId: 'main',
        entityId: 'variable-789',
        timestamp: new Date().toISOString(),
      });

      // Publish variable.updated message
      await publisherClient.publish('variable.updated', message);

      // Wait for message to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify only campaign-123:main was invalidated
      expect(cacheService.keysByPrefix('campaign-123', 'main')).toHaveLength(0);
      expect(cacheService.keysByPrefix('campaign-123', 'feature')).toHaveLength(1);
      expect(cacheService.keysByPrefix('campaign-456', 'main')).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should handle messages with missing campaignId gracefully', async () => {
      const invalidateGraphSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      const message = JSON.stringify({
        entityId: 'condition-456',
        timestamp: new Date().toISOString(),
      });

      // Publish message
      await publisherClient.publish('condition.created', message);

      // Wait for message to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify no invalidation occurred
      expect(invalidateGraphSpy).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON messages gracefully', async () => {
      const invalidateGraphSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      // Publish invalid JSON
      await publisherClient.publish('condition.created', 'invalid-json{');

      // Wait for message to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify no invalidation occurred
      expect(invalidateGraphSpy).not.toHaveBeenCalled();
    });
  });

  describe('connection resilience', () => {
    it('should report connection status', () => {
      expect(redisService.isConnected()).toBe(true);
      expect(redisService.getStatus()).toBe('ready');
    });
  });
});
