/**
 * State Variable Versioning Integration Tests
 * Tests for Version history tracking, temporal queries, and Campaign.currentWorldTime integration
 */

import { Test, TestingModule } from '@nestjs/testing';
import type { PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { VariableScope } from '../types/state-variable.type';

import { AuditService } from './audit.service';
import { DependencyGraphService } from './dependency-graph.service';
import { StateVariableService } from './state-variable.service';
import { VariableEvaluationService } from './variable-evaluation.service';
import { VersionService } from './version.service';

describe('StateVariableService - Versioning Integration', () => {
  let service: StateVariableService;
  let prisma: DeepMockProxy<PrismaClient>;
  let versionService: DeepMockProxy<VersionService>;
  let evaluationService: DeepMockProxy<VariableEvaluationService>;
  let auditService: DeepMockProxy<AuditService>;

  const mockUser: AuthenticatedUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'user',
  };

  const mockCampaign = {
    id: 'campaign-123',
    ownerId: 'user-123',
    name: 'Test Campaign',
    worldId: 'world-123',
    currentWorldTime: new Date('2025-10-17T12:00:00Z'),
    memberships: [],
  };

  const mockBranch = {
    id: 'branch-123',
    name: 'main',
    campaignId: 'campaign-123',
    deletedAt: null,
  };

  const mockVariable = {
    id: 'var-123',
    scope: 'campaign',
    scopeId: 'campaign-123',
    key: 'test_counter',
    value: 10,
    type: 'integer',
    formula: null,
    description: 'Test counter',
    isActive: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: 'user-123',
    updatedBy: null,
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();
    versionService = mockDeep<VersionService>();
    evaluationService = mockDeep<VariableEvaluationService>();
    auditService = mockDeep<AuditService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StateVariableService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: VersionService,
          useValue: versionService,
        },
        {
          provide: VariableEvaluationService,
          useValue: evaluationService,
        },
        {
          provide: AuditService,
          useValue: auditService,
        },
        {
          provide: DependencyGraphService,
          useValue: {
            invalidateGraph: jest.fn(),
          },
        },
        {
          provide: 'REDIS_PUBSUB',
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StateVariableService>(StateVariableService);
  });

  describe('update with versioning', () => {
    it('should create version snapshot when branchId provided', async () => {
      // Mock variable lookup
      (prisma.stateVariable.findUnique as jest.Mock).mockResolvedValue(mockVariable);

      // Mock campaign access verification (for findById -> verifyScopeAccess)
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      // Mock branch lookup
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);

      // Mock campaign lookup for currentWorldTime
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);

      // Mock transaction
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const txMock = {
          stateVariable: {
            update: jest.fn().mockResolvedValue({ ...mockVariable, value: 20, version: 2 }),
          },
        };
        return callback(txMock);
      });

      // Mock version service
      (versionService.createVersion as jest.Mock).mockResolvedValue({
        id: 'version-123',
        entityType: 'state_variable',
        entityId: 'var-123',
        branchId: 'branch-123',
        validFrom: mockCampaign.currentWorldTime,
        validTo: null,
        version: 2,
      });

      // Mock audit log
      (auditService.log as jest.Mock).mockResolvedValue(undefined);

      // Call update with branchId
      const result = await service.update(
        'var-123',
        { value: 20 },
        mockUser,
        'branch-123' // This triggers versioning
      );

      // Verify version was created
      expect(versionService.createVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'state_variable',
          entityId: 'var-123',
          branchId: 'branch-123',
          validFrom: mockCampaign.currentWorldTime,
          validTo: null,
          payload: expect.objectContaining({
            id: 'var-123',
            value: 20,
            version: 2,
          }),
        }),
        mockUser
      );

      expect(result.version).toBe(2);
      expect(result.value).toBe(20);
    });

    it('should skip versioning when branchId not provided', async () => {
      // Mock variable lookup
      (prisma.stateVariable.findUnique as jest.Mock).mockResolvedValue(mockVariable);

      // Mock campaign access verification (for findById -> verifyScopeAccess)
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      // Mock direct update (no transaction)
      (prisma.stateVariable.update as jest.Mock).mockResolvedValue({
        ...mockVariable,
        value: 20,
        version: 2,
      });

      // Mock audit log
      (auditService.log as jest.Mock).mockResolvedValue(undefined);

      // Call update without branchId
      const result = await service.update('var-123', { value: 20 }, mockUser);

      // Verify no version was created
      expect(versionService.createVersion).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();

      expect(result.version).toBe(2);
      expect(result.value).toBe(20);
    });

    it('should skip versioning for world-scoped variables', async () => {
      const worldVariable = { ...mockVariable, scope: 'world', scopeId: null };

      // Mock variable lookup
      (prisma.stateVariable.findUnique as jest.Mock).mockResolvedValue(worldVariable);

      // Mock direct update
      (prisma.stateVariable.update as jest.Mock).mockResolvedValue({
        ...worldVariable,
        value: 20,
        version: 2,
      });

      // Mock audit log
      (auditService.log as jest.Mock).mockResolvedValue(undefined);

      // Call update with branchId (should be ignored for world scope)
      const result = await service.update('var-123', { value: 20 }, mockUser, 'branch-123');

      // Verify no version was created (world-scoped variables can't be versioned)
      expect(versionService.createVersion).not.toHaveBeenCalled();
      expect(result.version).toBe(2);
    });

    it('should use provided worldTime for version validFrom', async () => {
      const customTime = new Date('2025-10-18T08:00:00Z');

      // Mock variable lookup
      (prisma.stateVariable.findUnique as jest.Mock).mockResolvedValue(mockVariable);

      // Mock campaign access verification (for findById -> verifyScopeAccess)
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      // Mock branch lookup
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);

      // Mock transaction
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const txMock = {
          stateVariable: {
            update: jest.fn().mockResolvedValue({ ...mockVariable, value: 30, version: 2 }),
          },
        };
        return callback(txMock);
      });

      // Mock version service
      (versionService.createVersion as jest.Mock).mockResolvedValue({});

      // Mock audit log
      (auditService.log as jest.Mock).mockResolvedValue(undefined);

      // Call update with custom worldTime
      await service.update('var-123', { value: 30 }, mockUser, 'branch-123', customTime);

      // Verify version used custom worldTime
      expect(versionService.createVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          validFrom: customTime,
        }),
        mockUser
      );
    });

    it('should use current date when no worldTime and no Campaign.currentWorldTime', async () => {
      // Mock variable lookup
      (prisma.stateVariable.findUnique as jest.Mock).mockResolvedValue(mockVariable);

      // Mock campaign access verification (for findById -> verifyScopeAccess)
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      // Mock branch lookup
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);

      // Mock campaign with no currentWorldTime
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        currentWorldTime: null,
      });

      // Mock transaction
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const txMock = {
          stateVariable: {
            update: jest.fn().mockResolvedValue({ ...mockVariable, value: 40, version: 2 }),
          },
        };
        return callback(txMock);
      });

      // Mock version service
      (versionService.createVersion as jest.Mock).mockResolvedValue({});

      // Mock audit log
      (auditService.log as jest.Mock).mockResolvedValue(undefined);

      // Call update without worldTime
      await service.update('var-123', { value: 40 }, mockUser, 'branch-123');

      // Verify version used a Date (fallback to now)
      expect(versionService.createVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          validFrom: expect.any(Date),
        }),
        mockUser
      );
    });

    it('should throw error if branch not found', async () => {
      // Mock variable lookup
      (prisma.stateVariable.findUnique as jest.Mock).mockResolvedValue(mockVariable);

      // Mock campaign access verification (for findById -> verifyScopeAccess)
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      // Mock branch not found
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);

      // Attempt update with invalid branch
      await expect(
        service.update('var-123', { value: 20 }, mockUser, 'invalid-branch')
      ).rejects.toThrow('Branch with ID invalid-branch not found');
    });
  });

  describe('getVariableAsOf', () => {
    it('should retrieve historical variable state', async () => {
      const historicalPayload = { ...mockVariable, value: 5, version: 1 };

      // Mock variable lookup
      (prisma.stateVariable.findUnique as jest.Mock).mockResolvedValue(mockVariable);

      // Mock campaign access verification (for findById -> verifyScopeAccess)
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      // Mock version resolution
      (versionService.resolveVersion as jest.Mock).mockResolvedValue({
        id: 'version-123',
        entityType: 'state_variable',
        entityId: 'var-123',
        payloadGz: Buffer.from('compressed'),
      });

      // Mock decompression
      (versionService.decompressVersion as jest.Mock).mockResolvedValue(historicalPayload);

      // Get variable as of a specific time
      const result = await service.getVariableAsOf(
        'var-123',
        'branch-123',
        new Date('2025-10-15T00:00:00Z'),
        mockUser
      );

      expect(result).toEqual(historicalPayload);
      expect(versionService.resolveVersion).toHaveBeenCalledWith(
        'state_variable',
        'var-123',
        'branch-123',
        new Date('2025-10-15T00:00:00Z')
      );
    });

    it('should return null if no version exists for time', async () => {
      // Mock variable lookup
      (prisma.stateVariable.findUnique as jest.Mock).mockResolvedValue(mockVariable);

      // Mock version not found
      (versionService.resolveVersion as jest.Mock).mockResolvedValue(null);

      // Get variable as of a time with no version
      const result = await service.getVariableAsOf(
        'var-123',
        'branch-123',
        new Date('2020-01-01T00:00:00Z'),
        mockUser
      );

      expect(result).toBeNull();
    });

    it('should throw error for world-scoped variables', async () => {
      const worldVariable = { ...mockVariable, scope: 'world', scopeId: null };

      // Mock variable lookup
      (prisma.stateVariable.findUnique as jest.Mock).mockResolvedValue(worldVariable);

      // Attempt to get historical state
      await expect(
        service.getVariableAsOf('var-123', 'branch-123', new Date(), mockUser)
      ).rejects.toThrow('World-scoped variables do not have version history');
    });
  });

  describe('getVariableHistory', () => {
    it('should retrieve full version history', async () => {
      const mockHistory = [
        {
          id: 'version-3',
          version: 3,
          validFrom: new Date('2025-10-17T14:00:00Z'),
          validTo: null,
          createdBy: 'user-123',
          createdAt: new Date('2025-10-17T14:00:00Z'),
        },
        {
          id: 'version-2',
          version: 2,
          validFrom: new Date('2025-10-17T12:00:00Z'),
          validTo: new Date('2025-10-17T14:00:00Z'),
          createdBy: 'user-123',
          createdAt: new Date('2025-10-17T12:00:00Z'),
        },
        {
          id: 'version-1',
          version: 1,
          validFrom: new Date('2025-10-17T10:00:00Z'),
          validTo: new Date('2025-10-17T12:00:00Z'),
          createdBy: 'user-123',
          createdAt: new Date('2025-10-17T10:00:00Z'),
        },
      ];

      // Mock variable lookup
      (prisma.stateVariable.findUnique as jest.Mock).mockResolvedValue(mockVariable);

      // Mock campaign access verification (for findById -> verifyScopeAccess)
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      // Mock history retrieval
      (versionService.findVersionHistory as jest.Mock).mockResolvedValue(mockHistory);

      // Get history
      const result = await service.getVariableHistory('var-123', 'branch-123', mockUser);

      expect(result).toHaveLength(3);
      expect(result[0].version).toBe(3);
      expect(result[1].version).toBe(2);
      expect(result[2].version).toBe(1);
      expect(versionService.findVersionHistory).toHaveBeenCalledWith(
        'state_variable',
        'var-123',
        'branch-123',
        mockUser
      );
    });

    it('should throw error for world-scoped variables', async () => {
      const worldVariable = { ...mockVariable, scope: 'world', scopeId: null };

      // Mock variable lookup
      (prisma.stateVariable.findUnique as jest.Mock).mockResolvedValue(worldVariable);

      // Attempt to get history
      await expect(service.getVariableHistory('var-123', 'branch-123', mockUser)).rejects.toThrow(
        'World-scoped variables do not have version history'
      );
    });

    it('should throw error if variable not found', async () => {
      // Mock variable not found
      (prisma.stateVariable.findUnique as jest.Mock).mockResolvedValue(null);

      // Attempt to get history
      await expect(
        service.getVariableHistory('invalid-id', 'branch-123', mockUser)
      ).rejects.toThrow('StateVariable with ID invalid-id not found');
    });
  });

  describe('getCampaignIdForScope', () => {
    it('should return scopeId for campaign scope', async () => {
      // Access private method via any cast for testing
      const campaignId = await (
        service as unknown as {
          getCampaignIdForScope: (scope: string, scopeId: string) => Promise<string>;
        }
      ).getCampaignIdForScope(VariableScope.CAMPAIGN, 'campaign-123');
      expect(campaignId).toBe('campaign-123');
    });

    it('should traverse to campaign for party scope', async () => {
      (prisma.party.findUnique as jest.Mock).mockResolvedValue({
        id: 'party-123',
        campaignId: 'campaign-456',
      });

      const campaignId = await (
        service as unknown as {
          getCampaignIdForScope: (scope: string, scopeId: string) => Promise<string>;
        }
      ).getCampaignIdForScope(VariableScope.PARTY, 'party-123');
      expect(campaignId).toBe('campaign-456');
    });

    it('should traverse to campaign for settlement scope', async () => {
      (prisma.settlement.findUnique as jest.Mock).mockResolvedValue({
        id: 'settlement-123',
        kingdom: { campaignId: 'campaign-789' },
      });

      const campaignId = await (
        service as unknown as {
          getCampaignIdForScope: (scope: string, scopeId: string) => Promise<string>;
        }
      ).getCampaignIdForScope(VariableScope.SETTLEMENT, 'settlement-123');
      expect(campaignId).toBe('campaign-789');
    });

    it('should throw error for location scope (no direct campaign)', async () => {
      await expect(
        (
          service as unknown as {
            getCampaignIdForScope: (scope: string, scopeId: string) => Promise<string>;
          }
        ).getCampaignIdForScope(VariableScope.LOCATION, 'location-123')
      ).rejects.toThrow('Location-scoped variables cannot be versioned');
    });
  });
});
