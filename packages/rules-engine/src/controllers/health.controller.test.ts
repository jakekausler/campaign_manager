/**
 * Health Controller Unit Tests
 */

import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { mock, MockProxy } from 'jest-mock-extended';

import { HealthService, HealthStatus } from '../services/health.service';
import { MetricsService } from '../services/metrics.service';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: MockProxy<HealthService>;
  let metricsService: MockProxy<MetricsService>;
  let mockResponse: MockProxy<Response>;

  beforeEach(async () => {
    healthService = mock<HealthService>();
    metricsService = mock<MetricsService>();
    mockResponse = mock<Response>();

    // Mock response chaining
    mockResponse.status.mockReturnValue(mockResponse);
    mockResponse.json.mockReturnValue(mockResponse as Response);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: healthService,
        },
        {
          provide: MetricsService,
          useValue: metricsService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkLiveness', () => {
    it('should return 200 with alive status', async () => {
      healthService.checkLiveness.mockResolvedValue({ status: 'alive' });

      await controller.checkLiveness(mockResponse);

      expect(healthService.checkLiveness).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith({ status: 'alive' });
    });

    it('should return 503 when liveness check throws error', async () => {
      healthService.checkLiveness.mockRejectedValue(new Error('Service crashed'));

      await controller.checkLiveness(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'dead',
        error: 'Service crashed',
      });
    });
  });

  describe('checkReadiness', () => {
    it('should return 200 when status is healthy', async () => {
      const healthStatus: HealthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 10000,
        checks: {
          database: { status: 'pass', message: 'OK' },
          redis: { status: 'pass', message: 'OK' },
          cache: { status: 'pass', message: 'OK' },
          dependencyGraph: { status: 'pass', message: 'OK' },
        },
      };
      healthService.checkReadiness.mockResolvedValue(healthStatus);

      await controller.checkReadiness(mockResponse);

      expect(healthService.checkReadiness).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(healthStatus);
    });

    it('should return 200 when status is degraded', async () => {
      const healthStatus: HealthStatus = {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        uptime: 10000,
        checks: {
          database: { status: 'pass', message: 'OK' },
          redis: { status: 'warn', message: 'Not connected' },
          cache: { status: 'pass', message: 'OK' },
          dependencyGraph: { status: 'pass', message: 'OK' },
        },
      };
      healthService.checkReadiness.mockResolvedValue(healthStatus);

      await controller.checkReadiness(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(healthStatus);
    });

    it('should return 503 when status is unhealthy', async () => {
      const healthStatus: HealthStatus = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: 10000,
        checks: {
          database: { status: 'fail', message: 'Connection refused' },
          redis: { status: 'pass', message: 'OK' },
          cache: { status: 'pass', message: 'OK' },
          dependencyGraph: { status: 'pass', message: 'OK' },
        },
      };
      healthService.checkReadiness.mockResolvedValue(healthStatus);

      await controller.checkReadiness(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(mockResponse.json).toHaveBeenCalledWith(healthStatus);
    });

    it('should return 503 when readiness check throws error', async () => {
      healthService.checkReadiness.mockRejectedValue(new Error('Check failed'));

      await controller.checkReadiness(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'unhealthy',
        error: 'Check failed',
      });
    });
  });

  describe('checkHealth', () => {
    it('should return 200 when status is healthy', async () => {
      const healthStatus: HealthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 10000,
        checks: {
          database: { status: 'pass', message: 'OK' },
          redis: { status: 'pass', message: 'OK' },
          cache: { status: 'pass', message: 'OK' },
          dependencyGraph: { status: 'pass', message: 'OK' },
        },
      };
      healthService.checkHealth.mockResolvedValue(healthStatus);

      await controller.checkHealth(mockResponse);

      expect(healthService.checkHealth).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(healthStatus);
    });

    it('should return 200 when status is degraded', async () => {
      const healthStatus: HealthStatus = {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        uptime: 10000,
        checks: {
          database: { status: 'pass', message: 'OK' },
          redis: { status: 'warn', message: 'Not connected' },
          cache: { status: 'pass', message: 'OK' },
          dependencyGraph: { status: 'pass', message: 'OK' },
        },
      };
      healthService.checkHealth.mockResolvedValue(healthStatus);

      await controller.checkHealth(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(healthStatus);
    });

    it('should return 503 when status is unhealthy', async () => {
      const healthStatus: HealthStatus = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: 10000,
        checks: {
          database: { status: 'fail', message: 'Connection refused' },
          redis: { status: 'pass', message: 'OK' },
          cache: { status: 'pass', message: 'OK' },
          dependencyGraph: { status: 'pass', message: 'OK' },
        },
      };
      healthService.checkHealth.mockResolvedValue(healthStatus);

      await controller.checkHealth(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(mockResponse.json).toHaveBeenCalledWith(healthStatus);
    });

    it('should return 503 when health check throws error', async () => {
      healthService.checkHealth.mockRejectedValue(new Error('Check failed'));

      await controller.checkHealth(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'unhealthy',
        error: 'Check failed',
      });
    });
  });

  describe('ping', () => {
    it('should return pong with timestamp', () => {
      const beforePing = Date.now();

      controller.ping(mockResponse);

      const afterPing = Date.now();

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalled();

      const jsonCall = mockResponse.json.mock.calls[0][0];
      expect(jsonCall.message).toBe('pong');
      expect(jsonCall.timestamp).toBeDefined();

      // Convert ISO string timestamp to milliseconds for comparison
      const timestamp = new Date(jsonCall.timestamp).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(beforePing);
      expect(timestamp).toBeLessThanOrEqual(afterPing);
    });
  });
});
