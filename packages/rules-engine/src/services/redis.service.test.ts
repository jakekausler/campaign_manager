import { Logger } from '@nestjs/common';
import IoRedis from 'ioredis';
import type Redis from 'ioredis';
import { mockDeep, MockProxy } from 'jest-mock-extended';

import { CacheService } from './cache.service';
import { DependencyGraphService } from './dependency-graph.service';
import { RedisService } from './redis.service';

// Mock ioredis module
jest.mock('ioredis');

describe('RedisService', () => {
  let redisService: RedisService;
  let mockCacheService: MockProxy<CacheService>;
  let mockDependencyGraphService: MockProxy<DependencyGraphService>;
  let mockRedisInstance: MockProxy<Redis>;

  beforeEach(() => {
    // Create mock services
    mockCacheService = mockDeep<CacheService>();
    mockDependencyGraphService = mockDeep<DependencyGraphService>();
    mockRedisInstance = mockDeep<Redis>();

    // Setup Redis mock to return our mock instance
    const RedisMock = jest.mocked(IoRedis);
    RedisMock.mockImplementation(() => mockRedisInstance);

    // Mock Redis status
    mockRedisInstance.status = 'ready';

    // Create service instance
    redisService = new RedisService(mockCacheService, mockDependencyGraphService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should connect to Redis on module initialization', async () => {
      await redisService.onModuleInit();

      // Verify Redis was instantiated
      expect(IoRedis).toHaveBeenCalled();
    });

    it('should subscribe to invalidation channels when Redis is ready', async () => {
      // Setup: make subscribe async work
      mockRedisInstance.subscribe.mockResolvedValue(1);

      await redisService.onModuleInit();

      // Trigger the ready event
      const readyHandler = mockRedisInstance.on.mock.calls.find(
        (call) => call[0] === 'ready'
      )?.[1] as () => Promise<void>;

      if (readyHandler) {
        await readyHandler();
      }

      // Verify all channels were subscribed
      expect(mockRedisInstance.subscribe).toHaveBeenCalledWith(
        'condition.created',
        'condition.updated',
        'condition.deleted',
        'variable.created',
        'variable.updated',
        'variable.deleted'
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from Redis on module destroy', async () => {
      await redisService.onModuleInit();
      await redisService.onModuleDestroy();

      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });

    it('should set isShuttingDown flag to prevent reconnection attempts', async () => {
      await redisService.onModuleInit();

      // Get the retryStrategy function before destroying
      const RedisMock = jest.mocked(IoRedis);
      const constructorCalls = RedisMock.mock.calls;
      expect(constructorCalls.length).toBeGreaterThan(0);

      // @ts-expect-error - TypeScript doesn't know the mock was called with a config object
      const redisConfig: any = constructorCalls[0][0];
      expect(redisConfig).toBeDefined();
      const retryStrategy = redisConfig.retryStrategy as (times: number) => number | null;
      expect(retryStrategy).toBeDefined();

      // Now destroy the service
      await redisService.onModuleDestroy();

      // Call retry strategy and verify it returns null (no retry) after shutdown
      const result = retryStrategy(1);
      expect(result).toBeNull();
    });
  });

  describe('message handling', () => {
    beforeEach(async () => {
      mockRedisInstance.subscribe.mockResolvedValue(1);
      await redisService.onModuleInit();
    });

    const getMessageHandler = () => {
      const messageHandler = mockRedisInstance.on.mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1] as (channel: string, message: string) => void;
      return messageHandler;
    };

    describe('condition.created', () => {
      it('should invalidate dependency graph when condition is created', () => {
        const messageHandler = getMessageHandler();
        const message = JSON.stringify({
          campaignId: 'campaign-123',
          branchId: 'main',
          entityId: 'condition-456',
          timestamp: new Date().toISOString(),
        });

        messageHandler('condition.created', message);

        expect(mockDependencyGraphService.invalidateGraph).toHaveBeenCalledWith(
          'campaign-123',
          'main'
        );
      });

      it('should use default branchId if not provided', () => {
        const messageHandler = getMessageHandler();
        const message = JSON.stringify({
          campaignId: 'campaign-123',
          entityId: 'condition-456',
          timestamp: new Date().toISOString(),
        });

        messageHandler('condition.created', message);

        expect(mockDependencyGraphService.invalidateGraph).toHaveBeenCalledWith(
          'campaign-123',
          'main'
        );
      });
    });

    describe('condition.updated', () => {
      it('should invalidate cache and dependency graph when condition is updated', () => {
        const messageHandler = getMessageHandler();
        const message = JSON.stringify({
          campaignId: 'campaign-123',
          branchId: 'feature',
          entityId: 'condition-456',
          timestamp: new Date().toISOString(),
        });

        messageHandler('condition.updated', message);

        expect(mockCacheService.invalidate).toHaveBeenCalledWith({
          campaignId: 'campaign-123',
          branchId: 'feature',
          nodeId: 'CONDITION:condition-456',
        });
        expect(mockDependencyGraphService.invalidateGraph).toHaveBeenCalledWith(
          'campaign-123',
          'feature'
        );
      });

      it('should not invalidate cache if entityId is missing', () => {
        const messageHandler = getMessageHandler();
        const message = JSON.stringify({
          campaignId: 'campaign-123',
          branchId: 'main',
          timestamp: new Date().toISOString(),
        });

        messageHandler('condition.updated', message);

        expect(mockCacheService.invalidate).not.toHaveBeenCalled();
        expect(mockDependencyGraphService.invalidateGraph).toHaveBeenCalled();
      });
    });

    describe('condition.deleted', () => {
      it('should invalidate cache and dependency graph when condition is deleted', () => {
        const messageHandler = getMessageHandler();
        const message = JSON.stringify({
          campaignId: 'campaign-123',
          branchId: 'main',
          entityId: 'condition-456',
          timestamp: new Date().toISOString(),
        });

        messageHandler('condition.deleted', message);

        expect(mockCacheService.invalidate).toHaveBeenCalledWith({
          campaignId: 'campaign-123',
          branchId: 'main',
          nodeId: 'CONDITION:condition-456',
        });
        expect(mockDependencyGraphService.invalidateGraph).toHaveBeenCalledWith(
          'campaign-123',
          'main'
        );
      });
    });

    describe('variable.created', () => {
      it('should invalidate dependency graph when variable is created', () => {
        const messageHandler = getMessageHandler();
        const message = JSON.stringify({
          campaignId: 'campaign-123',
          branchId: 'main',
          entityId: 'variable-789',
          timestamp: new Date().toISOString(),
        });

        messageHandler('variable.created', message);

        expect(mockDependencyGraphService.invalidateGraph).toHaveBeenCalledWith(
          'campaign-123',
          'main'
        );
      });
    });

    describe('variable.updated', () => {
      it('should invalidate cache by prefix when variable is updated', () => {
        const messageHandler = getMessageHandler();
        const message = JSON.stringify({
          campaignId: 'campaign-123',
          branchId: 'main',
          entityId: 'variable-789',
          timestamp: new Date().toISOString(),
        });

        messageHandler('variable.updated', message);

        expect(mockCacheService.invalidateByPrefix).toHaveBeenCalledWith('campaign-123', 'main');
        // Should NOT rebuild dependency graph for variable updates (only values changed, not structure)
        expect(mockDependencyGraphService.invalidateGraph).not.toHaveBeenCalled();
      });
    });

    describe('variable.deleted', () => {
      it('should invalidate cache and dependency graph when variable is deleted', () => {
        const messageHandler = getMessageHandler();
        const message = JSON.stringify({
          campaignId: 'campaign-123',
          branchId: 'main',
          entityId: 'variable-789',
          timestamp: new Date().toISOString(),
        });

        messageHandler('variable.deleted', message);

        expect(mockCacheService.invalidateByPrefix).toHaveBeenCalledWith('campaign-123', 'main');
        expect(mockDependencyGraphService.invalidateGraph).toHaveBeenCalledWith(
          'campaign-123',
          'main'
        );
      });
    });

    describe('error handling', () => {
      it('should log warning if campaignId is missing', () => {
        const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn');
        const messageHandler = getMessageHandler();
        const message = JSON.stringify({
          entityId: 'condition-456',
          timestamp: new Date().toISOString(),
        });

        messageHandler('condition.created', message);

        expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('missing campaignId'));
        expect(mockDependencyGraphService.invalidateGraph).not.toHaveBeenCalled();
      });

      it('should log error if message is invalid JSON', () => {
        const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error');
        const messageHandler = getMessageHandler();

        messageHandler('condition.created', 'invalid-json{');

        expect(loggerErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error handling message')
        );
      });

      it('should log warning for unknown channel', () => {
        const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn');
        const messageHandler = getMessageHandler();
        const message = JSON.stringify({
          campaignId: 'campaign-123',
          timestamp: new Date().toISOString(),
        });

        messageHandler('unknown.channel', message);

        expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown channel'));
      });
    });
  });

  describe('connection management', () => {
    it('should handle Redis connection errors', async () => {
      const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error');
      await redisService.onModuleInit();

      // Trigger error event
      const errorHandler = mockRedisInstance.on.mock.calls.find(
        (call) => call[0] === 'error'
      )?.[1] as (error: Error) => void;

      if (errorHandler) {
        errorHandler(new Error('Connection failed'));
      }

      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Connection failed'));
    });

    it('should log when connection is established', async () => {
      const loggerLogSpy = jest.spyOn(Logger.prototype, 'log');
      await redisService.onModuleInit();

      // Trigger connect event
      const connectHandler = mockRedisInstance.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1] as () => void;

      if (connectHandler) {
        connectHandler();
      }

      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Connected to Redis successfully')
      );
    });

    it('should warn when connection closes unexpectedly', async () => {
      const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn');
      await redisService.onModuleInit();

      // Trigger close event while not shutting down
      const closeHandler = mockRedisInstance.on.mock.calls.find(
        (call) => call[0] === 'close'
      )?.[1] as () => void;

      if (closeHandler) {
        closeHandler();
      }

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Redis connection closed unexpectedly')
      );
    });

    it('should not warn when connection closes during shutdown', async () => {
      const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn');
      await redisService.onModuleInit();

      // Trigger shutdown
      await redisService.onModuleDestroy();

      // Clear previous calls
      loggerWarnSpy.mockClear();

      // Trigger close event during shutdown
      const closeHandler = mockRedisInstance.on.mock.calls.find(
        (call) => call[0] === 'close'
      )?.[1] as () => void;

      if (closeHandler) {
        closeHandler();
      }

      expect(loggerWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Redis connection closed unexpectedly')
      );
    });
  });

  describe('status methods', () => {
    it('should return connection status', async () => {
      await redisService.onModuleInit();
      mockRedisInstance.status = 'ready';

      expect(redisService.isConnected()).toBe(true);
      expect(redisService.getStatus()).toBe('ready');
    });

    it('should return disconnected status when not connected', async () => {
      await redisService.onModuleInit();
      mockRedisInstance.status = 'end';

      expect(redisService.isConnected()).toBe(false);
      expect(redisService.getStatus()).toBe('end');
    });

    it('should return disconnected when Redis instance is null', () => {
      // Don't initialize
      expect(redisService.getStatus()).toBe('disconnected');
    });
  });

  describe('retry strategy', () => {
    it('should retry connection with exponential backoff up to 10 attempts', async () => {
      await redisService.onModuleInit();

      const RedisMock = jest.mocked(IoRedis);
      // @ts-expect-error - TypeScript doesn't know the mock was called with a config object
      const redisConfig: any = RedisMock.mock.calls[0][0];
      expect(redisConfig).toBeDefined();
      const retryStrategy = redisConfig.retryStrategy as (times: number) => number | null;
      expect(retryStrategy).toBeDefined();

      // Test retry delays (exponential backoff, max delay 10 seconds)
      expect(retryStrategy(1)).toBe(1000); // 1 second
      expect(retryStrategy(2)).toBe(2000); // 2 seconds
      expect(retryStrategy(5)).toBe(5000); // 5 seconds
      expect(retryStrategy(10)).toBe(10000); // Attempt 10: last attempt, max delay (10s)
      // Delay is capped at Math.min(times * 1000, 10000), so large values still return 10000
      // But this only applies while times <= MAX_RECONNECT_ATTEMPTS (10)
      // So attempt 15 would return null (exceeds max attempts)
    });

    it('should stop retrying after max attempts', async () => {
      await redisService.onModuleInit();

      const RedisMock = jest.mocked(IoRedis);
      // @ts-expect-error - TypeScript doesn't know the mock was called with a config object
      const redisConfig: any = RedisMock.mock.calls[0][0];
      expect(redisConfig).toBeDefined();
      const retryStrategy = redisConfig.retryStrategy as (times: number) => number | null;
      expect(retryStrategy).toBeDefined();

      // Should return null after max attempts
      expect(retryStrategy(11)).toBeNull();
    });
  });
});
