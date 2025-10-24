/**
 * Settlement Scheduling Service Tests
 */

import { Test, TestingModule } from '@nestjs/testing';

import { ApiClientService, SettlementSummary } from '../api/api-client.service';
import { JobType } from '../queue/job-types.enum';
import { JobPriority } from '../queue/job.interface';
import { QueueService } from '../queue/queue.service';

import { GrowthEventType, SettlementSchedulingService } from './settlement-scheduling.service';

describe('SettlementSchedulingService', () => {
  let service: SettlementSchedulingService;
  let apiClientService: jest.Mocked<ApiClientService>;
  let queueService: jest.Mocked<QueueService>;

  beforeEach(async () => {
    // Create mocks
    const mockApiClientService = {
      getAllCampaignIds: jest.fn(),
      getSettlementsByCampaign: jest.fn(),
    };

    const mockQueueService = {
      addJob: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementSchedulingService,
        {
          provide: ApiClientService,
          useValue: mockApiClientService,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    service = module.get<SettlementSchedulingService>(SettlementSchedulingService);
    apiClientService = module.get(ApiClientService);
    queueService = module.get(QueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getConfig', () => {
    it('should return default configuration', () => {
      const config = service.getConfig();
      expect(config.populationGrowthIntervalMinutes).toBe(60);
      expect(config.resourceGenerationIntervalMinutes).toBe(60);
      expect(config.levelCheckIntervalMinutes).toBe(360);
      expect(config.levelGrowthMultipliers.size).toBeGreaterThan(0);
    });

    it('should return a copy of the configuration', () => {
      const config1 = service.getConfig();
      const config2 = service.getConfig();
      expect(config1).not.toBe(config2); // Different object references
      expect(config1.populationGrowthIntervalMinutes).toBe(config2.populationGrowthIntervalMinutes);
    });
  });

  describe('setPopulationGrowthInterval', () => {
    it('should update population growth interval', () => {
      service.setPopulationGrowthInterval(120);
      const config = service.getConfig();
      expect(config.populationGrowthIntervalMinutes).toBe(120);
    });

    it('should throw error for non-positive interval', () => {
      expect(() => service.setPopulationGrowthInterval(0)).toThrow(
        'Population growth interval must be positive'
      );
      expect(() => service.setPopulationGrowthInterval(-10)).toThrow(
        'Population growth interval must be positive'
      );
    });
  });

  describe('setResourceGenerationInterval', () => {
    it('should update resource generation interval', () => {
      service.setResourceGenerationInterval(90);
      const config = service.getConfig();
      expect(config.resourceGenerationIntervalMinutes).toBe(90);
    });

    it('should throw error for non-positive interval', () => {
      expect(() => service.setResourceGenerationInterval(0)).toThrow(
        'Resource generation interval must be positive'
      );
      expect(() => service.setResourceGenerationInterval(-5)).toThrow(
        'Resource generation interval must be positive'
      );
    });
  });

  describe('setLevelCheckInterval', () => {
    it('should update level check interval', () => {
      service.setLevelCheckInterval(480);
      const config = service.getConfig();
      expect(config.levelCheckIntervalMinutes).toBe(480);
    });

    it('should throw error for non-positive interval', () => {
      expect(() => service.setLevelCheckInterval(0)).toThrow(
        'Level check interval must be positive'
      );
      expect(() => service.setLevelCheckInterval(-20)).toThrow(
        'Level check interval must be positive'
      );
    });
  });

  describe('setLevelGrowthMultiplier', () => {
    it('should update level growth multiplier', () => {
      service.setLevelGrowthMultiplier(6, 0.5);
      const config = service.getConfig();
      expect(config.levelGrowthMultipliers.get(6)).toBe(0.5);
    });

    it('should throw error for non-positive level', () => {
      expect(() => service.setLevelGrowthMultiplier(0, 1.0)).toThrow('Level must be positive');
      expect(() => service.setLevelGrowthMultiplier(-1, 1.0)).toThrow('Level must be positive');
    });

    it('should throw error for non-positive multiplier', () => {
      expect(() => service.setLevelGrowthMultiplier(3, 0)).toThrow('Multiplier must be positive');
      expect(() => service.setLevelGrowthMultiplier(3, -0.5)).toThrow(
        'Multiplier must be positive'
      );
    });
  });

  describe('processAllSettlements', () => {
    it('should process settlements across all campaigns', async () => {
      const mockSettlements: SettlementSummary[] = [
        {
          id: 'settlement-1',
          campaignId: 'campaign-1',
          kingdomId: 'kingdom-1',
          name: 'Settlement A',
          level: 1,
          variables: {},
        },
        {
          id: 'settlement-2',
          campaignId: 'campaign-1',
          kingdomId: 'kingdom-1',
          name: 'Settlement B',
          level: 2,
          variables: {},
        },
      ];

      apiClientService.getAllCampaignIds.mockResolvedValue(['campaign-1']);
      apiClientService.getSettlementsByCampaign.mockResolvedValue(mockSettlements);

      const result = await service.processAllSettlements();

      expect(result.totalSettlements).toBe(2);
      expect(result.jobsQueued).toBe(6); // 3 job types × 2 settlements
      expect(result.errors).toBe(0);
      expect(result.errorMessages).toHaveLength(0);
      expect(apiClientService.getAllCampaignIds).toHaveBeenCalledTimes(1);
      expect(apiClientService.getSettlementsByCampaign).toHaveBeenCalledWith('campaign-1');
      expect(queueService.addJob).toHaveBeenCalledTimes(6);
    });

    it('should return empty result when no campaigns exist', async () => {
      apiClientService.getAllCampaignIds.mockResolvedValue([]);

      const result = await service.processAllSettlements();

      expect(result.totalSettlements).toBe(0);
      expect(result.jobsQueued).toBe(0);
      expect(result.errors).toBe(0);
      expect(apiClientService.getSettlementsByCampaign).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      apiClientService.getAllCampaignIds.mockRejectedValue(new Error('API error'));

      await expect(service.processAllSettlements()).rejects.toThrow('API error');
    });

    it('should continue processing other campaigns if one fails', async () => {
      apiClientService.getAllCampaignIds.mockResolvedValue(['campaign-1', 'campaign-2']);
      apiClientService.getSettlementsByCampaign.mockImplementation((campaignId) => {
        if (campaignId === 'campaign-1') {
          return Promise.reject(new Error('Campaign 1 error'));
        }
        return Promise.resolve([
          {
            id: 'settlement-1',
            campaignId: 'campaign-2',
            kingdomId: 'kingdom-1',
            name: 'Settlement A',
            level: 1,
            variables: {},
          },
        ]);
      });

      const result = await service.processAllSettlements();

      expect(result.totalSettlements).toBe(1);
      expect(result.jobsQueued).toBe(3); // 3 job types
      expect(result.errors).toBe(1);
      expect(result.errorMessages).toHaveLength(1);
      expect(result.errorMessages[0]).toContain('campaign-1');
      expect(result.errorMessages[0]).toContain('Campaign 1 error');
    });
  });

  describe('processSettlementsForCampaign', () => {
    it('should process all settlements in a campaign', async () => {
      const mockSettlements: SettlementSummary[] = [
        {
          id: 'settlement-1',
          campaignId: 'campaign-1',
          kingdomId: 'kingdom-1',
          name: 'Settlement A',
          level: 1,
          variables: {},
        },
      ];

      apiClientService.getSettlementsByCampaign.mockResolvedValue(mockSettlements);

      const result = await service.processSettlementsForCampaign('campaign-1');

      expect(result.totalSettlements).toBe(1);
      expect(result.jobsQueued).toBe(3); // Population, resource, level check
      expect(result.errors).toBe(0);
    });

    it('should return empty result when no settlements exist', async () => {
      apiClientService.getSettlementsByCampaign.mockResolvedValue([]);

      const result = await service.processSettlementsForCampaign('campaign-1');

      expect(result.totalSettlements).toBe(0);
      expect(result.jobsQueued).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('should handle settlement scheduling errors gracefully', async () => {
      const mockSettlements: SettlementSummary[] = [
        {
          id: 'settlement-1',
          campaignId: 'campaign-1',
          kingdomId: 'kingdom-1',
          name: 'Settlement A',
          level: 1,
          variables: {},
        },
        {
          id: 'settlement-2',
          campaignId: 'campaign-1',
          kingdomId: 'kingdom-1',
          name: 'Settlement B',
          level: 2,
          variables: {},
        },
      ];

      apiClientService.getSettlementsByCampaign.mockResolvedValue(mockSettlements);

      // Make queueService fail for the first settlement
      queueService.addJob.mockImplementation((job) => {
        if (job.type === JobType.SETTLEMENT_GROWTH && job.settlementId === 'settlement-1') {
          return Promise.reject(new Error('Queue error'));
        }
        return Promise.resolve('job-id');
      });

      const result = await service.processSettlementsForCampaign('campaign-1');

      expect(result.totalSettlements).toBe(2);
      expect(result.jobsQueued).toBe(3); // Only settlement-2's jobs
      expect(result.errors).toBe(1);
      expect(result.errorMessages).toHaveLength(1);
      expect(result.errorMessages[0]).toContain('settlement-1');
    });

    it('should throw error when API call fails', async () => {
      apiClientService.getSettlementsByCampaign.mockRejectedValue(new Error('API error'));

      await expect(service.processSettlementsForCampaign('campaign-1')).rejects.toThrow(
        'API error'
      );
    });
  });

  describe('calculateGrowthEvents', () => {
    it('should calculate three growth events for a settlement', () => {
      const settlement: SettlementSummary = {
        id: 'settlement-1',
        campaignId: 'campaign-1',
        kingdomId: 'kingdom-1',
        name: 'Test Settlement',
        level: 1,
        variables: {},
      };

      const calculations = (service as any).calculateGrowthEvents(settlement);

      expect(calculations).toHaveLength(3);
      expect(calculations[0].eventType).toBe(GrowthEventType.POPULATION_GROWTH);
      expect(calculations[1].eventType).toBe(GrowthEventType.RESOURCE_GENERATION);
      expect(calculations[2].eventType).toBe(GrowthEventType.LEVEL_UP_CHECK);
    });

    it('should use level multipliers for growth interval calculation', () => {
      const settlementLevel1: SettlementSummary = {
        id: 'settlement-1',
        campaignId: 'campaign-1',
        kingdomId: 'kingdom-1',
        name: 'Level 1 Settlement',
        level: 1, // 1.0x multiplier
        variables: {},
      };

      const settlementLevel2: SettlementSummary = {
        id: 'settlement-2',
        campaignId: 'campaign-1',
        kingdomId: 'kingdom-1',
        name: 'Level 2 Settlement',
        level: 2, // 0.9x multiplier (faster growth)
        variables: {},
      };

      const calc1 = (service as any).calculateGrowthEvents(settlementLevel1);
      const calc2 = (service as any).calculateGrowthEvents(settlementLevel2);

      // Level 2 should have shorter intervals (faster growth)
      const interval1 = calc1[0].nextExecutionTime.getTime() - Date.now();
      const interval2 = calc2[0].nextExecutionTime.getTime() - Date.now();

      expect(interval2).toBeLessThan(interval1);
    });

    it('should use custom intervals from settlement variables', () => {
      const settlement: SettlementSummary = {
        id: 'settlement-1',
        campaignId: 'campaign-1',
        kingdomId: 'kingdom-1',
        name: 'Custom Settlement',
        level: 1,
        variables: {
          populationGrowthIntervalMinutes: 30, // Custom: 30 min instead of 60
          resourceGenerationIntervalMinutes: 45, // Custom: 45 min instead of 60
        },
      };

      const calculations = (service as any).calculateGrowthEvents(settlement);

      // Check that intervals are approximately correct (within 1 minute tolerance)
      const popInterval = (calculations[0].nextExecutionTime.getTime() - Date.now()) / (60 * 1000);
      const resInterval = (calculations[1].nextExecutionTime.getTime() - Date.now()) / (60 * 1000);

      expect(popInterval).toBeGreaterThanOrEqual(29);
      expect(popInterval).toBeLessThanOrEqual(31);
      expect(resInterval).toBeGreaterThanOrEqual(44);
      expect(resInterval).toBeLessThanOrEqual(46);
    });

    it('should use default parameters when not provided', () => {
      const settlement: SettlementSummary = {
        id: 'settlement-1',
        campaignId: 'campaign-1',
        kingdomId: 'kingdom-1',
        name: 'Minimal Settlement',
        level: 1,
        variables: {},
      };

      const calculations = (service as any).calculateGrowthEvents(settlement);

      // Population growth parameters
      expect(calculations[0].parameters.growthRate).toBe(0.05);
      expect(calculations[0].parameters.currentPopulation).toBe(100);
      expect(calculations[0].parameters.populationCap).toBe(1000);

      // Resource generation parameters
      expect(calculations[1].parameters.resourceTypes).toEqual(['food', 'gold', 'materials']);
      expect(calculations[1].parameters.generationRates).toEqual({
        food: 10,
        gold: 5,
        materials: 3,
      });

      // Level-up check parameters
      expect(calculations[2].parameters.currentLevel).toBe(1);
      expect(calculations[2].parameters.population).toBe(100);
      expect(calculations[2].parameters.populationThreshold).toBe(1000); // (level + 1) * 500 = 2 * 500
    });

    it('should use custom parameters from settlement variables', () => {
      const settlement: SettlementSummary = {
        id: 'settlement-1',
        campaignId: 'campaign-1',
        kingdomId: 'kingdom-1',
        name: 'Custom Settlement',
        level: 1,
        variables: {
          populationGrowthRate: 0.08,
          population: 250,
          populationCap: 2000,
          resourceTypes: ['food', 'stone'],
          generationRates: { food: 20, stone: 10 },
          requiredStructuresForLevelUp: ['barracks', 'temple'],
        },
      };

      const calculations = (service as any).calculateGrowthEvents(settlement);

      expect(calculations[0].parameters.growthRate).toBe(0.08);
      expect(calculations[0].parameters.currentPopulation).toBe(250);
      expect(calculations[0].parameters.populationCap).toBe(2000);
      expect(calculations[1].parameters.resourceTypes).toEqual(['food', 'stone']);
      expect(calculations[1].parameters.generationRates).toEqual({ food: 20, stone: 10 });
      expect(calculations[2].parameters.requiredStructures).toEqual(['barracks', 'temple']);
    });

    it('should handle unknown settlement levels with default multiplier', () => {
      const settlement: SettlementSummary = {
        id: 'settlement-1',
        campaignId: 'campaign-1',
        kingdomId: 'kingdom-1',
        name: 'High Level Settlement',
        level: 999, // Unknown level
        variables: {},
      };

      const calculations = (service as any).calculateGrowthEvents(settlement);

      // Should use default multiplier of 1.0 for unknown levels
      expect(calculations).toHaveLength(3);
      expect(calculations[0].nextExecutionTime).toBeDefined();
      expect(calculations[1].nextExecutionTime).toBeDefined();
      expect(calculations[2].nextExecutionTime).toBeDefined();
    });
  });

  describe('queueGrowthJob', () => {
    it('should queue job with correct delay', async () => {
      const futureTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      const calculation = {
        campaignId: 'campaign-1',
        settlementId: 'settlement-1',
        eventType: GrowthEventType.POPULATION_GROWTH,
        nextExecutionTime: futureTime,
        parameters: { growthRate: 0.05 },
      };

      await (service as any).queueGrowthJob(calculation);

      expect(queueService.addJob).toHaveBeenCalledTimes(1);
      const callArgs = queueService.addJob.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        type: JobType.SETTLEMENT_GROWTH,
        campaignId: 'campaign-1',
        settlementId: 'settlement-1',
        eventType: GrowthEventType.POPULATION_GROWTH,
        parameters: { growthRate: 0.05 },
        priority: JobPriority.NORMAL,
      });
      expect(callArgs[1]?.delay).toBeGreaterThan(0);
    });

    it('should queue overdue job with zero delay', async () => {
      const pastTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      const calculation = {
        campaignId: 'campaign-1',
        settlementId: 'settlement-1',
        eventType: GrowthEventType.RESOURCE_GENERATION,
        nextExecutionTime: pastTime,
        parameters: {},
      };

      await (service as any).queueGrowthJob(calculation);

      expect(queueService.addJob).toHaveBeenCalledTimes(1);
      const callArgs = queueService.addJob.mock.calls[0];
      expect(callArgs[1]?.delay).toBe(0);
    });

    it('should handle queue errors', async () => {
      queueService.addJob.mockRejectedValue(new Error('Queue full'));

      const calculation = {
        campaignId: 'campaign-1',
        settlementId: 'settlement-1',
        eventType: GrowthEventType.LEVEL_UP_CHECK,
        nextExecutionTime: new Date(Date.now() + 60000),
        parameters: {},
      };

      await expect((service as any).queueGrowthJob(calculation)).rejects.toThrow('Queue full');
    });
  });
});
