import { Controller, Get } from '@nestjs/common';

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
    private readonly deadLetterService: DeadLetterService
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
    const [queueMetrics, deadLetterCount] = await Promise.all([
      this.queueService.getMetrics(),
      this.deadLetterService.getDeadLetterCount(),
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
    ];

    return metrics.join('\n');
  }
}
