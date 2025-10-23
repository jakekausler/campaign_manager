import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bull';

import { DeferredEffectService } from '../effects/deferred-effect.service';
import { EventExpirationService } from '../events/event-expiration.service';

import { JobProcessorService } from './job-processor.service';
import { JobData, JobType } from './job.interface';

describe('JobProcessorService', () => {
  let service: JobProcessorService;
  let deferredEffectService: jest.Mocked<DeferredEffectService>;
  let eventExpirationService: jest.Mocked<EventExpirationService>;

  beforeEach(async () => {
    // Create mock services
    const mockDeferredEffectService = {
      executeDeferredEffect: jest.fn(),
    };

    const mockEventExpirationService = {
      processAllCampaigns: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobProcessorService,
        {
          provide: DeferredEffectService,
          useValue: mockDeferredEffectService,
        },
        {
          provide: EventExpirationService,
          useValue: mockEventExpirationService,
        },
      ],
    }).compile();

    service = module.get<JobProcessorService>(JobProcessorService);
    deferredEffectService = module.get(DeferredEffectService) as jest.Mocked<DeferredEffectService>;
    eventExpirationService = module.get(
      EventExpirationService
    ) as jest.Mocked<EventExpirationService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processJob', () => {
    it('should process a DEFERRED_EFFECT job successfully', async () => {
      const jobData: JobData = {
        type: JobType.DEFERRED_EFFECT,
        campaignId: 'campaign-123',
        effectId: 'effect-456',
        executeAt: '2025-01-01T00:00:00Z',
      };

      const mockJob = {
        id: '12345',
        data: jobData,
      } as Job<JobData>;

      deferredEffectService.executeDeferredEffect.mockResolvedValue({
        success: true,
        effectId: 'effect-456',
        executedAt: new Date(),
        executionId: 'exec-1',
      });

      await expect(service.processJob(mockJob)).resolves.not.toThrow();
      expect(deferredEffectService.executeDeferredEffect).toHaveBeenCalledWith(
        'effect-456',
        'campaign-123',
        '2025-01-01T00:00:00Z'
      );
    });

    it('should throw error when DEFERRED_EFFECT job fails', async () => {
      const jobData: JobData = {
        type: JobType.DEFERRED_EFFECT,
        campaignId: 'campaign-123',
        effectId: 'effect-456',
        executeAt: '2025-01-01T00:00:00Z',
      };

      const mockJob = {
        id: '12345',
        data: jobData,
      } as Job<JobData>;

      deferredEffectService.executeDeferredEffect.mockResolvedValue({
        success: false,
        effectId: 'effect-456',
        executedAt: new Date(),
        error: 'Effect not found',
      });

      await expect(service.processJob(mockJob)).rejects.toThrow('Effect execution failed');
    });

    it('should process a SETTLEMENT_GROWTH job without errors', async () => {
      const jobData: JobData = {
        type: JobType.SETTLEMENT_GROWTH,
        campaignId: 'campaign-123',
        settlementId: 'settlement-456',
        growthType: 'POPULATION_GROWTH',
      };

      const mockJob = {
        id: '12345',
        data: jobData,
      } as Job<JobData>;

      await expect(service.processJob(mockJob)).resolves.not.toThrow();
    });

    it('should process a STRUCTURE_MAINTENANCE job without errors', async () => {
      const jobData: JobData = {
        type: JobType.STRUCTURE_MAINTENANCE,
        campaignId: 'campaign-123',
        structureId: 'structure-456',
        maintenanceType: 'CONSTRUCTION_COMPLETE',
      };

      const mockJob = {
        id: '12345',
        data: jobData,
      } as Job<JobData>;

      await expect(service.processJob(mockJob)).resolves.not.toThrow();
    });

    it('should process an EVENT_EXPIRATION job without errors', async () => {
      const jobData: JobData = {
        type: JobType.EVENT_EXPIRATION,
        campaignId: 'campaign-123',
      };

      const mockJob = {
        id: '12345',
        data: jobData,
      } as Job<JobData>;

      eventExpirationService.processAllCampaigns.mockResolvedValue({
        totalChecked: 10,
        expired: 2,
        errors: 0,
        expiredEventIds: ['event-1', 'event-2'],
        errorMessages: [],
      });

      await expect(service.processJob(mockJob)).resolves.not.toThrow();
      expect(eventExpirationService.processAllCampaigns).toHaveBeenCalled();
    });

    it('should handle unknown job types by throwing an error', async () => {
      const jobData = {
        type: 'UNKNOWN_TYPE',
        campaignId: 'campaign-123',
      } as unknown as JobData;

      const mockJob = {
        id: '12345',
        data: jobData,
      } as Job<JobData>;

      await expect(service.processJob(mockJob)).rejects.toThrow('Unknown job type');
    });
  });
});
