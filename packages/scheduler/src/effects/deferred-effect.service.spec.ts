/**
 * Deferred Effect Service Tests
 */

import { Test, TestingModule } from '@nestjs/testing';

import { ApiClientService } from '../api/api-client.service';
import { ConfigService } from '../config/config.service';
import { JobPriority, JobType } from '../queue/job.interface';
import { QueueService } from '../queue/queue.service';

import { DeferredEffectService } from './deferred-effect.service';

describe('DeferredEffectService', () => {
  let service: DeferredEffectService;
  let queueService: jest.Mocked<QueueService>;
  let apiClientService: jest.Mocked<ApiClientService>;

  beforeEach(async () => {
    // Create mock services
    const mockQueueService = {
      addJob: jest.fn(),
    };

    const mockApiClientService = {
      getEffect: jest.fn(),
      executeEffect: jest.fn(),
    };

    const mockConfigService = {
      queueMaxRetries: 3,
      queueRetryBackoffMs: 5000,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeferredEffectService,
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: ApiClientService,
          useValue: mockApiClientService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<DeferredEffectService>(DeferredEffectService);
    queueService = module.get(QueueService) as jest.Mocked<QueueService>;
    apiClientService = module.get(ApiClientService) as jest.Mocked<ApiClientService>;
  });

  describe('queueDeferredEffect', () => {
    it('should queue a deferred effect with correct parameters', async () => {
      const executeAt = new Date(Date.now() + 60000).toISOString(); // 1 minute from now
      queueService.addJob.mockResolvedValue('job-123');

      const result = await service.queueDeferredEffect(
        'effect-1',
        executeAt,
        'campaign-1',
        JobPriority.HIGH
      );

      expect(result).toEqual({
        jobId: 'job-123',
        effectId: 'effect-1',
        executeAt,
        campaignId: 'campaign-1',
      });

      expect(queueService.addJob).toHaveBeenCalledWith(
        {
          type: JobType.DEFERRED_EFFECT,
          campaignId: 'campaign-1',
          effectId: 'effect-1',
          executeAt,
          priority: JobPriority.HIGH,
        },
        {
          delay: expect.any(Number),
          priority: JobPriority.HIGH,
          attempts: 3, // From mockConfigService.queueMaxRetries
          backoff: {
            type: 'exponential',
            delay: 5000, // From mockConfigService.queueRetryBackoffMs
          },
        }
      );
    });

    it('should calculate delay correctly for future execution', async () => {
      const now = Date.now();
      const executeAt = new Date(now + 120000).toISOString(); // 2 minutes from now
      queueService.addJob.mockResolvedValue('job-123');

      await service.queueDeferredEffect('effect-1', executeAt, 'campaign-1');

      const callArgs = queueService.addJob.mock.calls[0][1];
      expect(callArgs?.delay).toBeGreaterThanOrEqual(115000); // Allow 5 second tolerance
      expect(callArgs?.delay).toBeLessThanOrEqual(125000);
    });

    it('should use zero delay for past execution times', async () => {
      const executeAt = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      queueService.addJob.mockResolvedValue('job-123');

      await service.queueDeferredEffect('effect-1', executeAt, 'campaign-1');

      const callArgs = queueService.addJob.mock.calls[0][1];
      expect(callArgs?.delay).toBe(0);
    });

    it('should use default NORMAL priority if not specified', async () => {
      const executeAt = new Date(Date.now() + 60000).toISOString();
      queueService.addJob.mockResolvedValue('job-123');

      await service.queueDeferredEffect('effect-1', executeAt, 'campaign-1');

      expect(queueService.addJob).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: JobPriority.NORMAL,
        }),
        expect.objectContaining({
          priority: JobPriority.NORMAL,
        })
      );
    });

    it('should throw error for invalid executeAt timestamp', async () => {
      await expect(
        service.queueDeferredEffect('effect-1', 'invalid-date', 'campaign-1')
      ).rejects.toThrow('Invalid executeAt timestamp: invalid-date');

      expect(queueService.addJob).not.toHaveBeenCalled();
    });
  });

  describe('executeDeferredEffect', () => {
    const mockEffect = {
      id: 'effect-1',
      campaignId: 'campaign-1',
      name: 'Test Effect',
      description: 'Test description',
      entityType: 'Settlement',
      entityId: 'entity-1',
      timing: 'PRE',
      jsonPatch: [{ op: 'add', path: '/test', value: 123 }],
      isActive: true,
      priority: 5,
    };

    it('should execute effect successfully', async () => {
      apiClientService.getEffect.mockResolvedValue(mockEffect);
      apiClientService.executeEffect.mockResolvedValue({
        success: true,
        message: 'Effect executed',
        execution: {
          id: 'exec-1',
          effectId: 'effect-1',
          executedAt: '2023-10-01T12:00:00Z',
          success: true,
        },
      });

      const result = await service.executeDeferredEffect(
        'effect-1',
        'campaign-1',
        '2023-10-01T12:00:00Z'
      );

      expect(result.success).toBe(true);
      expect(result.effectId).toBe('effect-1');
      expect(result.executionId).toBe('exec-1');
      expect(apiClientService.getEffect).toHaveBeenCalledWith('effect-1');
      expect(apiClientService.executeEffect).toHaveBeenCalledWith('effect-1');
    });

    it('should fail if effect not found', async () => {
      apiClientService.getEffect.mockResolvedValue(null);

      const result = await service.executeDeferredEffect(
        'nonexistent',
        'campaign-1',
        '2023-10-01T12:00:00Z'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(apiClientService.executeEffect).not.toHaveBeenCalled();
    });

    it('should fail if campaign ID mismatch', async () => {
      apiClientService.getEffect.mockResolvedValue({
        ...mockEffect,
        campaignId: 'different-campaign',
      });

      const result = await service.executeDeferredEffect(
        'effect-1',
        'campaign-1',
        '2023-10-01T12:00:00Z'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('belongs to campaign different-campaign, expected campaign-1');
      expect(apiClientService.executeEffect).not.toHaveBeenCalled();
    });

    it('should skip execution if effect is not active', async () => {
      apiClientService.getEffect.mockResolvedValue({
        ...mockEffect,
        isActive: false,
      });

      const result = await service.executeDeferredEffect(
        'effect-1',
        'campaign-1',
        '2023-10-01T12:00:00Z'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('not active');
      expect(apiClientService.executeEffect).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      apiClientService.getEffect.mockResolvedValue(mockEffect);
      apiClientService.executeEffect.mockRejectedValue(new Error('API connection failed'));

      const result = await service.executeDeferredEffect(
        'effect-1',
        'campaign-1',
        '2023-10-01T12:00:00Z'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('API connection failed');
    });

    it('should handle execution failures from API', async () => {
      apiClientService.getEffect.mockResolvedValue(mockEffect);
      apiClientService.executeEffect.mockResolvedValue({
        success: false,
        message: 'Invalid patch operation',
        execution: {
          id: 'exec-1',
          effectId: 'effect-1',
          executedAt: '2023-10-01T12:00:00Z',
          success: false,
          error: 'Invalid path: /nonexistent',
        },
      });

      const result = await service.executeDeferredEffect(
        'effect-1',
        'campaign-1',
        '2023-10-01T12:00:00Z'
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid patch operation');
      expect(result.error).toBe('Invalid path: /nonexistent');
    });

    it('should include executedAt timestamp in result', async () => {
      const beforeTime = new Date();
      apiClientService.getEffect.mockResolvedValue(mockEffect);
      apiClientService.executeEffect.mockResolvedValue({
        success: true,
        execution: {
          id: 'exec-1',
          effectId: 'effect-1',
          executedAt: '2023-10-01T12:00:00Z',
          success: true,
        },
      });

      const result = await service.executeDeferredEffect(
        'effect-1',
        'campaign-1',
        '2023-10-01T12:00:00Z'
      );
      const afterTime = new Date();

      expect(result.executedAt).toBeInstanceOf(Date);
      expect(result.executedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(result.executedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('cancelDeferredEffect', () => {
    it('should throw error as feature is not yet implemented', async () => {
      await expect(service.cancelDeferredEffect('job-123')).rejects.toThrow(
        'Job cancellation not yet implemented'
      );
    });
  });
});
