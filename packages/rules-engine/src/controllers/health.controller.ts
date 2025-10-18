/**
 * Health Check Controller
 * Provides HTTP endpoints for liveness and readiness probes
 */

import { Controller, Get, HttpStatus, Logger, Res } from '@nestjs/common';
import { Response } from 'express';

import { HealthService, HealthStatus } from '../services/health.service';
import { MetricsService } from '../services/metrics.service';

@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly healthService: HealthService,
    private readonly metricsService: MetricsService
  ) {}

  /**
   * Liveness probe - basic application health
   * GET /health/live
   *
   * Returns 200 if the application is alive and running
   * This should be used by container orchestrators (Kubernetes, Docker Compose)
   * to determine if the container should be restarted
   */
  @Get('health/live')
  async checkLiveness(@Res() res: Response): Promise<void> {
    try {
      const result = await this.healthService.checkLiveness();
      res.status(HttpStatus.OK).json(result);
    } catch (error) {
      this.logger.error('Liveness check failed', error);
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'dead',
        error: error instanceof Error ? error.message : 'Liveness check failed',
      });
    }
  }

  /**
   * Readiness probe - checks if service is ready to serve traffic
   * GET /health/ready
   *
   * Returns:
   * - 200 if all dependencies are healthy
   * - 503 if any critical dependency is unavailable
   *
   * This should be used by load balancers and API gateways to determine
   * if traffic should be routed to this instance
   */
  @Get('health/ready')
  async checkReadiness(@Res() res: Response): Promise<void> {
    try {
      const health = await this.healthService.checkReadiness();

      // Return 503 if unhealthy, 200 otherwise
      const statusCode =
        health.status === 'unhealthy' ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK;

      res.status(statusCode).json(health);
    } catch (error) {
      this.logger.error('Readiness check failed', error);
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Readiness check failed',
      });
    }
  }

  /**
   * Full health check endpoint
   * GET /health
   *
   * Returns detailed health information about the service and all dependencies
   * This is useful for monitoring dashboards and manual health checks
   */
  @Get('health')
  async checkHealth(@Res() res: Response): Promise<void> {
    try {
      const health: HealthStatus = await this.healthService.checkHealth();

      // Return appropriate status code based on health
      let statusCode = HttpStatus.OK;
      if (health.status === 'unhealthy') {
        statusCode = HttpStatus.SERVICE_UNAVAILABLE;
      } else if (health.status === 'degraded') {
        statusCode = HttpStatus.OK; // Still operational, just degraded
      }

      res.status(statusCode).json(health);
    } catch (error) {
      this.logger.error('Health check failed', error);
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Health check failed',
      });
    }
  }

  /**
   * Simple ping endpoint
   * GET /ping
   *
   * Returns a simple pong response for basic connectivity checks
   */
  @Get('ping')
  ping(@Res() res: Response): void {
    res.status(HttpStatus.OK).json({ message: 'pong', timestamp: new Date().toISOString() });
  }

  /**
   * Metrics endpoint
   * GET /metrics
   *
   * Returns performance metrics for the Rules Engine Worker
   * Includes evaluation counts, latency statistics, and cache performance
   */
  @Get('metrics')
  getMetrics(@Res() res: Response): void {
    try {
      const metrics = this.metricsService.getSummary();
      res.status(HttpStatus.OK).json(metrics);
    } catch (error) {
      this.logger.error('Failed to retrieve metrics', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: error instanceof Error ? error.message : 'Failed to retrieve metrics',
      });
    }
  }
}
