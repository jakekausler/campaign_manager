import { Controller, Get } from '@nestjs/common';

import { HealthService } from '../health/health.service';

import { DeadLetterService } from './dead-letter.service';
import { QueueService } from './queue.service';

/**
 * Controller for exposing queue metrics.
 * Provides HTTP endpoints for monitoring queue health.
 */
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly queueService: QueueService,
    private readonly deadLetterService: DeadLetterService,
    private readonly healthService: HealthService
  ) {}

  /**
   * Get queue metrics in JSON format.
   * Useful for application monitoring and dashboards.
   *
   * GET /metrics
   */
  @Get()
  async getMetrics(): Promise<{
    queue: {
      active: number;
      waiting: number;
      completed: number;
      failed: number;
      delayed: number;
    };
    deadLetter: {
      count: number;
    };
    timestamp: string;
  }> {
    const [queueMetrics, deadLetterCount] = await Promise.all([
      this.queueService.getMetrics(),
      this.deadLetterService.getDeadLetterCount(),
    ]);

    return {
      queue: queueMetrics,
      deadLetter: {
        count: deadLetterCount,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get queue metrics in Prometheus format.
   * For integration with Prometheus monitoring.
   *
   * GET /metrics/prometheus
   */
  @Get('prometheus')
  async getPrometheusMetrics(): Promise<string> {
    const [queueMetrics, deadLetterCount, healthStatus] = await Promise.all([
      this.queueService.getMetrics(),
      this.deadLetterService.getDeadLetterCount(),
      this.healthService.check(),
    ]);

    const metrics = [
      '# HELP scheduler_queue_active Number of active jobs',
      '# TYPE scheduler_queue_active gauge',
      `scheduler_queue_active ${queueMetrics.active}`,
      '',
      '# HELP scheduler_queue_waiting Number of waiting jobs',
      '# TYPE scheduler_queue_waiting gauge',
      `scheduler_queue_waiting ${queueMetrics.waiting}`,
      '',
      '# HELP scheduler_queue_completed Number of completed jobs',
      '# TYPE scheduler_queue_completed counter',
      `scheduler_queue_completed ${queueMetrics.completed}`,
      '',
      '# HELP scheduler_queue_failed Number of failed jobs',
      '# TYPE scheduler_queue_failed counter',
      `scheduler_queue_failed ${queueMetrics.failed}`,
      '',
      '# HELP scheduler_queue_delayed Number of delayed jobs',
      '# TYPE scheduler_queue_delayed gauge',
      `scheduler_queue_delayed ${queueMetrics.delayed}`,
      '',
      '# HELP scheduler_dead_letter_count Number of jobs in dead-letter queue',
      '# TYPE scheduler_dead_letter_count gauge',
      `scheduler_dead_letter_count ${deadLetterCount}`,
      '',
      '# HELP scheduler_health_status Overall health status (0=unhealthy, 1=degraded, 2=healthy)',
      '# TYPE scheduler_health_status gauge',
      `scheduler_health_status ${this.healthStatusToNumber(healthStatus.status)}`,
      '',
      '# HELP scheduler_component_status Component health status (0=down, 1=degraded, 2=up)',
      '# TYPE scheduler_component_status gauge',
      `scheduler_component_status{component="redis"} ${this.componentStatusToNumber(healthStatus.components.redis.status)}`,
      `scheduler_component_status{component="redis_subscriber"} ${this.componentStatusToNumber(healthStatus.components.redisSubscriber.status)}`,
      `scheduler_component_status{component="bull_queue"} ${this.componentStatusToNumber(healthStatus.components.bullQueue.status)}`,
      `scheduler_component_status{component="api"} ${this.componentStatusToNumber(healthStatus.components.api.status)}`,
      '',
      '# HELP scheduler_uptime_seconds Scheduler service uptime in seconds',
      '# TYPE scheduler_uptime_seconds counter',
      `scheduler_uptime_seconds ${healthStatus.uptime}`,
      '',
      '# HELP process_cpu_usage_percent Process CPU usage percentage',
      '# TYPE process_cpu_usage_percent gauge',
      `process_cpu_usage_percent ${process.cpuUsage().user / 1000000}`,
      '',
      '# HELP process_memory_usage_bytes Process memory usage in bytes',
      '# TYPE process_memory_usage_bytes gauge',
      `process_memory_usage_bytes{type="rss"} ${process.memoryUsage().rss}`,
      `process_memory_usage_bytes{type="heap_used"} ${process.memoryUsage().heapUsed}`,
      `process_memory_usage_bytes{type="heap_total"} ${process.memoryUsage().heapTotal}`,
      `process_memory_usage_bytes{type="external"} ${process.memoryUsage().external}`,
      '',
    ];

    return metrics.join('\n');
  }

  /**
   * Convert health status to number for Prometheus
   */
  private healthStatusToNumber(status: 'healthy' | 'degraded' | 'unhealthy'): number {
    switch (status) {
      case 'healthy':
        return 2;
      case 'degraded':
        return 1;
      case 'unhealthy':
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Convert component status to number for Prometheus
   */
  private componentStatusToNumber(status: 'up' | 'down' | 'degraded'): number {
    switch (status) {
      case 'up':
        return 2;
      case 'degraded':
        return 1;
      case 'down':
        return 0;
      default:
        return 0;
    }
  }
}
