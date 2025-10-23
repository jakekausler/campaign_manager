import { getQueueToken } from '@nestjs/bull';
import { Test, TestingModule } from '@nestjs/testing';
import { Queue, Job } from 'bull';

import { DeadLetterService, DeadLetterJob } from './dead-letter.service';
import { JobData, JobType } from './job.interface';
import { DEAD_LETTER_QUEUE, SCHEDULER_QUEUE } from './queue.constants';

describe('DeadLetterService', () => {
  let service: DeadLetterService;
  let mockSchedulerQueue: Partial<Queue<JobData>>;
  let mockDeadLetterQueue: Partial<Queue<DeadLetterJob>>;

  beforeEach(async () => {
    // Mock the scheduler queue
    mockSchedulerQueue = {
      on: jest.fn(),
    };

    // Mock the dead-letter queue
    mockDeadLetterQueue = {
      add: jest.fn().mockResolvedValue({ id: 'dlq-123' }),
      getWaiting: jest.fn().mockResolvedValue([]),
      getActive: jest.fn().mockResolvedValue([]),
      getCompleted: jest.fn().mockResolvedValue([]),
      getFailed: jest.fn().mockResolvedValue([]),
      getJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeadLetterService,
        {
          provide: getQueueToken(SCHEDULER_QUEUE),
          useValue: mockSchedulerQueue,
        },
        {
          provide: getQueueToken(DEAD_LETTER_QUEUE),
          useValue: mockDeadLetterQueue,
        },
      ],
    }).compile();

    service = module.get<DeadLetterService>(DeadLetterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register a failed job event listener on initialization', () => {
    expect(mockSchedulerQueue.on).toHaveBeenCalledWith('failed', expect.any(Function));
  });

  describe('getDeadLetterJobs', () => {
    it('should return all dead-letter jobs from all states', async () => {
      const mockJobs = [
        { id: '1', data: {} },
        { id: '2', data: {} },
        { id: '3', data: {} },
      ] as Job<DeadLetterJob>[];

      mockDeadLetterQueue.getWaiting = jest.fn().mockResolvedValue([mockJobs[0]]);
      mockDeadLetterQueue.getActive = jest.fn().mockResolvedValue([mockJobs[1]]);
      mockDeadLetterQueue.getCompleted = jest.fn().mockResolvedValue([mockJobs[2]]);
      mockDeadLetterQueue.getFailed = jest.fn().mockResolvedValue([]);

      const jobs = await service.getDeadLetterJobs();

      expect(jobs).toHaveLength(3);
      expect(jobs).toEqual(mockJobs);
    });

    it('should return empty array when no dead-letter jobs exist', async () => {
      const jobs = await service.getDeadLetterJobs();
      expect(jobs).toEqual([]);
    });
  });

  describe('getDeadLetterCount', () => {
    it('should return the count of dead-letter jobs', async () => {
      const mockJobs = [
        { id: '1', data: {} },
        { id: '2', data: {} },
      ] as Job<DeadLetterJob>[];

      mockDeadLetterQueue.getCompleted = jest.fn().mockResolvedValue(mockJobs);

      const count = await service.getDeadLetterCount();

      expect(count).toBe(2);
    });
  });

  describe('retryDeadLetterJob', () => {
    it('should re-add the job to the main queue and remove it from DLQ', async () => {
      const mockJobData: DeadLetterJob = {
        originalJobId: '12345',
        jobData: {
          type: JobType.DEFERRED_EFFECT,
          campaignId: 'campaign-123',
          effectId: 'effect-456',
          executeAt: '2025-01-01T00:00:00Z',
        },
        errorMessage: 'Connection timeout',
        attemptsMade: 3,
        failedAt: new Date(),
      };

      const mockDlqJob = {
        id: 'dlq-123',
        data: mockJobData,
        remove: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job<DeadLetterJob>;

      mockDeadLetterQueue.getJob = jest.fn().mockResolvedValue(mockDlqJob);
      mockSchedulerQueue.add = jest.fn().mockResolvedValue({ id: 'new-job-123' });

      await service.retryDeadLetterJob('dlq-123');

      expect(mockDeadLetterQueue.getJob).toHaveBeenCalledWith('dlq-123');
      expect(mockSchedulerQueue.add).toHaveBeenCalledWith(mockJobData.jobData);
      expect(mockDlqJob.remove).toHaveBeenCalled();
    });

    it('should throw an error if the dead-letter job is not found', async () => {
      mockDeadLetterQueue.getJob = jest.fn().mockResolvedValue(null);

      await expect(service.retryDeadLetterJob('dlq-999')).rejects.toThrow(
        'Dead-letter job dlq-999 not found'
      );
    });
  });

  describe('removeDeadLetterJob', () => {
    it('should remove the job from the dead-letter queue', async () => {
      const mockDlqJob = {
        id: 'dlq-123',
        remove: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job<DeadLetterJob>;

      mockDeadLetterQueue.getJob = jest.fn().mockResolvedValue(mockDlqJob);

      await service.removeDeadLetterJob('dlq-123');

      expect(mockDeadLetterQueue.getJob).toHaveBeenCalledWith('dlq-123');
      expect(mockDlqJob.remove).toHaveBeenCalled();
    });

    it('should throw an error if the dead-letter job is not found', async () => {
      mockDeadLetterQueue.getJob = jest.fn().mockResolvedValue(null);

      await expect(service.removeDeadLetterJob('dlq-999')).rejects.toThrow(
        'Dead-letter job dlq-999 not found'
      );
    });
  });

  describe('clearDeadLetterQueue', () => {
    it('should remove all jobs from the dead-letter queue', async () => {
      const mockJobs = [
        { id: '1', remove: jest.fn().mockResolvedValue(undefined) },
        { id: '2', remove: jest.fn().mockResolvedValue(undefined) },
        { id: '3', remove: jest.fn().mockResolvedValue(undefined) },
      ] as unknown as Job<DeadLetterJob>[];

      mockDeadLetterQueue.getWaiting = jest.fn().mockResolvedValue([mockJobs[0]]);
      mockDeadLetterQueue.getActive = jest.fn().mockResolvedValue([mockJobs[1]]);
      mockDeadLetterQueue.getCompleted = jest.fn().mockResolvedValue([mockJobs[2]]);
      mockDeadLetterQueue.getFailed = jest.fn().mockResolvedValue([]);

      const count = await service.clearDeadLetterQueue();

      expect(count).toBe(3);
      expect(mockJobs[0].remove).toHaveBeenCalled();
      expect(mockJobs[1].remove).toHaveBeenCalled();
      expect(mockJobs[2].remove).toHaveBeenCalled();
    });

    it('should return 0 when no jobs exist', async () => {
      const count = await service.clearDeadLetterQueue();
      expect(count).toBe(0);
    });
  });
});
