import { getQueueToken } from '@nestjs/bull';
import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bull';

import {
  DeferredEffectJobData,
  EventExpirationJobData,
  JobPriority,
  JobType,
  SettlementGrowthJobData,
  StructureMaintenanceJobData,
} from './job.interface';
import { DEFAULT_JOB_OPTIONS, SCHEDULER_QUEUE } from './queue.constants';
import { QueueService } from './queue.service';

describe('QueueService', () => {
  let service: QueueService;
  let mockQueue: Partial<Queue>;

  beforeEach(async () => {
    // Mock the Bull queue
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: '12345' }),
      getActiveCount: jest.fn().mockResolvedValue(5),
      getWaitingCount: jest.fn().mockResolvedValue(10),
      getCompletedCount: jest.fn().mockResolvedValue(100),
      getFailedCount: jest.fn().mockResolvedValue(3),
      getDelayedCount: jest.fn().mockResolvedValue(2),
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
      clean: jest.fn().mockResolvedValue([{ id: '1' }, { id: '2' }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: getQueueToken(SCHEDULER_QUEUE),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addJob', () => {
    it('should add a job with default options', async () => {
      const jobData: DeferredEffectJobData = {
        type: JobType.DEFERRED_EFFECT,
        campaignId: 'campaign-123',
        effectId: 'effect-456',
        executeAt: '2025-01-01T00:00:00Z',
      };

      const jobId = await service.addJob(jobData);

      expect(jobId).toBe('12345');
      expect(mockQueue.add).toHaveBeenCalledWith(jobData, {
        ...DEFAULT_JOB_OPTIONS,
        priority: 6, // Bull inverted priority: 11 - JobPriority.NORMAL (5) = 6
      });
    });

    it('should add a job with custom priority from jobData', async () => {
      const jobData: EventExpirationJobData = {
        type: JobType.EVENT_EXPIRATION,
        campaignId: 'campaign-123',
        priority: JobPriority.HIGH,
      };

      await service.addJob(jobData);

      expect(mockQueue.add).toHaveBeenCalledWith(jobData, {
        ...DEFAULT_JOB_OPTIONS,
        priority: 3, // Bull inverted priority: 11 - JobPriority.HIGH (8) = 3
      });
    });

    it('should add a job with custom priority from options', async () => {
      const jobData: SettlementGrowthJobData = {
        type: JobType.SETTLEMENT_GROWTH,
        campaignId: 'campaign-123',
        settlementId: 'settlement-456',
        eventType: 'POPULATION_GROWTH',
        parameters: {},
      };

      await service.addJob(jobData, { priority: JobPriority.CRITICAL });

      expect(mockQueue.add).toHaveBeenCalledWith(jobData, {
        ...DEFAULT_JOB_OPTIONS,
        priority: 1, // Bull inverted priority: 11 - JobPriority.CRITICAL (10) = 1
      });
    });

    it('should add a job with delay', async () => {
      const jobData: StructureMaintenanceJobData = {
        type: JobType.STRUCTURE_MAINTENANCE,
        campaignId: 'campaign-123',
        structureId: 'structure-456',
        maintenanceType: 'CONSTRUCTION_COMPLETE',
      };

      await service.addJob(jobData, { delay: 5000 });

      expect(mockQueue.add).toHaveBeenCalledWith(jobData, {
        ...DEFAULT_JOB_OPTIONS,
        delay: 5000,
        priority: 6, // Bull inverted priority: 11 - JobPriority.NORMAL (5) = 6
      });
    });

    it('should add a job with custom retry attempts', async () => {
      const jobData: DeferredEffectJobData = {
        type: JobType.DEFERRED_EFFECT,
        campaignId: 'campaign-123',
        effectId: 'effect-456',
        executeAt: '2025-01-01T00:00:00Z',
      };

      await service.addJob(jobData, { attempts: 5 });

      expect(mockQueue.add).toHaveBeenCalledWith(jobData, {
        ...DEFAULT_JOB_OPTIONS,
        attempts: 5,
        priority: 6, // Bull inverted priority: 11 - JobPriority.NORMAL (5) = 6
      });
    });
  });

  describe('getMetrics', () => {
    it('should return queue metrics', async () => {
      const metrics = await service.getMetrics();

      expect(metrics).toEqual({
        active: 5,
        waiting: 10,
        completed: 100,
        failed: 3,
        delayed: 2,
      });
      expect(mockQueue.getActiveCount).toHaveBeenCalled();
      expect(mockQueue.getWaitingCount).toHaveBeenCalled();
      expect(mockQueue.getCompletedCount).toHaveBeenCalled();
      expect(mockQueue.getFailedCount).toHaveBeenCalled();
      expect(mockQueue.getDelayedCount).toHaveBeenCalled();
    });
  });

  describe('getJobCount', () => {
    it('should return active job count', async () => {
      const count = await service.getJobCount('active');
      expect(count).toBe(5);
      expect(mockQueue.getActiveCount).toHaveBeenCalled();
    });

    it('should return waiting job count', async () => {
      const count = await service.getJobCount('waiting');
      expect(count).toBe(10);
      expect(mockQueue.getWaitingCount).toHaveBeenCalled();
    });

    it('should return completed job count', async () => {
      const count = await service.getJobCount('completed');
      expect(count).toBe(100);
      expect(mockQueue.getCompletedCount).toHaveBeenCalled();
    });

    it('should return failed job count', async () => {
      const count = await service.getJobCount('failed');
      expect(count).toBe(3);
      expect(mockQueue.getFailedCount).toHaveBeenCalled();
    });

    it('should return delayed job count', async () => {
      const count = await service.getJobCount('delayed');
      expect(count).toBe(2);
      expect(mockQueue.getDelayedCount).toHaveBeenCalled();
    });
  });

  describe('pauseQueue', () => {
    it('should pause the queue', async () => {
      await service.pauseQueue();
      expect(mockQueue.pause).toHaveBeenCalled();
    });
  });

  describe('resumeQueue', () => {
    it('should resume the queue', async () => {
      await service.resumeQueue();
      expect(mockQueue.resume).toHaveBeenCalled();
    });
  });

  describe('cleanCompleted', () => {
    it('should clean completed jobs with default max age', async () => {
      const count = await service.cleanCompleted();
      expect(count).toBe(2);
      expect(mockQueue.clean).toHaveBeenCalledWith(24 * 60 * 60 * 1000, 'completed');
    });

    it('should clean completed jobs with custom max age', async () => {
      const maxAge = 60 * 60 * 1000; // 1 hour
      const count = await service.cleanCompleted(maxAge);
      expect(count).toBe(2);
      expect(mockQueue.clean).toHaveBeenCalledWith(maxAge, 'completed');
    });
  });

  describe('cleanFailed', () => {
    it('should clean failed jobs with default max age', async () => {
      const count = await service.cleanFailed();
      expect(count).toBe(2);
      expect(mockQueue.clean).toHaveBeenCalledWith(7 * 24 * 60 * 60 * 1000, 'failed');
    });

    it('should clean failed jobs with custom max age', async () => {
      const maxAge = 24 * 60 * 60 * 1000; // 1 day
      const count = await service.cleanFailed(maxAge);
      expect(count).toBe(2);
      expect(mockQueue.clean).toHaveBeenCalledWith(maxAge, 'failed');
    });
  });
});
