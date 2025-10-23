import { getQueueToken } from '@nestjs/bull';
import { Test, TestingModule } from '@nestjs/testing';

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
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: getQueueToken('health-check'),
          useValue: mockQueue,
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
    expect(result).toHaveProperty('redis');
  });

  it('should return healthy status when Redis is connected', async () => {
    const result = await controller.check();

    expect(result.status).toBe('healthy');
    expect(result.redis).toBe('connected');
  });

  it('should include timestamp in ISO format', async () => {
    const result = await controller.check();

    expect(result.timestamp).toBeDefined();
    expect(() => new Date(result.timestamp)).not.toThrow();
  });
});
