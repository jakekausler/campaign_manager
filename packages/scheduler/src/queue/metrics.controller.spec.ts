/**
 * MetricsController Tests
 */

import { Test, TestingModule } from '@nestjs/testing';

import { HealthService } from '../health/health.service';

import { DeadLetterService } from './dead-letter.service';
import { MetricsController } from './metrics.controller';
import { QueueService } from './queue.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  let queueService: jest.Mocked<QueueService>;
  let deadLetterService: jest.Mocked<DeadLetterService>;
  let healthService: jest.Mocked<HealthService>;

  beforeEach(async () => {
    const mockQueueService = {
      getMetrics: jest.fn(),
    };

    const mockDeadLetterService = {
      getDeadLetterCount: jest.fn(),
    };

    const mockHealthService = {
      check: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: DeadLetterService,
          useValue: mockDeadLetterService,
        },
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    queueService = module.get(QueueService);
    deadLetterService = module.get(DeadLetterService);
    healthService = module.get(HealthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMetrics', () => {
    it('should return queue metrics in JSON format', async () => {
      const mockQueueMetrics = {
        active: 5,
        waiting: 10,
        completed: 100,
        failed: 2,
        delayed: 3,
      };

      queueService.getMetrics.mockResolvedValue(mockQueueMetrics);
      deadLetterService.getDeadLetterCount.mockResolvedValue(1);

      const result = await controller.getMetrics();

      expect(result.queue).toEqual(mockQueueMetrics);
      expect(result.deadLetter.count).toBe(1);
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should call services in parallel', async () => {
      const mockQueueMetrics = {
        active: 0,
        waiting: 0,
        completed: 50,
        failed: 0,
        delayed: 0,
      };

      queueService.getMetrics.mockResolvedValue(mockQueueMetrics);
      deadLetterService.getDeadLetterCount.mockResolvedValue(0);

      await controller.getMetrics();

      expect(queueService.getMetrics).toHaveBeenCalledTimes(1);
      expect(deadLetterService.getDeadLetterCount).toHaveBeenCalledTimes(1);
    });

    it('should handle zero metrics', async () => {
      const mockQueueMetrics = {
        active: 0,
        waiting: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };

      queueService.getMetrics.mockResolvedValue(mockQueueMetrics);
      deadLetterService.getDeadLetterCount.mockResolvedValue(0);

      const result = await controller.getMetrics();

      expect(result.queue.active).toBe(0);
      expect(result.queue.waiting).toBe(0);
      expect(result.queue.completed).toBe(0);
      expect(result.queue.failed).toBe(0);
      expect(result.queue.delayed).toBe(0);
      expect(result.deadLetter.count).toBe(0);
    });

    it('should handle service errors gracefully', async () => {
      queueService.getMetrics.mockRejectedValue(new Error('Queue unavailable'));

      await expect(controller.getMetrics()).rejects.toThrow('Queue unavailable');
    });
  });

  describe('getPrometheusMetrics', () => {
    it('should return metrics in Prometheus format', async () => {
      const mockQueueMetrics = {
        active: 5,
        waiting: 10,
        completed: 100,
        failed: 2,
        delayed: 3,
      };

      const mockHealthStatus = {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: 3600,
        components: {
          redis: { status: 'up' as const, message: 'Connected', latency: 5 },
          redisSubscriber: { status: 'up' as const, message: 'Connected' },
          bullQueue: { status: 'up' as const, message: 'Operational' },
          api: { status: 'up' as const, message: 'Reachable', latency: 50 },
        },
      };

      queueService.getMetrics.mockResolvedValue(mockQueueMetrics);
      deadLetterService.getDeadLetterCount.mockResolvedValue(1);
      healthService.check.mockResolvedValue(mockHealthStatus);

      const result = await controller.getPrometheusMetrics();

      // Verify it's a string in Prometheus format
      expect(typeof result).toBe('string');

      // Verify it contains all expected metrics
      expect(result).toContain('scheduler_queue_active 5');
      expect(result).toContain('scheduler_queue_waiting 10');
      expect(result).toContain('scheduler_queue_completed 100');
      expect(result).toContain('scheduler_queue_failed 2');
      expect(result).toContain('scheduler_queue_delayed 3');
      expect(result).toContain('scheduler_dead_letter_count 1');
      expect(result).toContain('scheduler_health_status 2'); // healthy = 2
      expect(result).toContain('scheduler_uptime_seconds 3600');

      // Verify it contains component statuses
      expect(result).toContain('scheduler_component_status{component="redis"} 2');
      expect(result).toContain('scheduler_component_status{component="redis_subscriber"} 2');
      expect(result).toContain('scheduler_component_status{component="bull_queue"} 2');
      expect(result).toContain('scheduler_component_status{component="api"} 2');

      // Verify it contains process metrics
      expect(result).toContain('process_cpu_usage_percent');
      expect(result).toContain('process_memory_usage_bytes{type="rss"}');
      expect(result).toContain('process_memory_usage_bytes{type="heap_used"}');
      expect(result).toContain('process_memory_usage_bytes{type="heap_total"}');
      expect(result).toContain('process_memory_usage_bytes{type="external"}');
    });

    it('should handle degraded health status', async () => {
      const mockQueueMetrics = {
        active: 1,
        waiting: 2,
        completed: 50,
        failed: 0,
        delayed: 0,
      };

      const mockHealthStatus = {
        status: 'degraded' as const,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: 1800,
        components: {
          redis: { status: 'up' as const, message: 'Connected', latency: 5 },
          redisSubscriber: { status: 'degraded' as const, message: 'Slow connection' },
          bullQueue: { status: 'up' as const, message: 'Operational' },
          api: { status: 'up' as const, message: 'Reachable', latency: 50 },
        },
      };

      queueService.getMetrics.mockResolvedValue(mockQueueMetrics);
      deadLetterService.getDeadLetterCount.mockResolvedValue(0);
      healthService.check.mockResolvedValue(mockHealthStatus);

      const result = await controller.getPrometheusMetrics();

      expect(result).toContain('scheduler_health_status 1'); // degraded = 1
      expect(result).toContain('scheduler_component_status{component="redis_subscriber"} 1'); // degraded = 1
    });

    it('should handle unhealthy status', async () => {
      const mockQueueMetrics = {
        active: 0,
        waiting: 0,
        completed: 0,
        failed: 5,
        delayed: 0,
      };

      const mockHealthStatus = {
        status: 'unhealthy' as const,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: 900,
        components: {
          redis: { status: 'down' as const, message: 'Connection failed' },
          redisSubscriber: { status: 'down' as const, message: 'Not connected' },
          bullQueue: { status: 'down' as const, message: 'Queue unavailable' },
          api: { status: 'down' as const, message: 'Unreachable' },
        },
      };

      queueService.getMetrics.mockResolvedValue(mockQueueMetrics);
      deadLetterService.getDeadLetterCount.mockResolvedValue(5);
      healthService.check.mockResolvedValue(mockHealthStatus);

      const result = await controller.getPrometheusMetrics();

      expect(result).toContain('scheduler_health_status 0'); // unhealthy = 0
      expect(result).toContain('scheduler_component_status{component="redis"} 0'); // down = 0
      expect(result).toContain('scheduler_component_status{component="redis_subscriber"} 0');
      expect(result).toContain('scheduler_component_status{component="bull_queue"} 0');
      expect(result).toContain('scheduler_component_status{component="api"} 0');
    });

    it('should include HELP and TYPE comments for Prometheus', async () => {
      const mockQueueMetrics = {
        active: 0,
        waiting: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };

      const mockHealthStatus = {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: 100,
        components: {
          redis: { status: 'up' as const, message: 'Connected', latency: 5 },
          redisSubscriber: { status: 'up' as const, message: 'Connected' },
          bullQueue: { status: 'up' as const, message: 'Operational' },
          api: { status: 'up' as const, message: 'Reachable', latency: 50 },
        },
      };

      queueService.getMetrics.mockResolvedValue(mockQueueMetrics);
      deadLetterService.getDeadLetterCount.mockResolvedValue(0);
      healthService.check.mockResolvedValue(mockHealthStatus);

      const result = await controller.getPrometheusMetrics();

      // Verify HELP and TYPE comments are included
      expect(result).toContain('# HELP scheduler_queue_active');
      expect(result).toContain('# TYPE scheduler_queue_active gauge');
      expect(result).toContain('# HELP scheduler_queue_completed');
      expect(result).toContain('# TYPE scheduler_queue_completed counter');
      expect(result).toContain('# HELP scheduler_health_status');
      expect(result).toContain('# TYPE scheduler_health_status gauge');
    });

    it('should call services in parallel', async () => {
      const mockQueueMetrics = {
        active: 0,
        waiting: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };

      const mockHealthStatus = {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: 100,
        components: {
          redis: { status: 'up' as const, message: 'Connected', latency: 5 },
          redisSubscriber: { status: 'up' as const, message: 'Connected' },
          bullQueue: { status: 'up' as const, message: 'Operational' },
          api: { status: 'up' as const, message: 'Reachable', latency: 50 },
        },
      };

      queueService.getMetrics.mockResolvedValue(mockQueueMetrics);
      deadLetterService.getDeadLetterCount.mockResolvedValue(0);
      healthService.check.mockResolvedValue(mockHealthStatus);

      await controller.getPrometheusMetrics();

      expect(queueService.getMetrics).toHaveBeenCalledTimes(1);
      expect(deadLetterService.getDeadLetterCount).toHaveBeenCalledTimes(1);
      expect(healthService.check).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors gracefully', async () => {
      queueService.getMetrics.mockRejectedValue(new Error('Queue service unavailable'));

      await expect(controller.getPrometheusMetrics()).rejects.toThrow('Queue service unavailable');
    });
  });

  describe('healthStatusToNumber', () => {
    it('should convert healthy to 2', () => {
      const result = (controller as any).healthStatusToNumber('healthy');
      expect(result).toBe(2);
    });

    it('should convert degraded to 1', () => {
      const result = (controller as any).healthStatusToNumber('degraded');
      expect(result).toBe(1);
    });

    it('should convert unhealthy to 0', () => {
      const result = (controller as any).healthStatusToNumber('unhealthy');
      expect(result).toBe(0);
    });

    it('should return 0 for unknown status', () => {
      const result = (controller as any).healthStatusToNumber('unknown' as any);
      expect(result).toBe(0);
    });
  });

  describe('componentStatusToNumber', () => {
    it('should convert up to 2', () => {
      const result = (controller as any).componentStatusToNumber('up');
      expect(result).toBe(2);
    });

    it('should convert degraded to 1', () => {
      const result = (controller as any).componentStatusToNumber('degraded');
      expect(result).toBe(1);
    });

    it('should convert down to 0', () => {
      const result = (controller as any).componentStatusToNumber('down');
      expect(result).toBe(0);
    });

    it('should return 0 for unknown status', () => {
      const result = (controller as any).componentStatusToNumber('unknown' as any);
      expect(result).toBe(0);
    });
  });
});
