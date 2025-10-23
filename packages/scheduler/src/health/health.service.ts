import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectQueue('health-check')
    private readonly healthCheckQueue: Queue
  ) {}

  /**
   * Check health status of the scheduler service
   */
  async check() {
    const status = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      redis: await this.checkRedis(),
    };

    // If any component is unhealthy, mark overall status as unhealthy
    if (status.redis !== 'connected') {
      status.status = 'unhealthy';
    }

    return status;
  }

  /**
   * Check Redis connection status
   */
  private async checkRedis(): Promise<string> {
    try {
      await this.healthCheckQueue.client.ping();
      return 'connected';
    } catch (error) {
      this.logger.debug('Redis health check failed', error);
      return 'disconnected';
    }
  }
}
