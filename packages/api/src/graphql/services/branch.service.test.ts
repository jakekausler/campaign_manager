/**
 * Branch Service Tests
 * Unit tests for branch CRUD operations, hierarchy, and validation
 */

import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';

import { AuditService } from './audit.service';
import { BranchService } from './branch.service';
import { VersionService } from './version.service';

describe('BranchService', () => {
  let service: BranchService;
  let prisma: PrismaService;
  let audit: AuditService;
  let versionService: VersionService;

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'user',
  };

  const mockCampaign = {
    id: 'campaign-1',
    name: 'Test Campaign',
    worldId: 'world-1',
    ownerId: 'user-1',
    settings: {},
    isActive: true,
    currentWorldTime: new Date('4707-03-15T12:00:00Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    archivedAt: null,
    version: 1,
  };

  const mockBranch = {
    id: 'branch-1',
    campaignId: 'campaign-1',
    name: 'Main',
    description: 'Primary timeline',
    parentId: null,
    divergedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockChildBranch = {
    id: 'branch-2',
    campaignId: 'campaign-1',
    name: 'Alternate Timeline',
    description: 'What if the party saved the village',
    parentId: 'branch-1',
    divergedAt: new Date('4707-03-15T12:00:00Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    // Create mock prisma service with proper typing
    const mockPrismaService: any = {
      campaign: {
        findFirst: jest.fn(),
      },
      branch: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      version: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    // Configure transaction to pass through the callback
    mockPrismaService.$transaction.mockImplementation((callback: any) =>
      callback(mockPrismaService)
    );

    // Create mock audit service
    const mockAuditService = {
      log: jest.fn(),
    };

    // Create mock version service
    const mockVersionService = {
      resolveVersion: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: VersionService,
          useValue: mockVersionService,
        },
      ],
    }).compile();

    service = module.get<BranchService>(BranchService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
    versionService = module.get<VersionService>(VersionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return branch with relations', async () => {
      const branchWithRelations = {
        ...mockBranch,
        parent: null,
        children: [],
        campaign: mockCampaign,
      };

      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(branchWithRelations);

      const result = await service.findById('branch-1');

      expect(result).toEqual(branchWithRelations);
      expect(prisma.branch.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'branch-1',
          deletedAt: null,
        },
        include: {
          parent: true,
          children: {
            where: { deletedAt: null },
          },
          campaign: true,
        },
      });
    });

    it('should return null for non-existent branch', async () => {
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should exclude soft-deleted branches', async () => {
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);

      await service.findById('deleted-branch');

      expect(prisma.branch.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      );
    });
  });

  describe('findByCampaign', () => {
    it('should return all branches for a campaign', async () => {
      const branches = [
        { ...mockBranch, parent: null, children: [mockChildBranch] },
        { ...mockChildBranch, parent: mockBranch, children: [] },
      ];

      (prisma.branch.findMany as jest.Mock).mockResolvedValue(branches);

      const result = await service.findByCampaign('campaign-1');

      expect(result).toEqual(branches);
      expect(prisma.branch.findMany).toHaveBeenCalledWith({
        where: {
          campaignId: 'campaign-1',
          deletedAt: null,
        },
        include: {
          parent: true,
          children: {
            where: { deletedAt: null },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    });

    it('should return empty array for campaign with no branches', async () => {
      (prisma.branch.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findByCampaign('campaign-no-branches');

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create root branch successfully', async () => {
      const input = {
        campaignId: 'campaign-1',
        name: 'Main',
        description: 'Primary timeline',
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.branch.create as jest.Mock).mockResolvedValue({
        ...mockBranch,
        parent: null,
        children: [],
      });

      const result = await service.create(input, mockUser);

      expect(result).toEqual({
        ...mockBranch,
        parent: null,
        children: [],
      });
      expect(prisma.campaign.findFirst).toHaveBeenCalledWith({
        where: { id: 'campaign-1', deletedAt: null },
      });
      expect(prisma.branch.create).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        'branch',
        mockBranch.id,
        'CREATE',
        mockUser.id,
        expect.any(Object)
      );
    });

    it('should create child branch with parent reference', async () => {
      const input = {
        campaignId: 'campaign-1',
        name: 'Alternate',
        description: 'What if scenario',
        parentId: 'branch-1',
        divergedAt: new Date('4707-03-15T12:00:00Z'),
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);
      (prisma.branch.create as jest.Mock).mockResolvedValue({
        ...mockChildBranch,
        parent: mockBranch,
        children: [],
      });

      const result = await service.create(input, mockUser);

      expect(result.parentId).toBe('branch-1');
      expect(prisma.branch.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'branch-1',
          campaignId: 'campaign-1',
          deletedAt: null,
        },
      });
    });

    it('should throw NotFoundException when campaign does not exist', async () => {
      const input = {
        campaignId: 'non-existent',
        name: 'Test Branch',
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(input, mockUser)).rejects.toThrow(NotFoundException);
      await expect(service.create(input, mockUser)).rejects.toThrow(
        'Campaign with ID non-existent not found'
      );
    });

    it('should throw BadRequestException when parent branch does not exist', async () => {
      const input = {
        campaignId: 'campaign-1',
        name: 'Test Branch',
        parentId: 'non-existent-parent',
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(input, mockUser)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when parent belongs to different campaign', async () => {
      const input = {
        campaignId: 'campaign-1',
        name: 'Test Branch',
        parentId: 'branch-other-campaign',
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null); // No match with campaignId filter

      await expect(service.create(input, mockUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update branch name and description', async () => {
      const input = {
        name: 'Updated Name',
        description: 'Updated Description',
      };

      const branchWithRelations = {
        ...mockBranch,
        parent: null,
        children: [],
        campaign: mockCampaign,
      };

      (prisma.branch.findFirst as jest.Mock)
        .mockResolvedValueOnce(branchWithRelations) // findById
        .mockResolvedValueOnce(branchWithRelations); // findById again within update

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.branch.update as jest.Mock).mockResolvedValue({
        ...branchWithRelations,
        ...input,
      });

      const result = await service.update('branch-1', input, mockUser);

      expect(result.name).toBe('Updated Name');
      expect(result.description).toBe('Updated Description');
      expect(prisma.branch.update).toHaveBeenCalledWith({
        where: { id: 'branch-1' },
        data: input,
        include: {
          parent: true,
          children: {
            where: { deletedAt: null },
          },
        },
      });
      expect(audit.log).toHaveBeenCalledWith('branch', 'branch-1', 'UPDATE', mockUser.id, input);
    });

    it('should throw NotFoundException when branch does not exist', async () => {
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.update('non-existent', { name: 'Test' }, mockUser)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException when user lacks campaign access', async () => {
      const branchWithRelations = {
        ...mockBranch,
        parent: null,
        children: [],
        campaign: mockCampaign,
      };

      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(branchWithRelations);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null); // No access

      await expect(service.update('branch-1', { name: 'Test' }, mockUser)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('delete', () => {
    it('should soft delete branch without children', async () => {
      const branchWithRelations = {
        ...mockBranch,
        parent: null,
        children: [],
        campaign: mockCampaign,
      };

      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(branchWithRelations);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.branch.count as jest.Mock).mockResolvedValue(0); // No children
      (prisma.branch.update as jest.Mock).mockResolvedValue({
        ...mockBranch,
        deletedAt: new Date(),
      });

      const result = await service.delete('branch-1', mockUser);

      expect(result.deletedAt).toBeTruthy();
      expect(prisma.branch.count).toHaveBeenCalledWith({
        where: {
          parentId: 'branch-1',
          deletedAt: null,
        },
      });
      expect(audit.log).toHaveBeenCalledWith(
        'branch',
        'branch-1',
        'DELETE',
        mockUser.id,
        expect.any(Object)
      );
    });

    it('should throw BadRequestException when branch has children', async () => {
      const branchWithRelations = {
        ...mockBranch,
        parent: null,
        children: [mockChildBranch],
        campaign: mockCampaign,
      };

      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(branchWithRelations);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.branch.count as jest.Mock).mockResolvedValue(1); // Has children

      await expect(service.delete('branch-1', mockUser)).rejects.toThrow(BadRequestException);
      await expect(service.delete('branch-1', mockUser)).rejects.toThrow(
        'Cannot delete branch with 1 child branch(es)'
      );
    });

    it('should throw NotFoundException when branch does not exist', async () => {
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('non-existent', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user lacks campaign access', async () => {
      const branchWithRelations = {
        ...mockBranch,
        parent: null,
        children: [],
        campaign: mockCampaign,
      };

      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(branchWithRelations);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null); // No access

      await expect(service.delete('branch-1', mockUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getHierarchy', () => {
    it('should return tree structure with root and children', async () => {
      const branches = [
        { ...mockBranch, parent: null, children: [] },
        { ...mockChildBranch, parent: mockBranch, children: [] },
      ];

      (prisma.branch.findMany as jest.Mock).mockResolvedValue(branches);

      const result = await service.getHierarchy('campaign-1');

      expect(result).toHaveLength(1); // One root
      expect(result[0].branch.id).toBe('branch-1');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].branch.id).toBe('branch-2');
    });

    it('should return multiple roots when branches have no parent', async () => {
      const root1 = { ...mockBranch, id: 'root-1', parentId: null };
      const root2 = { ...mockBranch, id: 'root-2', parentId: null };

      (prisma.branch.findMany as jest.Mock).mockResolvedValue([root1, root2]);

      const result = await service.getHierarchy('campaign-1');

      expect(result).toHaveLength(2);
    });

    it('should handle orphaned branches (parent deleted)', async () => {
      const orphan = { ...mockChildBranch, parentId: 'deleted-parent' };

      (prisma.branch.findMany as jest.Mock).mockResolvedValue([orphan]);

      const result = await service.getHierarchy('campaign-1');

      expect(result).toHaveLength(1); // Orphan treated as root
      expect(result[0].branch.id).toBe('branch-2');
    });

    it('should return empty array for campaign with no branches', async () => {
      (prisma.branch.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getHierarchy('campaign-1');

      expect(result).toEqual([]);
    });
  });

  describe('getAncestry', () => {
    it('should return ancestry chain from root to branch', async () => {
      const grandchild = {
        id: 'branch-3',
        campaignId: 'campaign-1',
        parentId: 'branch-2',
        name: 'Grandchild',
        parent: mockChildBranch,
      };

      (prisma.branch.findFirst as jest.Mock)
        .mockResolvedValueOnce({ ...grandchild, parent: mockChildBranch })
        .mockResolvedValueOnce({ ...mockChildBranch, parent: mockBranch })
        .mockResolvedValueOnce({ ...mockBranch, parent: null });

      const result = await service.getAncestry('branch-3');

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('branch-1'); // Root first
      expect(result[1].id).toBe('branch-2');
      expect(result[2].id).toBe('branch-3'); // Target last
    });

    it('should return single branch for root with no parent', async () => {
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue({ ...mockBranch, parent: null });

      const result = await service.getAncestry('branch-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('branch-1');
    });

    it('should handle non-existent branch', async () => {
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getAncestry('non-existent');

      expect(result).toEqual([]);
    });

    it('should throw error on circular reference detection', async () => {
      // Simulate circular reference by returning same branch repeatedly
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue({
        ...mockBranch,
        parentId: 'branch-1',
        parent: mockBranch,
      });

      await expect(service.getAncestry('branch-1')).rejects.toThrow(
        'Branch ancestry chain exceeds maximum depth'
      );
    });
  });

  describe('find', () => {
    it('should return branches matching filter criteria', async () => {
      const whereInput = {
        campaignId: 'campaign-1',
        parentId: 'branch-1',
      };

      (prisma.branch.findMany as jest.Mock).mockResolvedValue([mockChildBranch]);

      const result = await service.find(whereInput);

      expect(result).toEqual([mockChildBranch]);
      expect(prisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            ...whereInput,
            deletedAt: null,
          },
        })
      );
    });

    it('should exclude soft-deleted branches', async () => {
      (prisma.branch.findMany as jest.Mock).mockResolvedValue([]);

      await service.find({ campaignId: 'campaign-1' });

      expect(prisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      );
    });
  });

  describe('fork', () => {
    const worldTime = new Date('4707-03-15T12:00:00Z');
    const mockVersion = {
      id: 'version-1',
      entityType: 'character',
      entityId: 'character-1',
      branchId: 'branch-1',
      validFrom: new Date('4707-01-01T00:00:00Z'),
      validTo: null,
      payloadGz: Buffer.from('compressed-data'),
      createdBy: 'user-1',
      comment: null,
      version: 1,
      createdAt: new Date(),
    };

    beforeEach(() => {
      // Setup default mocks for fork operation
      const branchWithRelations = {
        ...mockBranch,
        parent: null,
        children: [],
        campaign: mockCampaign,
      };

      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(branchWithRelations);
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
        campaignId: mockBranch.campaignId,
      });
      (prisma.branch.findMany as jest.Mock).mockResolvedValue([
        { id: 'branch-1', parentId: null },
        { id: 'branch-2', parentId: 'branch-1' },
      ]);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.branch.create as jest.Mock).mockResolvedValue({
        ...mockChildBranch,
        parent: mockBranch,
        children: [],
      });
    });

    it('should create child branch and copy versions successfully', async () => {
      // Mock version data for multiple entity types
      (prisma.version.findMany as jest.Mock).mockResolvedValue([
        { entityId: 'character-1', branchId: 'branch-1' },
        { entityId: 'location-1', branchId: 'branch-1' },
      ]);

      (versionService.resolveVersion as jest.Mock).mockResolvedValue(mockVersion);
      (prisma.version.create as jest.Mock).mockResolvedValue({});

      const result = await service.fork(
        'branch-1',
        'Alternate Timeline',
        'What if scenario',
        worldTime,
        mockUser
      );

      expect(result.branch.id).toBe('branch-2');
      expect(result.branch.parentId).toBe('branch-1');
      expect(result.branch.divergedAt).toEqual(worldTime);
      expect(result.versionsCopied).toBeGreaterThan(0);

      expect(prisma.branch.create).toHaveBeenCalledWith({
        data: {
          campaignId: 'campaign-1',
          name: 'Alternate Timeline',
          description: 'What if scenario',
          parentId: 'branch-1',
          divergedAt: worldTime,
        },
        include: {
          parent: true,
          children: true,
        },
      });

      expect(audit.log).toHaveBeenCalledWith(
        'branch',
        'branch-2',
        'FORK',
        'user-1',
        expect.objectContaining({
          sourceBranchId: 'branch-1',
          divergedAt: worldTime,
        })
      );
    });

    it('should copy versions for all entity types', async () => {
      const entityTypes = [
        'campaign',
        'world',
        'location',
        'character',
        'party',
        'kingdom',
        'settlement',
        'structure',
        'encounter',
        'event',
      ];

      // Mock versions for each entity type
      (prisma.version.findMany as jest.Mock).mockImplementation(({ where }) => {
        const entityType = where.entityType;
        if (entityTypes.includes(entityType)) {
          return Promise.resolve([{ entityId: `${entityType}-1`, branchId: 'branch-1' }]);
        }
        return Promise.resolve([]);
      });

      (versionService.resolveVersion as jest.Mock).mockResolvedValue(mockVersion);
      (prisma.version.create as jest.Mock).mockResolvedValue({});

      const result = await service.fork('branch-1', 'Test Fork', undefined, worldTime, mockUser);

      // Should have attempted to copy versions for all entity types
      expect(versionService.resolveVersion).toHaveBeenCalledTimes(entityTypes.length);
      expect(result.versionsCopied).toBe(entityTypes.length);
    });

    it('should set validFrom to worldTime for copied versions', async () => {
      (prisma.version.findMany as jest.Mock).mockResolvedValue([
        { entityId: 'character-1', branchId: 'branch-1' },
      ]);

      (versionService.resolveVersion as jest.Mock).mockResolvedValue(mockVersion);
      (prisma.version.create as jest.Mock).mockResolvedValue({});

      await service.fork('branch-1', 'Test Fork', undefined, worldTime, mockUser);

      expect(prisma.version.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            validFrom: worldTime,
            validTo: null,
          }),
        })
      );
    });

    it('should reuse compressed payload without decompression', async () => {
      (prisma.version.findMany as jest.Mock).mockResolvedValue([
        { entityId: 'character-1', branchId: 'branch-1' },
      ]);

      const compressedPayload = Buffer.from('test-compressed-data');
      (versionService.resolveVersion as jest.Mock).mockResolvedValue({
        ...mockVersion,
        payloadGz: compressedPayload,
      });
      (prisma.version.create as jest.Mock).mockResolvedValue({});

      await service.fork('branch-1', 'Test Fork', undefined, worldTime, mockUser);

      expect(prisma.version.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payloadGz: Buffer.from(compressedPayload),
          }),
        })
      );
    });

    it('should set version number to 1 for first version in new branch', async () => {
      (prisma.version.findMany as jest.Mock).mockResolvedValue([
        { entityId: 'character-1', branchId: 'branch-1' },
      ]);

      (versionService.resolveVersion as jest.Mock).mockResolvedValue(mockVersion);
      (prisma.version.create as jest.Mock).mockResolvedValue({});

      await service.fork('branch-1', 'Test Fork', undefined, worldTime, mockUser);

      expect(prisma.version.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: 1,
          }),
        })
      );
    });

    it('should include fork comment in copied versions', async () => {
      (prisma.version.findMany as jest.Mock).mockResolvedValue([
        { entityId: 'character-1', branchId: 'branch-1' },
      ]);

      (versionService.resolveVersion as jest.Mock).mockResolvedValue(mockVersion);
      (prisma.version.create as jest.Mock).mockResolvedValue({});

      await service.fork('branch-1', 'Test Fork', undefined, worldTime, mockUser);

      expect(prisma.version.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            comment: expect.stringContaining('Forked from branch branch-1'),
          }),
        })
      );
    });

    it('should handle entities with no versions gracefully', async () => {
      // No versions found for any entity type
      (prisma.version.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.fork('branch-1', 'Empty Fork', undefined, worldTime, mockUser);

      expect(result.versionsCopied).toBe(0);
      expect(result.branch.id).toBe('branch-2');
    });

    it('should skip entities where version resolution returns null', async () => {
      (prisma.version.findMany as jest.Mock).mockResolvedValue([
        { entityId: 'character-1', branchId: 'branch-1' },
        { entityId: 'character-2', branchId: 'branch-1' },
      ]);

      // First entity resolves, second doesn't
      (versionService.resolveVersion as jest.Mock)
        .mockResolvedValueOnce(mockVersion)
        .mockResolvedValueOnce(null);

      (prisma.version.create as jest.Mock).mockResolvedValue({});

      const result = await service.fork('branch-1', 'Test Fork', undefined, worldTime, mockUser);

      // Should only copy one version
      expect(prisma.version.create).toHaveBeenCalledTimes(1);
      expect(result.versionsCopied).toBe(1);
    });

    it('should throw NotFoundException when source branch does not exist', async () => {
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.fork('non-existent', 'Test Fork', undefined, worldTime, mockUser)
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.fork('non-existent', 'Test Fork', undefined, worldTime, mockUser)
      ).rejects.toThrow('Source branch with ID non-existent not found');
    });

    it('should throw ForbiddenException when user lacks campaign access', async () => {
      const branchWithRelations = {
        ...mockBranch,
        parent: null,
        children: [],
        campaign: mockCampaign,
      };

      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(branchWithRelations);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null); // No access

      await expect(
        service.fork('branch-1', 'Test Fork', undefined, worldTime, mockUser)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should use transaction to ensure atomic operation', async () => {
      (prisma.version.findMany as jest.Mock).mockResolvedValue([
        { entityId: 'character-1', branchId: 'branch-1' },
      ]);

      (versionService.resolveVersion as jest.Mock).mockResolvedValue(mockVersion);
      (prisma.version.create as jest.Mock).mockResolvedValue({});

      await service.fork('branch-1', 'Test Fork', undefined, worldTime, mockUser);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should handle description as undefined', async () => {
      (prisma.version.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.fork('branch-1', 'Test Fork', undefined, worldTime, mockUser);

      expect(prisma.branch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: undefined,
          }),
        })
      );
      expect(result.branch).toBeDefined();
    });
  });
});
