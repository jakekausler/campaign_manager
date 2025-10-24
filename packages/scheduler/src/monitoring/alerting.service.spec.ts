import { Test, TestingModule } from '@nestjs/testing';

import { AlertingService, AlertSeverity } from './alerting.service';

describe('AlertingService', () => {
  let service: AlertingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AlertingService],
    }).compile();

    service = module.get<AlertingService>(AlertingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendAlert', () => {
    it('should send an alert with correct properties', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      service.registerHandler(mockHandler);

      await service.sendAlert(AlertSeverity.INFO, 'Test Alert', 'This is a test message', {
        testKey: 'testValue',
      });

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: AlertSeverity.INFO,
          title: 'Test Alert',
          message: 'This is a test message',
          timestamp: expect.any(Date),
          metadata: { testKey: 'testValue' },
        })
      );
    });

    it('should call all registered handlers', async () => {
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);

      // Remove default logger handler by creating new service
      const module = await Test.createTestingModule({
        providers: [AlertingService],
      }).compile();
      const freshService = module.get<AlertingService>(AlertingService);

      freshService.registerHandler(handler1);
      freshService.registerHandler(handler2);

      await freshService.sendAlert(AlertSeverity.WARNING, 'Test', 'Message');

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should continue processing even if a handler fails', async () => {
      const failingHandler = jest.fn().mockRejectedValue(new Error('Handler failed'));
      const successHandler = jest.fn().mockResolvedValue(undefined);

      const module = await Test.createTestingModule({
        providers: [AlertingService],
      }).compile();
      const freshService = module.get<AlertingService>(AlertingService);

      freshService.registerHandler(failingHandler);
      freshService.registerHandler(successHandler);

      await freshService.sendAlert(AlertSeverity.CRITICAL, 'Test', 'Message');

      expect(failingHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });
  });

  describe('critical', () => {
    it('should send a critical alert', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      service.registerHandler(mockHandler);

      await service.critical('Critical Failure', 'System is down');

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: AlertSeverity.CRITICAL,
          title: 'Critical Failure',
          message: 'System is down',
        })
      );
    });
  });

  describe('warning', () => {
    it('should send a warning alert', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      service.registerHandler(mockHandler);

      await service.warning('High Load', 'CPU usage above 80%');

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: AlertSeverity.WARNING,
          title: 'High Load',
          message: 'CPU usage above 80%',
        })
      );
    });
  });

  describe('info', () => {
    it('should send an info alert', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      service.registerHandler(mockHandler);

      await service.info('Service Started', 'Scheduler is running');

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: AlertSeverity.INFO,
          title: 'Service Started',
          message: 'Scheduler is running',
        })
      );
    });
  });

  describe('registerHandler', () => {
    it('should allow registering custom handlers', async () => {
      const customHandler = jest.fn().mockResolvedValue(undefined);
      service.registerHandler(customHandler);

      await service.info('Test', 'Message');

      expect(customHandler).toHaveBeenCalled();
    });
  });

  describe('metadata', () => {
    it('should include metadata in alerts when provided', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      service.registerHandler(mockHandler);

      await service.critical('Job Failed', 'Job processing error', {
        jobId: '123',
        attemptsMade: 3,
      });

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            jobId: '123',
            attemptsMade: 3,
          },
        })
      );
    });
  });
});
