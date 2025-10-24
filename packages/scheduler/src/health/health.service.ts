import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';

import { ApiClientService } from '../api/api-client.service';
import { RedisSubscriberService } from '../redis/redis-subscriber.service';

/**
 * Health status response interface
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  components: {
    redis: ComponentHealth;
    redisSubscriber: ComponentHealth;
    bullQueue: ComponentHealth;
    api: ComponentHealth;
  };
  version: string;
  uptime: number;
}

export interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  message?: string;
  lastChecked?: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(
    @InjectQueue('health-check')
    private readonly healthCheckQueue: Queue,
    private readonly redisSubscriberService: RedisSubscriberService,
    private readonly apiClientService: ApiClientService
  ) {}

  /**
   * Check health status of the scheduler service and all its components
   */
  async check(): Promise<HealthStatus> {
    const [redis, redisSubscriber, bullQueue, api] = await Promise.allSettled([
      this.checkRedis(),
      this.checkRedisSubscriber(),
      this.checkBullQueue(),
      this.checkApi(),
    ]);

    const components = {
      redis: this.extractResult(redis, 'Redis'),
      redisSubscriber: this.extractResult(redisSubscriber, 'Redis Subscriber'),
      bullQueue: this.extractResult(bullQueue, 'Bull Queue'),
      api: this.extractResult(api, 'API'),
    };

    // Determine overall status
    const overallStatus = this.calculateOverallStatus(components);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components,
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor((Date.now() - this.startTime) / 1000), // seconds
    };
  }

  /**
   * Check Redis connection status via Bull queue client
   */
  private async checkRedis(): Promise<ComponentHealth> {
    try {
      const startTime = Date.now();
      await this.healthCheckQueue.client.ping();
      const latency = Date.now() - startTime;

      return {
        status: 'up',
        message: `Connected (latency: ${latency}ms)`,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.warn('Redis health check failed', error);
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Connection failed',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check Redis Subscriber connection status
   */
  private async checkRedisSubscriber(): Promise<ComponentHealth> {
    try {
      const isConnected = this.redisSubscriberService.isConnected();

      if (isConnected) {
        return {
          status: 'up',
          message: 'Subscribed to campaign channels',
          lastChecked: new Date().toISOString(),
        };
      } else {
        return {
          status: 'down',
          message: 'Not connected to Redis pub/sub',
          lastChecked: new Date().toISOString(),
        };
      }
    } catch (error) {
      this.logger.warn('Redis subscriber health check failed', error);
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Status check failed',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check Bull queue health
   */
  private async checkBullQueue(): Promise<ComponentHealth> {
    try {
      const queue = this.healthCheckQueue;
      const [active, waiting, delayed, failed] = await Promise.all([
        queue.getActiveCount(),
        queue.getWaitingCount(),
        queue.getDelayedCount(),
        queue.getFailedCount(),
      ]);

      const totalJobs = active + waiting + delayed;

      // Consider degraded if there are many failed jobs (> 10% of total)
      const failureRate = totalJobs > 0 ? failed / (totalJobs + failed) : 0;
      const isDegraded = failureRate > 0.1;

      return {
        status: isDegraded ? 'degraded' : 'up',
        message: `Active: ${active}, Waiting: ${waiting}, Delayed: ${delayed}, Failed: ${failed}`,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.warn('Bull queue health check failed', error);
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Queue check failed',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check API connectivity by making a simple GraphQL query
   */
  private async checkApi(): Promise<ComponentHealth> {
    try {
      const startTime = Date.now();
      // Try to get campaign IDs - this is a lightweight query
      await this.apiClientService.getAllCampaignIds();
      const latency = Date.now() - startTime;

      return {
        status: 'up',
        message: `Connected (latency: ${latency}ms)`,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.warn('API health check failed', error);
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'API request failed',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Extract result from Promise.allSettled
   */
  private extractResult(
    result: PromiseSettledResult<ComponentHealth>,
    componentName: string
  ): ComponentHealth {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      this.logger.error(`${componentName} health check promise rejected`, result.reason);
      return {
        status: 'down',
        message: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Calculate overall health status based on component statuses
   */
  private calculateOverallStatus(components: {
    [key: string]: ComponentHealth;
  }): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(components).map((c) => c.status);

    // If any critical component is down, system is unhealthy
    if (statuses.includes('down')) {
      return 'unhealthy';
    }

    // If any component is degraded, system is degraded
    if (statuses.includes('degraded')) {
      return 'degraded';
    }

    return 'healthy';
  }
}
