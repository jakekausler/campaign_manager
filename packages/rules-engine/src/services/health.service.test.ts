/**
 * Health Service Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { mock, mockDeep, MockProxy } from 'jest-mock-extended';

import { CacheService } from './cache.service';
import { DependencyGraphService } from './dependency-graph.service';
import { HealthService } from './health.service';
import { RedisService } from './redis.service';

// Mock PrismaClient globally
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockDeep<PrismaClient>()),
}));

describe('HealthService', () => {
  let service: HealthService;
  let cacheService: MockProxy<CacheService>;
  let dependencyGraphService: MockProxy<DependencyGraphService>;
  let redisService: MockProxy<RedisService>;
  let prismaClient: MockProxy<PrismaClient>;

  beforeEach(async () => {
    // Create mocks
    cacheService = mock<CacheService>();
    dependencyGraphService = mock<DependencyGraphService>();
    redisService = mock<RedisService>();
    prismaClient = mockDeep<PrismaClient>();

    // Mock PrismaClient constructor
    (PrismaClient as jest.Mock).mockImplementation(() => prismaClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: CacheService,
          useValue: cacheService,
        },
        {
          provide: DependencyGraphService,
          useValue: dependencyGraphService,
        },
        {
          provide: RedisService,
          useValue: redisService,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkLiveness', () => {
    it('should return alive status', async () => {
      const result = await service.checkLiveness();

      expect(result).toEqual({ status: 'alive' });
    });
  });

  describe('checkReadiness', () => {
    it('should return healthy status when all checks pass', async () => {
      // Mock successful checks
      prismaClient.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      redisService.isConnected.mockReturnValue(true);
      cacheService.getStats.mockReturnValue({
        hits: 100,
        misses: 20,
        keys: 50,
        ksize: 1024,
        vsize: 2048,
        hitRate: 0.833,
      });
      dependencyGraphService.getCacheStats.mockReturnValue({
        cachedGraphs: 5,
        cacheKeys: ['campaign:123:branch:main'],
      });

      const result = await service.checkReadiness();

      expect(result.status).toBe('healthy');
      expect(result.checks.database.status).toBe('pass');
      expect(result.checks.redis.status).toBe('pass');
      expect(result.checks.cache.status).toBe('pass');
      expect(result.checks.dependencyGraph.status).toBe('pass');
      expect(result.uptime).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();
    });

    it('should return unhealthy status when database fails', async () => {
      // Mock database failure
      prismaClient.$queryRaw.mockRejectedValue(new Error('Connection refused'));
      redisService.isConnected.mockReturnValue(true);
      cacheService.getStats.mockReturnValue({
        hits: 100,
        misses: 20,
        keys: 50,
        ksize: 1024,
        vsize: 2048,
        hitRate: 0.833,
      });
      dependencyGraphService.getCacheStats.mockReturnValue({
        cachedGraphs: 5,
        cacheKeys: [],
      });

      const result = await service.checkReadiness();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database.status).toBe('fail');
      expect(result.checks.database.message).toContain('Connection refused');
    });

    it('should return degraded status when Redis is disconnected', async () => {
      // Mock Redis disconnected
      prismaClient.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      redisService.isConnected.mockReturnValue(false);
      cacheService.getStats.mockReturnValue({
        hits: 100,
        misses: 20,
        keys: 50,
        ksize: 1024,
        vsize: 2048,
        hitRate: 0.833,
      });
      dependencyGraphService.getCacheStats.mockReturnValue({
        cachedGraphs: 5,
        cacheKeys: [],
      });

      const result = await service.checkReadiness();

      expect(result.status).toBe('degraded');
      expect(result.checks.redis.status).toBe('warn');
      expect(result.checks.redis.message).toContain('not connected');
    });

    it('should return degraded status when cache fails', async () => {
      // Mock cache failure
      prismaClient.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      redisService.isConnected.mockReturnValue(true);
      cacheService.getStats.mockImplementation(() => {
        throw new Error('Cache service error');
      });
      dependencyGraphService.getCacheStats.mockReturnValue({
        cachedGraphs: 5,
        cacheKeys: [],
      });

      const result = await service.checkReadiness();

      expect(result.status).toBe('degraded');
      expect(result.checks.cache.status).toBe('warn');
      expect(result.checks.cache.message).toContain('Cache service error');
    });

    it('should return degraded status when dependency graph fails', async () => {
      // Mock dependency graph failure
      prismaClient.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      redisService.isConnected.mockReturnValue(true);
      cacheService.getStats.mockReturnValue({
        hits: 100,
        misses: 20,
        keys: 50,
        ksize: 1024,
        vsize: 2048,
        hitRate: 0.833,
      });
      dependencyGraphService.getCacheStats.mockImplementation(() => {
        throw new Error('Dependency graph error');
      });

      const result = await service.checkReadiness();

      expect(result.status).toBe('degraded');
      expect(result.checks.dependencyGraph.status).toBe('warn');
      expect(result.checks.dependencyGraph.message).toContain('Dependency graph error');
    });

    it('should include response times for all checks', async () => {
      // Mock successful checks
      prismaClient.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      redisService.isConnected.mockReturnValue(true);
      cacheService.getStats.mockReturnValue({
        hits: 100,
        misses: 20,
        keys: 50,
        ksize: 1024,
        vsize: 2048,
        hitRate: 0.833,
      });
      dependencyGraphService.getCacheStats.mockReturnValue({
        cachedGraphs: 5,
        cacheKeys: [],
      });

      const result = await service.checkReadiness();

      expect(result.checks.database.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.checks.redis.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.checks.cache.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.checks.dependencyGraph.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('checkHealth', () => {
    it('should return the same as checkReadiness', async () => {
      // Mock successful checks
      prismaClient.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      redisService.isConnected.mockReturnValue(true);
      cacheService.getStats.mockReturnValue({
        hits: 100,
        misses: 20,
        keys: 50,
        ksize: 1024,
        vsize: 2048,
        hitRate: 0.833,
      });
      dependencyGraphService.getCacheStats.mockReturnValue({
        cachedGraphs: 5,
        cacheKeys: [],
      });

      const readinessResult = await service.checkReadiness();
      const healthResult = await service.checkHealth();

      // Should have same overall status
      expect(healthResult.status).toBe(readinessResult.status);

      // Should have same check statuses and messages (ignore response times which can vary)
      expect(healthResult.checks.database.status).toBe(readinessResult.checks.database.status);
      expect(healthResult.checks.database.message).toBe(readinessResult.checks.database.message);

      expect(healthResult.checks.redis.status).toBe(readinessResult.checks.redis.status);
      expect(healthResult.checks.redis.message).toBe(readinessResult.checks.redis.message);

      expect(healthResult.checks.cache.status).toBe(readinessResult.checks.cache.status);
      expect(healthResult.checks.cache.message).toBe(readinessResult.checks.cache.message);

      expect(healthResult.checks.dependencyGraph.status).toBe(
        readinessResult.checks.dependencyGraph.status
      );
      expect(healthResult.checks.dependencyGraph.message).toBe(
        readinessResult.checks.dependencyGraph.message
      );

      // Response times should be defined but we don't compare exact values
      expect(healthResult.checks.database.responseTime).toBeGreaterThanOrEqual(0);
      expect(healthResult.checks.redis.responseTime).toBeGreaterThanOrEqual(0);
      expect(healthResult.checks.cache.responseTime).toBeGreaterThanOrEqual(0);
      expect(healthResult.checks.dependencyGraph.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect Prisma client on module destroy', async () => {
      await service.onModuleDestroy();

      expect(prismaClient.$disconnect).toHaveBeenCalledTimes(1);
    });
  });
});
