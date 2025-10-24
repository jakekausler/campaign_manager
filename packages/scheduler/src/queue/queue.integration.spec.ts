import { BullModule, getQueueToken } from '@nestjs/bull';
import { Test, TestingModule } from '@nestjs/testing';
import { Queue, Job } from 'bull';

import { DeadLetterService } from './dead-letter.service';
import { JobProcessorService } from './job-processor.service';
import { JobData, JobPriority, JobType } from './job.interface';
import { DEAD_LETTER_QUEUE, SCHEDULER_QUEUE } from './queue.constants';
import { QueueService } from './queue.service';

/**
 * Integration tests for the queue system.
 *
 * These tests require Redis to be running on localhost:6379.
 * If Redis is not available, all tests will be skipped.
 *
 * To run these tests with Redis:
 * 1. Start Redis: `docker run -d -p 6379:6379 redis:alpine`
 * 2. Run tests: `pnpm test`
 */
describe('Queue Integration Tests', () => {
  let isRedisAvailable = false;
  let module: TestingModule;
  let queueService: QueueService;
  let schedulerQueue: Queue<JobData>;
  let deadLetterQueue: Queue;

  // Check if Redis is available before running tests
  beforeAll(async () => {
    try {
      module = await Test.createTestingModule({
        imports: [
          BullModule.forRoot({
            redis: {
              host: 'localhost',
              port: 6379,
              maxRetriesPerRequest: 1,
            },
          }),
          BullModule.registerQueue({
            name: SCHEDULER_QUEUE,
          }),
          BullModule.registerQueue({
            name: DEAD_LETTER_QUEUE,
          }),
        ],
        providers: [QueueService, JobProcessorService, DeadLetterService],
      }).compile();

      queueService = module.get<QueueService>(QueueService);
      schedulerQueue = module.get<Queue<JobData>>(getQueueToken(SCHEDULER_QUEUE));
      deadLetterQueue = module.get<Queue>(getQueueToken(DEAD_LETTER_QUEUE));

      await schedulerQueue.isReady();
      await deadLetterQueue.isReady();

      isRedisAvailable = true;
      console.log('Redis available - running integration tests');
    } catch (error) {
      isRedisAvailable = false;
      console.log('Redis not available - skipping integration tests');
    }
  });

  afterAll(async () => {
    if (!isRedisAvailable) return;
    try {
      await schedulerQueue.close();
      await deadLetterQueue.close();
      await module.close();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    if (!isRedisAvailable) return;
    try {
      await schedulerQueue.empty();
      await deadLetterQueue.empty();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Priority Ordering', () => {
    it('should process high priority jobs before normal priority jobs', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping test - Redis not available');
        return;
      }

      const processedJobs: string[] = [];

      // Register processor
      schedulerQueue.process(async (job: Job<JobData>) => {
        processedJobs.push(job.data.type);
        return Promise.resolve();
      });

      // Add jobs with different priorities
      await queueService.addJob({
        type: JobType.SETTLEMENT_GROWTH,
        campaignId: 'campaign-123',
        settlementId: 'settlement-456',
        eventType: 'POPULATION_GROWTH',
        parameters: {},
        priority: JobPriority.NORMAL,
      });

      await queueService.addJob({
        type: JobType.EVENT_EXPIRATION,
        campaignId: 'campaign-123',
        priority: JobPriority.HIGH,
      });

      await queueService.addJob({
        type: JobType.DEFERRED_EFFECT,
        campaignId: 'campaign-123',
        effectId: 'effect-456',
        executeAt: '2025-01-01T00:00:00Z',
        priority: JobPriority.CRITICAL,
      });

      // Wait for jobs to process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Critical should be first, then high, then normal
      expect(processedJobs[0]).toBe(JobType.DEFERRED_EFFECT); // Critical
      expect(processedJobs[1]).toBe(JobType.EVENT_EXPIRATION); // High
      expect(processedJobs[2]).toBe(JobType.SETTLEMENT_GROWTH); // Normal
    }, 15000);
  });

  describe('Queue Metrics', () => {
    it('should track queue counts correctly', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping test - Redis not available');
        return;
      }

      // Add a job
      await queueService.addJob({
        type: JobType.EVENT_EXPIRATION,
        campaignId: 'campaign-123',
      });

      // Get metrics immediately (job may be waiting or active)
      const metrics = await queueService.getMetrics();

      // Should have at least 1 job in the queue (waiting, active, or completed)
      const totalJobs = metrics.waiting + metrics.active + metrics.completed;
      expect(totalJobs).toBeGreaterThanOrEqual(1);
    }, 10000);
  });
});
