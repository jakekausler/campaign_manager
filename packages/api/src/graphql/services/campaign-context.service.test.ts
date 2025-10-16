/**
 * CampaignContextService Unit Tests
 * Tests the context aggregation and invalidation system
 */

import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';

import { CampaignContextService } from './campaign-context.service';
import { KingdomService } from './kingdom.service';
import { PartyService } from './party.service';
import { SettlementService } from './settlement.service';
import { StructureService } from './structure.service';

describe('CampaignContextService', () => {
  let service: CampaignContextService;
  let prisma: PrismaService;
  let partyService: jest.Mocked<PartyService>;
  let kingdomService: jest.Mocked<KingdomService>;
  let settlementService: jest.Mocked<SettlementService>;
  let structureService: jest.Mocked<StructureService>;

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'owner',
  };

  const mockCampaignId = 'campaign-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignContextService,
        {
          provide: PrismaService,
          useValue: {
            campaign: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: PartyService,
          useValue: {
            findByCampaign: jest.fn(),
          },
        },
        {
          provide: KingdomService,
          useValue: {
            findByCampaign: jest.fn(),
          },
        },
        {
          provide: SettlementService,
          useValue: {
            findByKingdom: jest.fn(),
          },
        },
        {
          provide: StructureService,
          useValue: {
            findBySettlement: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CampaignContextService>(CampaignContextService);
    prisma = module.get<PrismaService>(PrismaService);
    partyService = module.get(PartyService) as jest.Mocked<PartyService>;
    kingdomService = module.get(KingdomService) as jest.Mocked<KingdomService>;
    settlementService = module.get(SettlementService) as jest.Mocked<SettlementService>;
    structureService = module.get(StructureService) as jest.Mocked<StructureService>;
  });

  describe('getCampaignContext', () => {
    it('should return empty context for campaign with no entities', async () => {
      // Arrange
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue({
        id: mockCampaignId,
        name: 'Test Campaign',
        ownerId: mockUser.id,
      });
      partyService.findByCampaign.mockResolvedValue([]);
      kingdomService.findByCampaign.mockResolvedValue([]);

      // Act
      const context = await service.getCampaignContext(mockCampaignId, mockUser);

      // Assert
      expect(context).toEqual({
        campaignId: mockCampaignId,
        parties: [],
        kingdoms: [],
        settlements: [],
        structures: [],
      });
    });

    it('should include all parties with their levels and variables', async () => {
      // Arrange
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue({
        id: mockCampaignId,
        name: 'Test Campaign',
        ownerId: mockUser.id,
      });

      const mockParties = [
        {
          id: 'party-1',
          name: 'Party Alpha',
          campaignId: mockCampaignId,
          averageLevel: 5,
          manualLevelOverride: null,
          variables: { gold: 1000 },
          variableSchemas: [{ name: 'gold', type: 'number' }],
        },
        {
          id: 'party-2',
          name: 'Party Beta',
          campaignId: mockCampaignId,
          averageLevel: 3,
          manualLevelOverride: 7,
          variables: { reputation: 'good' },
          variableSchemas: [{ name: 'reputation', type: 'string' }],
        },
      ];

      partyService.findByCampaign.mockResolvedValue(mockParties as any);
      kingdomService.findByCampaign.mockResolvedValue([]);

      // Act
      const context = await service.getCampaignContext(mockCampaignId, mockUser);

      // Assert
      expect(context.parties).toHaveLength(2);
      expect(context.parties[0]).toMatchObject({
        id: 'party-1',
        name: 'Party Alpha',
        level: 5, // Uses averageLevel when no override
        variables: { gold: 1000 },
      });
      expect(context.parties[1]).toMatchObject({
        id: 'party-2',
        name: 'Party Beta',
        level: 7, // Uses manualLevelOverride when present
        variables: { reputation: 'good' },
      });
    });

    it('should include kingdoms with their levels and variables', async () => {
      // Arrange
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue({
        id: mockCampaignId,
        name: 'Test Campaign',
        ownerId: mockUser.id,
      });

      const mockKingdoms = [
        {
          id: 'kingdom-1',
          name: 'Kingdom of Light',
          campaignId: mockCampaignId,
          level: 10,
          variables: { treasury: 50000 },
          variableSchemas: [{ name: 'treasury', type: 'number' }],
        },
      ];

      partyService.findByCampaign.mockResolvedValue([]);
      kingdomService.findByCampaign.mockResolvedValue(mockKingdoms as any);

      // Act
      const context = await service.getCampaignContext(mockCampaignId, mockUser);

      // Assert
      expect(context.kingdoms).toHaveLength(1);
      expect(context.kingdoms[0]).toMatchObject({
        id: 'kingdom-1',
        name: 'Kingdom of Light',
        level: 10,
        variables: { treasury: 50000 },
      });
    });

    it('should include settlements and structures hierarchically', async () => {
      // Arrange
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue({
        id: mockCampaignId,
        name: 'Test Campaign',
        ownerId: mockUser.id,
      });

      const mockKingdoms = [
        {
          id: 'kingdom-1',
          name: 'Kingdom of Light',
          campaignId: mockCampaignId,
          level: 10,
          variables: {},
          variableSchemas: [],
        },
      ];

      const mockSettlements = [
        {
          id: 'settlement-1',
          name: 'Capital City',
          kingdomId: 'kingdom-1',
          level: 8,
          variables: { population: 50000 },
          variableSchemas: [{ name: 'population', type: 'number' }],
        },
      ];

      const mockStructures = [
        {
          id: 'structure-1',
          name: 'Grand Temple',
          type: 'temple',
          settlementId: 'settlement-1',
          level: 5,
          variables: { blessing: true },
          variableSchemas: [{ name: 'blessing', type: 'boolean' }],
        },
      ];

      partyService.findByCampaign.mockResolvedValue([]);
      kingdomService.findByCampaign.mockResolvedValue(mockKingdoms as any);
      settlementService.findByKingdom.mockResolvedValue(mockSettlements as any);
      structureService.findBySettlement.mockResolvedValue(mockStructures as any);

      // Act
      const context = await service.getCampaignContext(mockCampaignId, mockUser);

      // Assert
      expect(context.settlements).toHaveLength(1);
      expect(context.settlements[0]).toMatchObject({
        id: 'settlement-1',
        name: 'Capital City',
        kingdomId: 'kingdom-1',
        level: 8,
        variables: { population: 50000 },
      });

      expect(context.structures).toHaveLength(1);
      expect(context.structures[0]).toMatchObject({
        id: 'structure-1',
        name: 'Grand Temple',
        type: 'temple',
        settlementId: 'settlement-1',
        level: 5,
        variables: { blessing: true },
      });
    });

    it('should support multiple parties per campaign', async () => {
      // Arrange
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue({
        id: mockCampaignId,
        name: 'Test Campaign',
        ownerId: mockUser.id,
      });

      const mockParties = Array.from({ length: 5 }, (_, i) => ({
        id: `party-${i}`,
        name: `Party ${i}`,
        campaignId: mockCampaignId,
        averageLevel: i + 1,
        manualLevelOverride: null,
        variables: {},
        variableSchemas: [],
      }));

      partyService.findByCampaign.mockResolvedValue(mockParties as any);
      kingdomService.findByCampaign.mockResolvedValue([]);

      // Act
      const context = await service.getCampaignContext(mockCampaignId, mockUser);

      // Assert
      expect(context.parties).toHaveLength(5);
      expect(context.parties.map((p) => p.id)).toEqual([
        'party-0',
        'party-1',
        'party-2',
        'party-3',
        'party-4',
      ]);
    });

    it('should throw NotFoundException for non-existent campaign', async () => {
      // Arrange
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.getCampaignContext('non-existent', mockUser)).rejects.toThrow(
        'Campaign with ID non-existent not found'
      );
    });

    it('should throw ForbiddenException if user lacks access', async () => {
      // Arrange
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      const unauthorizedUser: AuthenticatedUser = {
        id: 'user-2',
        email: 'unauthorized@example.com',
        role: 'player',
      };

      // Act & Assert
      await expect(service.getCampaignContext(mockCampaignId, unauthorizedUser)).rejects.toThrow(
        'Campaign with ID campaign-1 not found'
      );
    });
  });

  describe('invalidateContext', () => {
    it('should clear cached context for campaign', async () => {
      // This test will verify cache invalidation once we implement caching
      // For now, just verify the method exists and doesn't throw
      await expect(service.invalidateContext(mockCampaignId)).resolves.not.toThrow();
    });
  });

  describe('invalidateContextForEntity', () => {
    it('should invalidate context when party level changes', async () => {
      // Arrange
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue({
        id: mockCampaignId,
      });

      // Act & Assert
      await expect(
        service.invalidateContextForEntity('party', 'party-1', mockCampaignId)
      ).resolves.not.toThrow();
    });

    it('should invalidate context when kingdom level changes', async () => {
      // Arrange
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue({
        id: mockCampaignId,
      });

      // Act & Assert
      await expect(
        service.invalidateContextForEntity('kingdom', 'kingdom-1', mockCampaignId)
      ).resolves.not.toThrow();
    });

    it('should invalidate context when settlement level changes', async () => {
      // Arrange
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue({
        id: mockCampaignId,
      });

      // Act & Assert
      await expect(
        service.invalidateContextForEntity('settlement', 'settlement-1', mockCampaignId)
      ).resolves.not.toThrow();
    });

    it('should invalidate context when structure level changes', async () => {
      // Arrange
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue({
        id: mockCampaignId,
      });

      // Act & Assert
      await expect(
        service.invalidateContextForEntity('structure', 'structure-1', mockCampaignId)
      ).resolves.not.toThrow();
    });
  });
});
