import { Test, TestingModule } from '@nestjs/testing';

import { ApiClientService, EventSummary } from '../api/api-client.service';

import { EventExpirationService } from './event-expiration.service';

describe('EventExpirationService', () => {
  let service: EventExpirationService;
  let apiClientService: jest.Mocked<ApiClientService>;

  beforeEach(async () => {
    // Create mock API client service
    apiClientService = {
      getOverdueEvents: jest.fn(),
      getAllCampaignIds: jest.fn(),
      expireEvent: jest.fn(),
    } as unknown as jest.Mocked<ApiClientService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventExpirationService,
        {
          provide: ApiClientService,
          useValue: apiClientService,
        },
      ],
    }).compile();

    service = module.get<EventExpirationService>(EventExpirationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processExpiration', () => {
    const campaignId = 'test-campaign-id';

    it('should return empty result when no overdue events found', async () => {
      apiClientService.getOverdueEvents.mockResolvedValue([]);

      const result = await service.processExpiration(campaignId);

      expect(result).toEqual({
        totalChecked: 0,
        expired: 0,
        errors: 0,
        expiredEventIds: [],
        errorMessages: [],
      });
      expect(apiClientService.getOverdueEvents).toHaveBeenCalledWith(campaignId);
      expect(apiClientService.expireEvent).not.toHaveBeenCalled();
    });

    it('should expire all overdue events successfully', async () => {
      const overdueEvents: EventSummary[] = [
        {
          id: 'event-1',
          campaignId,
          name: 'Test Event 1',
          eventType: 'story',
          scheduledAt: '2025-01-01T00:00:00Z',
          isCompleted: false,
        },
        {
          id: 'event-2',
          campaignId,
          name: 'Test Event 2',
          eventType: 'kingdom',
          scheduledAt: '2025-01-02T00:00:00Z',
          isCompleted: false,
        },
      ];

      apiClientService.getOverdueEvents.mockResolvedValue(overdueEvents);
      apiClientService.expireEvent.mockResolvedValue({
        id: 'event-1',
        isCompleted: true,
        occurredAt: '2025-01-10T00:00:00Z',
      });

      const result = await service.processExpiration(campaignId);

      expect(result).toEqual({
        totalChecked: 2,
        expired: 2,
        errors: 0,
        expiredEventIds: ['event-1', 'event-2'],
        errorMessages: [],
      });
      expect(apiClientService.expireEvent).toHaveBeenCalledTimes(2);
      expect(apiClientService.expireEvent).toHaveBeenCalledWith('event-1');
      expect(apiClientService.expireEvent).toHaveBeenCalledWith('event-2');
    });

    it('should handle partial failures gracefully', async () => {
      const overdueEvents: EventSummary[] = [
        {
          id: 'event-1',
          campaignId,
          name: 'Test Event 1',
          eventType: 'story',
          scheduledAt: '2025-01-01T00:00:00Z',
          isCompleted: false,
        },
        {
          id: 'event-2',
          campaignId,
          name: 'Test Event 2',
          eventType: 'kingdom',
          scheduledAt: '2025-01-02T00:00:00Z',
          isCompleted: false,
        },
      ];

      apiClientService.getOverdueEvents.mockResolvedValue(overdueEvents);
      apiClientService.expireEvent
        .mockResolvedValueOnce({
          id: 'event-1',
          isCompleted: true,
          occurredAt: '2025-01-10T00:00:00Z',
        })
        .mockRejectedValueOnce(new Error('API error'));

      const result = await service.processExpiration(campaignId);

      expect(result).toEqual({
        totalChecked: 2,
        expired: 1,
        errors: 1,
        expiredEventIds: ['event-1'],
        errorMessages: ['Event event-2: API error'],
      });
      expect(apiClientService.expireEvent).toHaveBeenCalledTimes(2);
    });

    it('should process events in batches', async () => {
      // Create 25 overdue events (3 batches of 10, 10, 5)
      const overdueEvents: EventSummary[] = Array.from({ length: 25 }, (_, i) => ({
        id: `event-${i}`,
        campaignId,
        name: `Test Event ${i}`,
        eventType: 'story',
        scheduledAt: `2025-01-0${Math.floor(i / 10) + 1}T00:00:00Z`,
        isCompleted: false,
      }));

      apiClientService.getOverdueEvents.mockResolvedValue(overdueEvents);
      apiClientService.expireEvent.mockResolvedValue({
        id: 'event-1',
        isCompleted: true,
        occurredAt: '2025-01-10T00:00:00Z',
      });

      const result = await service.processExpiration(campaignId);

      expect(result).toEqual({
        totalChecked: 25,
        expired: 25,
        errors: 0,
        expiredEventIds: overdueEvents.map((e) => e.id),
        errorMessages: [],
      });
      expect(apiClientService.expireEvent).toHaveBeenCalledTimes(25);
    });

    it('should throw error when API query fails', async () => {
      apiClientService.getOverdueEvents.mockRejectedValue(new Error('API error'));

      await expect(service.processExpiration(campaignId)).rejects.toThrow('API error');
    });
  });

  describe('processAllCampaigns', () => {
    it('should return empty result when no campaigns found', async () => {
      apiClientService.getAllCampaignIds.mockResolvedValue([]);

      const result = await service.processAllCampaigns();

      expect(result).toEqual({
        totalChecked: 0,
        expired: 0,
        errors: 0,
        expiredEventIds: [],
        errorMessages: [],
      });
      expect(apiClientService.getAllCampaignIds).toHaveBeenCalled();
      expect(apiClientService.getOverdueEvents).not.toHaveBeenCalled();
    });

    it('should process multiple campaigns successfully', async () => {
      const campaignIds = ['campaign-1', 'campaign-2'];
      const overdueEvents1: EventSummary[] = [
        {
          id: 'event-1',
          campaignId: 'campaign-1',
          name: 'Test Event 1',
          eventType: 'story',
          scheduledAt: '2025-01-01T00:00:00Z',
          isCompleted: false,
        },
      ];
      const overdueEvents2: EventSummary[] = [
        {
          id: 'event-2',
          campaignId: 'campaign-2',
          name: 'Test Event 2',
          eventType: 'kingdom',
          scheduledAt: '2025-01-02T00:00:00Z',
          isCompleted: false,
        },
      ];

      apiClientService.getAllCampaignIds.mockResolvedValue(campaignIds);
      apiClientService.getOverdueEvents
        .mockResolvedValueOnce(overdueEvents1)
        .mockResolvedValueOnce(overdueEvents2);
      apiClientService.expireEvent.mockResolvedValue({
        id: 'event-1',
        isCompleted: true,
        occurredAt: '2025-01-10T00:00:00Z',
      });

      const result = await service.processAllCampaigns();

      expect(result).toEqual({
        totalChecked: 2,
        expired: 2,
        errors: 0,
        expiredEventIds: ['event-1', 'event-2'],
        errorMessages: [],
      });
      expect(apiClientService.getOverdueEvents).toHaveBeenCalledTimes(2);
      expect(apiClientService.getOverdueEvents).toHaveBeenCalledWith('campaign-1');
      expect(apiClientService.getOverdueEvents).toHaveBeenCalledWith('campaign-2');
    });

    it('should handle campaign processing failures gracefully', async () => {
      const campaignIds = ['campaign-1', 'campaign-2'];

      apiClientService.getAllCampaignIds.mockResolvedValue(campaignIds);
      apiClientService.getOverdueEvents
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('Campaign API error'));

      const result = await service.processAllCampaigns();

      expect(result).toEqual({
        totalChecked: 0,
        expired: 0,
        errors: 1,
        expiredEventIds: [],
        errorMessages: ['Campaign campaign-2: Campaign API error'],
      });
    });

    it('should throw error when getAllCampaignIds fails', async () => {
      apiClientService.getAllCampaignIds.mockRejectedValue(new Error('API error'));

      await expect(service.processAllCampaigns()).rejects.toThrow('API error');
    });
  });

  describe('grace period configuration', () => {
    it('should return default grace period of 5 minutes', () => {
      expect(service.getGracePeriodMinutes()).toBe(5);
    });

    it('should allow setting grace period', () => {
      service.setGracePeriodMinutes(10);
      expect(service.getGracePeriodMinutes()).toBe(10);
    });

    it('should throw error for negative grace period', () => {
      expect(() => service.setGracePeriodMinutes(-1)).toThrow('Grace period must be non-negative');
    });

    it('should allow zero grace period', () => {
      service.setGracePeriodMinutes(0);
      expect(service.getGracePeriodMinutes()).toBe(0);
    });
  });
});
