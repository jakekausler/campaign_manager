/**
 * Structure Scheduling Service Tests
 */

import { Test, TestingModule } from '@nestjs/testing';

import { ApiClientService, StructureSummary } from '../api/api-client.service';
import { JobType } from '../queue/job-types.enum';
import { JobPriority } from '../queue/job.interface';
import { QueueService } from '../queue/queue.service';

import { MaintenanceEventType, StructureSchedulingService } from './structure-scheduling.service';

describe('StructureSchedulingService', () => {
  let service: StructureSchedulingService;
  let apiClientService: jest.Mocked<ApiClientService>;
  let queueService: jest.Mocked<QueueService>;

  beforeEach(async () => {
    // Create mocks
    const mockApiClientService = {
      getAllCampaignIds: jest.fn(),
      getStructuresByCampaign: jest.fn(),
    };

    const mockQueueService = {
      addJob: jest.fn().mockResolvedValue('job-id'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StructureSchedulingService,
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

    service = module.get<StructureSchedulingService>(StructureSchedulingService);
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
      expect(config.defaultMaintenanceIntervalMinutes).toBe(120);
    });

    it('should return a copy of the configuration', () => {
      const config1 = service.getConfig();
      const config2 = service.getConfig();
      expect(config1).not.toBe(config2); // Different object references
      expect(config1.defaultMaintenanceIntervalMinutes).toBe(
        config2.defaultMaintenanceIntervalMinutes
      );
    });
  });

  describe('setDefaultMaintenanceInterval', () => {
    it('should update default maintenance interval', () => {
      service.setDefaultMaintenanceInterval(180);
      const config = service.getConfig();
      expect(config.defaultMaintenanceIntervalMinutes).toBe(180);
    });

    it('should throw error for non-positive interval', () => {
      expect(() => service.setDefaultMaintenanceInterval(0)).toThrow(
        'Maintenance interval must be positive'
      );
      expect(() => service.setDefaultMaintenanceInterval(-10)).toThrow(
        'Maintenance interval must be positive'
      );
    });
  });

  describe('processAllStructures', () => {
    it('should process structures across all campaigns', async () => {
      const mockStructures: StructureSummary[] = [
        {
          id: 'structure-1',
          campaignId: 'campaign-1',
          settlementId: 'settlement-1',
          name: 'Barracks',
          type: 'MILITARY',
          variables: {},
        },
        {
          id: 'structure-2',
          campaignId: 'campaign-1',
          settlementId: 'settlement-1',
          name: 'Temple',
          type: 'RELIGIOUS',
          variables: {},
        },
      ];

      apiClientService.getAllCampaignIds.mockResolvedValue(['campaign-1']);
      apiClientService.getStructuresByCampaign.mockResolvedValue(mockStructures);

      const result = await service.processAllStructures();

      expect(result.totalStructures).toBe(2);
      expect(result.jobsQueued).toBe(4); // 2 structures × 2 events each (maintenance + upgrade)
      expect(result.errors).toBe(0);
      expect(result.errorMessages).toHaveLength(0);
      expect(apiClientService.getAllCampaignIds).toHaveBeenCalledTimes(1);
      expect(apiClientService.getStructuresByCampaign).toHaveBeenCalledWith('campaign-1');
      expect(queueService.addJob).toHaveBeenCalledTimes(4);
    });

    it('should return empty result when no campaigns exist', async () => {
      apiClientService.getAllCampaignIds.mockResolvedValue([]);

      const result = await service.processAllStructures();

      expect(result.totalStructures).toBe(0);
      expect(result.jobsQueued).toBe(0);
      expect(result.errors).toBe(0);
      expect(apiClientService.getStructuresByCampaign).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      apiClientService.getAllCampaignIds.mockRejectedValue(new Error('API error'));

      await expect(service.processAllStructures()).rejects.toThrow('API error');
    });

    it('should continue processing other campaigns if one fails', async () => {
      apiClientService.getAllCampaignIds.mockResolvedValue(['campaign-1', 'campaign-2']);
      apiClientService.getStructuresByCampaign.mockImplementation((campaignId) => {
        if (campaignId === 'campaign-1') {
          return Promise.reject(new Error('Campaign 1 error'));
        }
        return Promise.resolve([
          {
            id: 'structure-1',
            campaignId: 'campaign-2',
            settlementId: 'settlement-1',
            name: 'Barracks',
            type: 'MILITARY',
            variables: {},
          },
        ]);
      });

      const result = await service.processAllStructures();

      expect(result.totalStructures).toBe(1);
      expect(result.jobsQueued).toBe(2); // Maintenance + upgrade
      expect(result.errors).toBe(1);
      expect(result.errorMessages).toHaveLength(1);
      expect(result.errorMessages[0]).toContain('campaign-1');
      expect(result.errorMessages[0]).toContain('Campaign 1 error');
    });
  });

  describe('processStructuresForCampaign', () => {
    it('should process all structures in a campaign', async () => {
      const mockStructures: StructureSummary[] = [
        {
          id: 'structure-1',
          campaignId: 'campaign-1',
          settlementId: 'settlement-1',
          name: 'Barracks',
          type: 'MILITARY',
          variables: {},
        },
      ];

      apiClientService.getStructuresByCampaign.mockResolvedValue(mockStructures);

      const result = await service.processStructuresForCampaign('campaign-1');

      expect(result.totalStructures).toBe(1);
      expect(result.jobsQueued).toBe(2); // Maintenance + upgrade
      expect(result.errors).toBe(0);
    });

    it('should return empty result when no structures exist', async () => {
      apiClientService.getStructuresByCampaign.mockResolvedValue([]);

      const result = await service.processStructuresForCampaign('campaign-1');

      expect(result.totalStructures).toBe(0);
      expect(result.jobsQueued).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('should handle structure scheduling errors gracefully', async () => {
      const mockStructures: StructureSummary[] = [
        {
          id: 'structure-1',
          campaignId: 'campaign-1',
          settlementId: 'settlement-1',
          name: 'Barracks',
          type: 'MILITARY',
          variables: {},
        },
        {
          id: 'structure-2',
          campaignId: 'campaign-1',
          settlementId: 'settlement-1',
          name: 'Temple',
          type: 'RELIGIOUS',
          variables: {},
        },
      ];

      apiClientService.getStructuresByCampaign.mockResolvedValue(mockStructures);

      // Make queueService fail for the first structure
      queueService.addJob.mockImplementation((job) => {
        if (job.type === JobType.STRUCTURE_MAINTENANCE && job.structureId === 'structure-1') {
          return Promise.reject(new Error('Queue error'));
        }
        return Promise.resolve('job-id');
      });

      const result = await service.processStructuresForCampaign('campaign-1');

      expect(result.totalStructures).toBe(2);
      expect(result.jobsQueued).toBe(2); // Only structure-2's jobs
      expect(result.errors).toBe(1);
      expect(result.errorMessages).toHaveLength(1);
      expect(result.errorMessages[0]).toContain('structure-1');
    });

    it('should throw error when API call fails', async () => {
      apiClientService.getStructuresByCampaign.mockRejectedValue(new Error('API error'));

      await expect(service.processStructuresForCampaign('campaign-1')).rejects.toThrow('API error');
    });
  });

  describe('calculateMaintenanceEvents', () => {
    it('should calculate maintenance and upgrade events for operational structure', () => {
      const structure: StructureSummary = {
        id: 'structure-1',
        campaignId: 'campaign-1',
        settlementId: 'settlement-1',
        name: 'Barracks',
        type: 'MILITARY',
        variables: {},
      };

      const calculations = (service as any).calculateMaintenanceEvents(structure);

      expect(calculations).toHaveLength(2);
      expect(calculations[0].eventType).toBe(MaintenanceEventType.MAINTENANCE_DUE);
      expect(calculations[1].eventType).toBe(MaintenanceEventType.UPGRADE_AVAILABLE);
    });

    it('should include construction completion event for structures under construction', () => {
      const structure: StructureSummary = {
        id: 'structure-1',
        campaignId: 'campaign-1',
        settlementId: 'settlement-1',
        name: 'New Barracks',
        type: 'MILITARY',
        variables: {
          constructionDurationMinutes: 60,
        },
      };

      const calculations = (service as any).calculateMaintenanceEvents(structure);

      expect(calculations.length).toBeGreaterThanOrEqual(1);
      expect(calculations[0].eventType).toBe(MaintenanceEventType.CONSTRUCTION_COMPLETE);
      expect(calculations[0].parameters.constructionDuration).toBe(60);
    });

    it('should not include maintenance events for non-operational structures', () => {
      const structure: StructureSummary = {
        id: 'structure-1',
        campaignId: 'campaign-1',
        settlementId: 'settlement-1',
        name: 'Broken Barracks',
        type: 'MILITARY',
        variables: {
          isOperational: false,
        },
      };

      const calculations = (service as any).calculateMaintenanceEvents(structure);

      // Should only have upgrade event if not operational
      const maintenanceEvents = calculations.filter(
        (c: any) => c.eventType === MaintenanceEventType.MAINTENANCE_DUE
      );
      expect(maintenanceEvents).toHaveLength(0);
    });

    it('should not include upgrade event for max-level structures', () => {
      const structure: StructureSummary = {
        id: 'structure-1',
        campaignId: 'campaign-1',
        settlementId: 'settlement-1',
        name: 'Max Level Barracks',
        type: 'MILITARY',
        variables: {
          level: 5,
          maxLevel: 5,
        },
      };

      const calculations = (service as any).calculateMaintenanceEvents(structure);

      const upgradeEvents = calculations.filter(
        (c: any) => c.eventType === MaintenanceEventType.UPGRADE_AVAILABLE
      );
      expect(upgradeEvents).toHaveLength(0);
    });

    it('should use custom maintenance interval from variables', () => {
      const structure: StructureSummary = {
        id: 'structure-1',
        campaignId: 'campaign-1',
        settlementId: 'settlement-1',
        name: 'High Maintenance Structure',
        type: 'ECONOMIC',
        variables: {
          maintenanceIntervalMinutes: 30, // Custom: 30 min instead of 120
        },
      };

      const calculations = (service as any).calculateMaintenanceEvents(structure);

      const maintenanceEvent = calculations.find(
        (c: any) => c.eventType === MaintenanceEventType.MAINTENANCE_DUE
      );

      // Check that interval is approximately correct (within 1 minute tolerance)
      const interval = (maintenanceEvent.nextExecutionTime.getTime() - Date.now()) / (60 * 1000);
      expect(interval).toBeGreaterThanOrEqual(29);
      expect(interval).toBeLessThanOrEqual(31);
    });

    it('should use default values for health and level when not provided', () => {
      const structure: StructureSummary = {
        id: 'structure-1',
        campaignId: 'campaign-1',
        settlementId: 'settlement-1',
        name: 'Basic Structure',
        type: 'ECONOMIC',
        variables: {},
      };

      const calculations = (service as any).calculateMaintenanceEvents(structure);

      const maintenanceEvent = calculations.find(
        (c: any) => c.eventType === MaintenanceEventType.MAINTENANCE_DUE
      );
      const upgradeEvent = calculations.find(
        (c: any) => c.eventType === MaintenanceEventType.UPGRADE_AVAILABLE
      );

      expect(maintenanceEvent.parameters.health).toBe(100);
      expect(upgradeEvent.parameters.currentLevel).toBe(1);
      expect(upgradeEvent.parameters.maxLevel).toBe(5);
    });

    it('should include custom upgrade requirements from variables', () => {
      const structure: StructureSummary = {
        id: 'structure-1',
        campaignId: 'campaign-1',
        settlementId: 'settlement-1',
        name: 'Advanced Barracks',
        type: 'MILITARY',
        variables: {
          level: 2,
          maxLevel: 5,
          requiredResourcesForUpgrade: {
            gold: 1000,
            materials: 500,
          },
        },
      };

      const calculations = (service as any).calculateMaintenanceEvents(structure);

      const upgradeEvent = calculations.find(
        (c: any) => c.eventType === MaintenanceEventType.UPGRADE_AVAILABLE
      );

      expect(upgradeEvent.parameters.requiredResourcesForUpgrade).toEqual({
        gold: 1000,
        materials: 500,
      });
    });

    it('should handle structure with construction, maintenance, and upgrade events', () => {
      const structure: StructureSummary = {
        id: 'structure-1',
        campaignId: 'campaign-1',
        settlementId: 'settlement-1',
        name: 'New Barracks',
        type: 'MILITARY',
        variables: {
          constructionDurationMinutes: 120,
          isOperational: true, // Will also need maintenance when operational
          level: 1,
          maxLevel: 5,
        },
      };

      const calculations = (service as any).calculateMaintenanceEvents(structure);

      // Should have all three event types
      expect(calculations).toHaveLength(3);
      expect(calculations.map((c: any) => c.eventType)).toContain(
        MaintenanceEventType.CONSTRUCTION_COMPLETE
      );
      expect(calculations.map((c: any) => c.eventType)).toContain(
        MaintenanceEventType.MAINTENANCE_DUE
      );
      expect(calculations.map((c: any) => c.eventType)).toContain(
        MaintenanceEventType.UPGRADE_AVAILABLE
      );
    });

    it('should skip construction event if duration is zero or negative', () => {
      const structure: StructureSummary = {
        id: 'structure-1',
        campaignId: 'campaign-1',
        settlementId: 'settlement-1',
        name: 'Instant Structure',
        type: 'ECONOMIC',
        variables: {
          constructionDurationMinutes: 0,
        },
      };

      const calculations = (service as any).calculateMaintenanceEvents(structure);

      const constructionEvents = calculations.filter(
        (c: any) => c.eventType === MaintenanceEventType.CONSTRUCTION_COMPLETE
      );
      expect(constructionEvents).toHaveLength(0);
    });
  });

  describe('queueMaintenanceJob', () => {
    it('should queue job with correct delay', async () => {
      const futureTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      const calculation = {
        campaignId: 'campaign-1',
        structureId: 'structure-1',
        eventType: MaintenanceEventType.MAINTENANCE_DUE,
        nextExecutionTime: futureTime,
        parameters: { health: 80 },
      };

      await (service as any).queueMaintenanceJob(calculation);

      expect(queueService.addJob).toHaveBeenCalledTimes(1);
      const callArgs = queueService.addJob.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        type: JobType.STRUCTURE_MAINTENANCE,
        campaignId: 'campaign-1',
        structureId: 'structure-1',
        maintenanceType: MaintenanceEventType.MAINTENANCE_DUE,
        parameters: { health: 80 },
        priority: JobPriority.NORMAL,
      });
      expect(callArgs[1]?.delay).toBeGreaterThan(0);
    });

    it('should queue overdue job with zero delay', async () => {
      const pastTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      const calculation = {
        campaignId: 'campaign-1',
        structureId: 'structure-1',
        eventType: MaintenanceEventType.CONSTRUCTION_COMPLETE,
        nextExecutionTime: pastTime,
        parameters: {},
      };

      await (service as any).queueMaintenanceJob(calculation);

      expect(queueService.addJob).toHaveBeenCalledTimes(1);
      const callArgs = queueService.addJob.mock.calls[0];
      expect(callArgs[1]?.delay).toBe(0);
    });

    it('should handle queue errors', async () => {
      queueService.addJob.mockRejectedValue(new Error('Queue full'));

      const calculation = {
        campaignId: 'campaign-1',
        structureId: 'structure-1',
        eventType: MaintenanceEventType.UPGRADE_AVAILABLE,
        nextExecutionTime: new Date(Date.now() + 60000),
        parameters: {},
      };

      await expect((service as any).queueMaintenanceJob(calculation)).rejects.toThrow('Queue full');
    });
  });
});
