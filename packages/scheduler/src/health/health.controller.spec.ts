import { getQueueToken } from '@nestjs/bull';
import { Test, TestingModule } from '@nestjs/testing';

import { ApiClientService } from '../api/api-client.service';
import { RedisSubscriberService } from '../redis/redis-subscriber.service';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    // Mock Bull Queue with Redis client
    const mockQueue = {
      client: {
        ping: jest.fn().mockResolvedValue('PONG'),
      },
      getActiveCount: jest.fn().mockResolvedValue(0),
      getWaitingCount: jest.fn().mockResolvedValue(0),
      getDelayedCount: jest.fn().mockResolvedValue(0),
      getFailedCount: jest.fn().mockResolvedValue(0),
    };

    const mockRedisSubscriber = {
      isConnected: jest.fn().mockReturnValue(true),
    };

    const mockApiClient = {
      getAllCampaignIds: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: getQueueToken('health-check'),
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

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health status', async () => {
    const result = await controller.check();

    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('components');
    expect(result.components).toHaveProperty('redis');
  });

  it('should return healthy status when Redis is connected', async () => {
    const result = await controller.check();

    expect(result.status).toBe('healthy');
    expect(result.components.redis.status).toBe('up');
  });

  it('should include timestamp in ISO format', async () => {
    const result = await controller.check();

    expect(result.timestamp).toBeDefined();
    expect(() => new Date(result.timestamp)).not.toThrow();
  });
});
