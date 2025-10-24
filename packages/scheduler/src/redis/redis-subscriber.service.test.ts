/**
 * Unit tests for RedisSubscriberService
 */

import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';

import { ConfigService } from '../config/config.service';
import { JobPriority, JobType } from '../queue/job.interface';
import { QueueService } from '../queue/queue.service';

import { RedisSubscriberService } from './redis-subscriber.service';
import {
  EntityModifiedMessage,
  EntityOperation,
  EntityType,
  RedisChannels,
  WorldTimeAdvancedMessage,
} from './types';

// Mock ioredis
jest.mock('ioredis');

describe('RedisSubscriberService', () => {
  let service: RedisSubscriberService;
  let configService: jest.Mocked<ConfigService>;
  let queueService: jest.Mocked<QueueService>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(async () => {
    // Create mock services
    configService = {
      redisUrl: 'redis://localhost:6379',
    } as jest.Mocked<ConfigService>;

    queueService = {
      addJob: jest.fn().mockResolvedValue('job-id'),
    } as unknown as jest.Mocked<QueueService>;

    // Create mock Redis instance
    mockRedis = {
      on: jest.fn().mockReturnThis(),
      psubscribe: jest.fn().mockResolvedValue(undefined),
      punsubscribe: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      status: 'ready',
    } as unknown as jest.Mocked<Redis>;

    // Mock Redis constructor
    (Redis as unknown as jest.Mock).mockImplementation(() => mockRedis);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisSubscriberService,
        { provide: ConfigService, useValue: configService },
        { provide: QueueService, useValue: queueService },
      ],
    }).compile();

    service = module.get<RedisSubscriberService>(RedisSubscriberService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should create Redis connection on module init', async () => {
      await service.onModuleInit();

      expect(Redis).toHaveBeenCalledWith(configService.redisUrl, expect.any(Object));
      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('pmessage', expect.any(Function));
    });

    it('should subscribe to channel patterns on connection', async () => {
      await service.onModuleInit();

      expect(mockRedis.psubscribe).toHaveBeenCalledWith(RedisChannels.allWorldTimeAdvanced);
      expect(mockRedis.psubscribe).toHaveBeenCalledWith(RedisChannels.allEntityModified);
    });

    it('should report connected status when Redis is ready', async () => {
      await service.onModuleInit();
      expect(service.isConnected()).toBe(true);
    });
  });

  describe('shutdown', () => {
    it('should unsubscribe and disconnect on module destroy', async () => {
      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockRedis.punsubscribe).toHaveBeenCalled();
      expect(mockRedis.disconnect).toHaveBeenCalled();
    });

    it('should not attempt reconnection after shutdown', async () => {
      await service.onModuleInit();

      // Trigger disconnect event
      const closeHandler = mockRedis.on.mock.calls.find((call) => call[0] === 'close')?.[1];
      expect(closeHandler).toBeDefined();

      await service.onModuleDestroy();

      // Now trigger close event - should not attempt reconnect
      if (closeHandler) {
        closeHandler();
      }

      // Wait a bit to ensure no reconnection attempt
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Redis constructor should only have been called once (initial connection)
      expect(Redis).toHaveBeenCalledTimes(1);
    });
  });

  describe('worldTimeAdvanced message handling', () => {
    let messageHandler: (pattern: string, channel: string, message: string) => void;

    beforeEach(async () => {
      await service.onModuleInit();

      // Extract the pmessage handler
      const pmessageCall = mockRedis.on.mock.calls.find((call) => call[0] === 'pmessage');
      messageHandler = pmessageCall?.[1] as (
        pattern: string,
        channel: string,
        message: string
      ) => void;
      expect(messageHandler).toBeDefined();
    });

    it('should queue event expiration job with HIGH priority', async () => {
      const message: WorldTimeAdvancedMessage = {
        campaignId: 'campaign-123',
        previousTime: '2025-01-01T00:00:00Z',
        newTime: '2025-01-01T01:00:00Z',
      };

      messageHandler(
        RedisChannels.allWorldTimeAdvanced,
        'campaign.campaign-123.worldTimeAdvanced',
        JSON.stringify(message)
      );

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      expect(queueService.addJob).toHaveBeenCalledWith({
        type: JobType.EVENT_EXPIRATION,
        campaignId: 'campaign-123',
        priority: JobPriority.HIGH,
      });
    });

    it('should recalculate settlement schedules', async () => {
      const message: WorldTimeAdvancedMessage = {
        campaignId: 'campaign-123',
        previousTime: '2025-01-01T00:00:00Z',
        newTime: '2025-01-01T01:00:00Z',
      };

      messageHandler(
        RedisChannels.allWorldTimeAdvanced,
        'campaign.campaign-123.worldTimeAdvanced',
        JSON.stringify(message)
      );

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      // Should queue three jobs: event expiration, settlement schedules, structure schedules
      expect(queueService.addJob).toHaveBeenCalledTimes(3);
      expect(queueService.addJob).toHaveBeenCalledWith({
        type: JobType.RECALCULATE_SETTLEMENT_SCHEDULES,
        campaignId: 'campaign-123',
        priority: JobPriority.NORMAL,
      });
    });

    it('should recalculate structure schedules', async () => {
      const message: WorldTimeAdvancedMessage = {
        campaignId: 'campaign-123',
        previousTime: '2025-01-01T00:00:00Z',
        newTime: '2025-01-01T01:00:00Z',
      };

      messageHandler(
        RedisChannels.allWorldTimeAdvanced,
        'campaign.campaign-123.worldTimeAdvanced',
        JSON.stringify(message)
      );

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      expect(queueService.addJob).toHaveBeenCalled();
    });

    it('should handle invalid JSON gracefully', async () => {
      messageHandler(
        RedisChannels.allWorldTimeAdvanced,
        'campaign.campaign-123.worldTimeAdvanced',
        'invalid-json'
      );

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      // Should not throw, and should not call any services
      expect(queueService.addJob).not.toHaveBeenCalled();
      expect(queueService.addJob).not.toHaveBeenCalled();
    });

    it('should continue processing if queue job fails', async () => {
      queueService.addJob.mockRejectedValueOnce(new Error('Queue error'));

      const message: WorldTimeAdvancedMessage = {
        campaignId: 'campaign-123',
        previousTime: '2025-01-01T00:00:00Z',
        newTime: '2025-01-01T01:00:00Z',
      };

      messageHandler(
        RedisChannels.allWorldTimeAdvanced,
        'campaign.campaign-123.worldTimeAdvanced',
        JSON.stringify(message)
      );

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      // Should not throw, service should remain operational
      expect(queueService.addJob).toHaveBeenCalled();
    });
  });

  describe('entityModified message handling - Settlement', () => {
    let messageHandler: (pattern: string, channel: string, message: string) => void;

    beforeEach(async () => {
      await service.onModuleInit();

      // Extract the pmessage handler
      const pmessageCall = mockRedis.on.mock.calls.find((call) => call[0] === 'pmessage');
      messageHandler = pmessageCall?.[1] as (
        pattern: string,
        channel: string,
        message: string
      ) => void;
      expect(messageHandler).toBeDefined();
    });

    it('should update settlement schedules on CREATE', async () => {
      const message: EntityModifiedMessage = {
        campaignId: 'campaign-123',
        entityType: EntityType.SETTLEMENT,
        entityId: 'settlement-456',
        operation: EntityOperation.CREATE,
      };

      messageHandler(
        RedisChannels.allEntityModified,
        'campaign.campaign-123.entityModified',
        JSON.stringify(message)
      );

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      expect(queueService.addJob).toHaveBeenCalled();
    });

    it('should update settlement schedules on UPDATE', async () => {
      const message: EntityModifiedMessage = {
        campaignId: 'campaign-123',
        entityType: EntityType.SETTLEMENT,
        entityId: 'settlement-456',
        operation: EntityOperation.UPDATE,
      };

      messageHandler(
        RedisChannels.allEntityModified,
        'campaign.campaign-123.entityModified',
        JSON.stringify(message)
      );

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      expect(queueService.addJob).toHaveBeenCalled();
    });

    it('should skip scheduling on DELETE', async () => {
      const message: EntityModifiedMessage = {
        campaignId: 'campaign-123',
        entityType: EntityType.SETTLEMENT,
        entityId: 'settlement-456',
        operation: EntityOperation.DELETE,
      };

      messageHandler(
        RedisChannels.allEntityModified,
        'campaign.campaign-123.entityModified',
        JSON.stringify(message)
      );

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      expect(queueService.addJob).not.toHaveBeenCalled();
    });
  });

  describe('entityModified message handling - Structure', () => {
    let messageHandler: (pattern: string, channel: string, message: string) => void;

    beforeEach(async () => {
      await service.onModuleInit();

      // Extract the pmessage handler
      const pmessageCall = mockRedis.on.mock.calls.find((call) => call[0] === 'pmessage');
      messageHandler = pmessageCall?.[1] as (
        pattern: string,
        channel: string,
        message: string
      ) => void;
      expect(messageHandler).toBeDefined();
    });

    it('should update structure schedules on CREATE', async () => {
      const message: EntityModifiedMessage = {
        campaignId: 'campaign-123',
        entityType: EntityType.STRUCTURE,
        entityId: 'structure-789',
        operation: EntityOperation.CREATE,
      };

      messageHandler(
        RedisChannels.allEntityModified,
        'campaign.campaign-123.entityModified',
        JSON.stringify(message)
      );

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      expect(queueService.addJob).toHaveBeenCalled();
    });

    it('should update structure schedules on UPDATE', async () => {
      const message: EntityModifiedMessage = {
        campaignId: 'campaign-123',
        entityType: EntityType.STRUCTURE,
        entityId: 'structure-789',
        operation: EntityOperation.UPDATE,
      };

      messageHandler(
        RedisChannels.allEntityModified,
        'campaign.campaign-123.entityModified',
        JSON.stringify(message)
      );

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      expect(queueService.addJob).toHaveBeenCalled();
    });

    it('should skip scheduling on DELETE', async () => {
      const message: EntityModifiedMessage = {
        campaignId: 'campaign-123',
        entityType: EntityType.STRUCTURE,
        entityId: 'structure-789',
        operation: EntityOperation.DELETE,
      };

      messageHandler(
        RedisChannels.allEntityModified,
        'campaign.campaign-123.entityModified',
        JSON.stringify(message)
      );

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      expect(queueService.addJob).not.toHaveBeenCalled();
    });
  });

  describe('entityModified message handling - Event and Encounter', () => {
    let messageHandler: (pattern: string, channel: string, message: string) => void;

    beforeEach(async () => {
      await service.onModuleInit();

      // Extract the pmessage handler
      const pmessageCall = mockRedis.on.mock.calls.find((call) => call[0] === 'pmessage');
      messageHandler = pmessageCall?.[1] as (
        pattern: string,
        channel: string,
        message: string
      ) => void;
      expect(messageHandler).toBeDefined();
    });

    it('should not trigger immediate action for Event modifications', async () => {
      const message: EntityModifiedMessage = {
        campaignId: 'campaign-123',
        entityType: EntityType.EVENT,
        entityId: 'event-999',
        operation: EntityOperation.UPDATE,
      };

      messageHandler(
        RedisChannels.allEntityModified,
        'campaign.campaign-123.entityModified',
        JSON.stringify(message)
      );

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      // Event modifications are handled by expiration check, not immediately
      expect(queueService.addJob).not.toHaveBeenCalled();
      expect(queueService.addJob).not.toHaveBeenCalled();
    });

    it('should not trigger immediate action for Encounter modifications', async () => {
      const message: EntityModifiedMessage = {
        campaignId: 'campaign-123',
        entityType: EntityType.ENCOUNTER,
        entityId: 'encounter-888',
        operation: EntityOperation.UPDATE,
      };

      messageHandler(
        RedisChannels.allEntityModified,
        'campaign.campaign-123.entityModified',
        JSON.stringify(message)
      );

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      // Encounter modifications are handled by expiration check, not immediately
      expect(queueService.addJob).not.toHaveBeenCalled();
      expect(queueService.addJob).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    let messageHandler: (pattern: string, channel: string, message: string) => void;

    beforeEach(async () => {
      await service.onModuleInit();

      // Extract the pmessage handler
      const pmessageCall = mockRedis.on.mock.calls.find((call) => call[0] === 'pmessage');
      messageHandler = pmessageCall?.[1] as (
        pattern: string,
        channel: string,
        message: string
      ) => void;
      expect(messageHandler).toBeDefined();
    });

    it('should queue settlement and structure recalculation jobs on world time advance', async () => {
      const message: WorldTimeAdvancedMessage = {
        campaignId: 'campaign-123',
        previousTime: '2025-01-01T00:00:00Z',
        newTime: '2025-01-01T01:00:00Z',
      };

      messageHandler(
        RedisChannels.allWorldTimeAdvanced,
        'campaign.campaign-123.worldTimeAdvanced',
        JSON.stringify(message)
      );

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      // Should queue three jobs: event expiration, settlement schedules, structure schedules
      expect(queueService.addJob).toHaveBeenCalledTimes(3);
      expect(queueService.addJob).toHaveBeenCalledWith({
        type: JobType.EVENT_EXPIRATION,
        campaignId: 'campaign-123',
        priority: JobPriority.HIGH,
      });
      expect(queueService.addJob).toHaveBeenCalledWith({
        type: JobType.RECALCULATE_SETTLEMENT_SCHEDULES,
        campaignId: 'campaign-123',
        priority: JobPriority.NORMAL,
      });
      expect(queueService.addJob).toHaveBeenCalledWith({
        type: JobType.RECALCULATE_STRUCTURE_SCHEDULES,
        campaignId: 'campaign-123',
        priority: JobPriority.NORMAL,
      });
    });

    it('should respect cooldown period for rapid world time advances', async () => {
      const message: WorldTimeAdvancedMessage = {
        campaignId: 'campaign-123',
        previousTime: '2025-01-01T00:00:00Z',
        newTime: '2025-01-01T01:00:00Z',
      };

      // First message should queue jobs
      messageHandler(
        RedisChannels.allWorldTimeAdvanced,
        'campaign.campaign-123.worldTimeAdvanced',
        JSON.stringify(message)
      );

      await new Promise((resolve) => setImmediate(resolve));
      expect(queueService.addJob).toHaveBeenCalledTimes(3);

      queueService.addJob.mockClear();

      // Second message within cooldown period should be skipped
      messageHandler(
        RedisChannels.allWorldTimeAdvanced,
        'campaign.campaign-123.worldTimeAdvanced',
        JSON.stringify(message)
      );

      await new Promise((resolve) => setImmediate(resolve));
      expect(queueService.addJob).not.toHaveBeenCalled();
    });

    it('should handle unknown channel patterns', async () => {
      messageHandler('unknown.pattern', 'unknown.channel', JSON.stringify({ data: 'test' }));

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      // Should not throw, and should not call any services
      expect(queueService.addJob).not.toHaveBeenCalled();
      expect(queueService.addJob).not.toHaveBeenCalled();
    });
  });

  describe('reconnection logic', () => {
    it('should attempt reconnection on disconnect', async () => {
      await service.onModuleInit();

      // Extract the close handler
      const closeHandler = mockRedis.on.mock.calls.find((call) => call[0] === 'close')?.[1];
      expect(closeHandler).toBeDefined();

      // Clear the initial constructor call
      jest.clearAllMocks();

      // Trigger disconnect
      if (closeHandler) {
        closeHandler();
      }

      // Wait for reconnection attempt (1 second backoff)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should have attempted to create new Redis connection
      expect(Redis).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff for reconnection attempts', async () => {
      await service.onModuleInit();

      // Extract the close handler
      const closeHandler = mockRedis.on.mock.calls.find((call) => call[0] === 'close')?.[1];
      expect(closeHandler).toBeDefined();

      jest.clearAllMocks();

      // Trigger multiple disconnects
      if (closeHandler) {
        closeHandler(); // Attempt 1: 1s backoff
        await new Promise((resolve) => setTimeout(resolve, 1100));

        closeHandler(); // Attempt 2: 2s backoff
        await new Promise((resolve) => setTimeout(resolve, 2100));

        closeHandler(); // Attempt 3: 4s backoff
      }

      // Should have attempted multiple reconnections
      expect(Redis).toHaveBeenCalledTimes(2); // First two attempts should have completed
    });

    it('should track reconnection attempts', async () => {
      await service.onModuleInit();

      // Initial state: 0 attempts
      expect(service.getReconnectAttempts()).toBe(0);

      // Extract the close handler
      const closeHandler = mockRedis.on.mock.calls.find((call) => call[0] === 'close')?.[1];

      // Trigger disconnect
      if (closeHandler) {
        closeHandler();
      }

      // Should increment attempt counter
      expect(service.getReconnectAttempts()).toBe(1);
    });

    it('should reset reconnection attempts on successful connection', async () => {
      await service.onModuleInit();

      // Extract handlers
      const closeHandler = mockRedis.on.mock.calls.find((call) => call[0] === 'close')?.[1];
      const readyHandler = mockRedis.on.mock.calls.find((call) => call[0] === 'ready')?.[1];

      // Trigger disconnect and reconnect
      if (closeHandler && readyHandler) {
        closeHandler(); // Increment to 1
        expect(service.getReconnectAttempts()).toBe(1);

        readyHandler(); // Should reset to 0
        expect(service.getReconnectAttempts()).toBe(0);
      }
    });

    it('should stop reconnecting after max attempts', async () => {
      await service.onModuleInit();

      // Extract the close handler
      const closeHandler = mockRedis.on.mock.calls.find((call) => call[0] === 'close')?.[1];

      jest.clearAllMocks();

      // Trigger max reconnection attempts (10)
      // We'll simulate this by calling the handler 10 times and using fake timers
      jest.useFakeTimers();

      if (closeHandler) {
        for (let i = 0; i < 10; i++) {
          closeHandler();
          // Fast-forward time for the backoff
          const backoffMs = Math.min(1000 * Math.pow(2, i), 512000);
          jest.advanceTimersByTime(backoffMs + 100);
        }

        // Clear calls from reconnection attempts
        jest.clearAllMocks();

        // One more disconnect - should NOT trigger reconnection
        closeHandler();
        jest.advanceTimersByTime(1100);
      }

      jest.useRealTimers();

      // Should not have attempted any more reconnections
      expect(Redis).not.toHaveBeenCalled();
    }, 10000);
  });

  describe('connection status', () => {
    it('should report not connected when subscriber is null', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should report connected when Redis status is ready', async () => {
      mockRedis.status = 'ready';
      await service.onModuleInit();
      expect(service.isConnected()).toBe(true);
    });

    it('should report not connected when Redis status is not ready', async () => {
      mockRedis.status = 'connecting';
      await service.onModuleInit();
      expect(service.isConnected()).toBe(false);
    });
  });
});
