import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bull';

import { ApiClientService } from '../api/api-client.service';
import { RedisSubscriberService } from '../redis/redis-subscriber.service';

import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let mockQueue: jest.Mocked<Partial<Queue>>;
  let mockRedisSubscriber: jest.Mocked<Partial<RedisSubscriberService>>;
  let mockApiClient: jest.Mocked<Partial<ApiClientService>>;

  beforeEach(async () => {
    mockQueue = {
      client: {
        ping: jest.fn().mockResolvedValue('PONG'),
      } as any,
      getActiveCount: jest.fn().mockResolvedValue(2),
      getWaitingCount: jest.fn().mockResolvedValue(5),
      getDelayedCount: jest.fn().mockResolvedValue(1),
      getFailedCount: jest.fn().mockResolvedValue(0),
    };

    mockRedisSubscriber = {
      isConnected: jest.fn().mockReturnValue(true),
    };

    mockApiClient = {
      getAllCampaignIds: jest.fn().mockResolvedValue(['campaign-1', 'campaign-2']),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: 'BullQueue_health-check',
          useValue: mockQueue,
        },
        {
          provide: RedisSubscriberService,
          useValue: mockRedisSubscriber,
        },
        {
          provide: ApiClientService,
          useValue: mockApiClient,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('check', () => {
    it('should return healthy status when all components are up', async () => {
      const result = await service.check();

      expect(result.status).toBe('healthy');
      expect(result.components.redis.status).toBe('up');
      expect(result.components.redisSubscriber.status).toBe('up');
      expect(result.components.bullQueue.status).toBe('up');
      expect(result.components.api.status).toBe('up');
      expect(result.version).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status when Redis is down', async () => {
      mockQueue.client!.ping = jest.fn().mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.check();

      expect(result.status).toBe('unhealthy');
      expect(result.components.redis.status).toBe('down');
    });

    it('should return unhealthy status when Redis subscriber is down', async () => {
      mockRedisSubscriber.isConnected = jest.fn().mockReturnValue(false);

      const result = await service.check();

      expect(result.status).toBe('unhealthy');
      expect(result.components.redisSubscriber.status).toBe('down');
    });

    it('should return unhealthy status when API is down', async () => {
      mockApiClient.getAllCampaignIds = jest
        .fn()
        .mockRejectedValue(new Error('API connection failed'));

      const result = await service.check();

      expect(result.status).toBe('unhealthy');
      expect(result.components.api.status).toBe('down');
    });

    it('should return degraded status when Bull queue has high failure rate', async () => {
      mockQueue.getFailedCount = jest.fn().mockResolvedValue(10); // 10 failed out of 18 total = 55%

      const result = await service.check();

      expect(result.status).toBe('degraded');
      expect(result.components.bullQueue.status).toBe('degraded');
    });

    it('should include latency information for Redis and API', async () => {
      const result = await service.check();

      expect(result.components.redis.message).toMatch(/latency: \d+ms/);
      expect(result.components.api.message).toMatch(/latency: \d+ms/);
    });

    it('should include job counts in Bull queue message', async () => {
      const result = await service.check();

      expect(result.components.bullQueue.message).toContain('Active: 2');
      expect(result.components.bullQueue.message).toContain('Waiting: 5');
      expect(result.components.bullQueue.message).toContain('Delayed: 1');
      expect(result.components.bullQueue.message).toContain('Failed: 0');
    });
  });
});
