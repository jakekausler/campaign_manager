import { Test, TestingModule } from '@nestjs/testing';
import type { Branch as PrismaBranch } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

import { AuditService } from './audit.service';
import { BranchService } from './branch.service';
import { MergeService } from './merge.service';
import { VersionService } from './version.service';

describe('MergeService', () => {
  let service: MergeService;

  const mockPrisma = {
    branch: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    version: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockBranchService = {
    getAncestry: jest.fn(),
  };

  const mockVersionService = {
    resolveVersion: jest.fn(),
    decompressVersion: jest.fn(),
    createVersion: jest.fn(),
  };

  const mockAuditService = {
    createAuditLog: jest.fn(),
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MergeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BranchService, useValue: mockBranchService },
        { provide: VersionService, useValue: mockVersionService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<MergeService>(MergeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findCommonAncestor', () => {
    it('should find common ancestor for linear hierarchy (child -> parent)', async () => {
      // Arrange: branch2 is child of branch1
      const branch1: PrismaBranch = {
        id: 'branch-1',
        campaignId: 'campaign-1',
        parentId: null,
        name: 'Main',
        description: null,
        divergedAt: null,
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      };

      const branch2: PrismaBranch = {
        id: 'branch-2',
        campaignId: 'campaign-1',
        parentId: 'branch-1',
        name: 'Feature Branch',
        description: null,
        divergedAt: new Date('2025-01-02'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-02'),
        updatedAt: new Date('2025-01-02'),
        deletedAt: null,
      };

      mockBranchService.getAncestry
        .mockResolvedValueOnce([branch1]) // branch1 ancestry
        .mockResolvedValueOnce([branch1, branch2]); // branch2 ancestry

      // Act
      const result = await service.findCommonAncestor('branch-1', 'branch-2');

      // Assert
      expect(result).toEqual(branch1);
      expect(mockBranchService.getAncestry).toHaveBeenCalledWith('branch-1');
      expect(mockBranchService.getAncestry).toHaveBeenCalledWith('branch-2');
    });

    it('should find common ancestor for sibling branches', async () => {
      // Arrange: branch2 and branch3 are both children of branch1
      const branch1: PrismaBranch = {
        id: 'branch-1',
        campaignId: 'campaign-1',
        parentId: null,
        name: 'Main',
        description: null,
        divergedAt: null,
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      };

      const branch2: PrismaBranch = {
        id: 'branch-2',
        campaignId: 'campaign-1',
        parentId: 'branch-1',
        name: 'Feature A',
        description: null,
        divergedAt: new Date('2025-01-02'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-02'),
        updatedAt: new Date('2025-01-02'),
        deletedAt: null,
      };

      const branch3: PrismaBranch = {
        id: 'branch-3',
        campaignId: 'campaign-1',
        parentId: 'branch-1',
        name: 'Feature B',
        description: null,
        divergedAt: new Date('2025-01-03'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-03'),
        updatedAt: new Date('2025-01-03'),
        deletedAt: null,
      };

      mockBranchService.getAncestry
        .mockResolvedValueOnce([branch1, branch2]) // branch2 ancestry
        .mockResolvedValueOnce([branch1, branch3]); // branch3 ancestry

      // Act
      const result = await service.findCommonAncestor('branch-2', 'branch-3');

      // Assert
      expect(result).toEqual(branch1);
    });

    it('should find common ancestor for complex tree (grandchild and uncle)', async () => {
      // Arrange: branch4 is grandchild of branch1, branch2 is child of branch1
      const branch1: PrismaBranch = {
        id: 'branch-1',
        campaignId: 'campaign-1',
        parentId: null,
        name: 'Main',
        description: null,
        divergedAt: null,
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      };

      const branch2: PrismaBranch = {
        id: 'branch-2',
        campaignId: 'campaign-1',
        parentId: 'branch-1',
        name: 'Feature A',
        description: null,
        divergedAt: new Date('2025-01-02'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-02'),
        updatedAt: new Date('2025-01-02'),
        deletedAt: null,
      };

      const branch3: PrismaBranch = {
        id: 'branch-3',
        campaignId: 'campaign-1',
        parentId: 'branch-1',
        name: 'Feature B',
        description: null,
        divergedAt: new Date('2025-01-03'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-03'),
        updatedAt: new Date('2025-01-03'),
        deletedAt: null,
      };

      const branch4: PrismaBranch = {
        id: 'branch-4',
        campaignId: 'campaign-1',
        parentId: 'branch-3',
        name: 'Sub-feature of B',
        description: null,
        divergedAt: new Date('2025-01-04'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-04'),
        updatedAt: new Date('2025-01-04'),
        deletedAt: null,
      };

      mockBranchService.getAncestry
        .mockResolvedValueOnce([branch1, branch2]) // branch2 ancestry
        .mockResolvedValueOnce([branch1, branch3, branch4]); // branch4 ancestry

      // Act
      const result = await service.findCommonAncestor('branch-2', 'branch-4');

      // Assert
      expect(result).toEqual(branch1);
    });

    it('should return null when branches have no common ancestor', async () => {
      // Arrange: Two root branches from different campaigns
      const branch1: PrismaBranch = {
        id: 'branch-1',
        campaignId: 'campaign-1',
        parentId: null,
        name: 'Main 1',
        description: null,
        divergedAt: null,
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      };

      const branch2: PrismaBranch = {
        id: 'branch-2',
        campaignId: 'campaign-2',
        parentId: null,
        name: 'Main 2',
        description: null,
        divergedAt: null,
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-02'),
        updatedAt: new Date('2025-01-02'),
        deletedAt: null,
      };

      mockBranchService.getAncestry
        .mockResolvedValueOnce([branch1]) // branch1 ancestry
        .mockResolvedValueOnce([branch2]); // branch2 ancestry (no overlap)

      // Act
      const result = await service.findCommonAncestor('branch-1', 'branch-2');

      // Assert
      expect(result).toBeNull();
    });

    it('should return the branch itself when comparing branch with itself', async () => {
      // Arrange
      const branch1: PrismaBranch = {
        id: 'branch-1',
        campaignId: 'campaign-1',
        parentId: null,
        name: 'Main',
        description: null,
        divergedAt: null,
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      };

      mockBranchService.getAncestry
        .mockResolvedValueOnce([branch1]) // branch1 ancestry
        .mockResolvedValueOnce([branch1]); // branch1 ancestry (same)

      // Act
      const result = await service.findCommonAncestor('branch-1', 'branch-1');

      // Assert
      expect(result).toEqual(branch1);
    });
  });

  describe('getEntityVersionsForMerge', () => {
    it('should retrieve base, source, and target versions for 3-way merge', async () => {
      // Arrange
      const baseBranch: PrismaBranch = {
        id: 'branch-base',
        campaignId: 'campaign-1',
        parentId: null,
        name: 'Main',
        description: null,
        divergedAt: null,
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      };

      const sourceBranch: PrismaBranch = {
        id: 'branch-source',
        campaignId: 'campaign-1',
        parentId: 'branch-base',
        name: 'Source Branch',
        description: null,
        divergedAt: new Date('2025-01-02'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-02'),
        updatedAt: new Date('2025-01-02'),
        deletedAt: null,
      };

      const targetBranch: PrismaBranch = {
        id: 'branch-target',
        campaignId: 'campaign-1',
        parentId: 'branch-base',
        name: 'Target Branch',
        description: null,
        divergedAt: new Date('2025-01-03'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-03'),
        updatedAt: new Date('2025-01-03'),
        deletedAt: null,
      };

      const baseVersion = {
        id: 'version-base',
        entityType: 'settlement',
        entityId: 'settlement-1',
        branchId: 'branch-base',
        validFrom: new Date('2025-01-01'),
        validTo: null,
        payloadGz: Buffer.from('base'),
        comment: null,
        version: 1,
        createdAt: new Date('2025-01-01'),
        createdBy: 'user-1',
      };

      const sourceVersion = {
        id: 'version-source',
        entityType: 'settlement',
        entityId: 'settlement-1',
        branchId: 'branch-source',
        validFrom: new Date('2025-01-02'),
        validTo: null,
        payloadGz: Buffer.from('source'),
        comment: null,
        version: 2,
        createdAt: new Date('2025-01-02'),
        createdBy: 'user-1',
      };

      const targetVersion = {
        id: 'version-target',
        entityType: 'settlement',
        entityId: 'settlement-1',
        branchId: 'branch-target',
        validFrom: new Date('2025-01-03'),
        validTo: null,
        payloadGz: Buffer.from('target'),
        comment: null,
        version: 3,
        createdAt: new Date('2025-01-03'),
        createdBy: 'user-1',
      };

      const worldTime = new Date('2025-01-10');

      // Mock branch lookups for findDivergenceTime
      mockPrisma.branch.findUnique
        .mockResolvedValueOnce(sourceBranch) // source branch lookup
        .mockResolvedValueOnce(targetBranch); // target branch lookup

      // Mock ancestry lookups for findDivergenceTime
      mockBranchService.getAncestry
        .mockResolvedValueOnce([baseBranch, sourceBranch]) // source ancestry
        .mockResolvedValueOnce([baseBranch, targetBranch]); // target ancestry

      mockVersionService.resolveVersion
        .mockResolvedValueOnce(baseVersion) // base
        .mockResolvedValueOnce(sourceVersion) // source
        .mockResolvedValueOnce(targetVersion); // target

      // Act
      const result = await service.getEntityVersionsForMerge(
        'settlement',
        'settlement-1',
        'branch-source',
        'branch-target',
        'branch-base',
        worldTime
      );

      // Assert
      expect(result).toEqual({
        base: baseVersion,
        source: sourceVersion,
        target: targetVersion,
      });
      // Base version should be resolved at divergence time (earliest of source and target)
      expect(mockVersionService.resolveVersion).toHaveBeenCalledWith(
        'settlement',
        'settlement-1',
        'branch-base',
        new Date('2025-01-02') // earliest divergence time
      );
      expect(mockVersionService.resolveVersion).toHaveBeenCalledWith(
        'settlement',
        'settlement-1',
        'branch-source',
        worldTime
      );
      expect(mockVersionService.resolveVersion).toHaveBeenCalledWith(
        'settlement',
        'settlement-1',
        'branch-target',
        worldTime
      );
    });

    it('should handle missing base version (entity created after branch divergence)', async () => {
      // Arrange: Entity was created in source branch after fork, doesn't exist in base
      const baseBranch: PrismaBranch = {
        id: 'branch-base',
        campaignId: 'campaign-1',
        parentId: null,
        name: 'Main',
        description: null,
        divergedAt: null,
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      };

      const sourceBranch: PrismaBranch = {
        id: 'branch-source',
        campaignId: 'campaign-1',
        parentId: 'branch-base',
        name: 'Source Branch',
        description: null,
        divergedAt: new Date('2025-01-02'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-02'),
        updatedAt: new Date('2025-01-02'),
        deletedAt: null,
      };

      const targetBranch: PrismaBranch = {
        id: 'branch-target',
        campaignId: 'campaign-1',
        parentId: 'branch-base',
        name: 'Target Branch',
        description: null,
        divergedAt: new Date('2025-01-03'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-03'),
        updatedAt: new Date('2025-01-03'),
        deletedAt: null,
      };

      const sourceVersion = {
        id: 'version-source',
        entityType: 'settlement',
        entityId: 'settlement-1',
        branchId: 'branch-source',
        validFrom: new Date('2025-01-02'),
        validTo: null,
        payloadGz: Buffer.from('source'),
        comment: null,
        version: 1,
        createdAt: new Date('2025-01-02'),
        createdBy: 'user-1',
      };

      const targetVersion = {
        id: 'version-target',
        entityType: 'settlement',
        entityId: 'settlement-1',
        branchId: 'branch-target',
        validFrom: new Date('2025-01-03'),
        validTo: null,
        payloadGz: Buffer.from('target'),
        comment: null,
        version: 1,
        createdAt: new Date('2025-01-03'),
        createdBy: 'user-1',
      };

      const worldTime = new Date('2025-01-10');

      // Mock branch lookups
      mockPrisma.branch.findUnique
        .mockResolvedValueOnce(sourceBranch)
        .mockResolvedValueOnce(targetBranch);

      // Mock ancestry lookups
      mockBranchService.getAncestry
        .mockResolvedValueOnce([baseBranch, sourceBranch])
        .mockResolvedValueOnce([baseBranch, targetBranch]);

      mockVersionService.resolveVersion
        .mockResolvedValueOnce(null) // base (doesn't exist)
        .mockResolvedValueOnce(sourceVersion) // source
        .mockResolvedValueOnce(targetVersion); // target

      // Act
      const result = await service.getEntityVersionsForMerge(
        'settlement',
        'settlement-1',
        'branch-source',
        'branch-target',
        'branch-base',
        worldTime
      );

      // Assert
      expect(result).toEqual({
        base: null,
        source: sourceVersion,
        target: targetVersion,
      });
    });

    it('should handle missing source version (entity only exists in target)', async () => {
      // Arrange: Entity only exists in target branch
      const baseBranch: PrismaBranch = {
        id: 'branch-base',
        campaignId: 'campaign-1',
        parentId: null,
        name: 'Main',
        description: null,
        divergedAt: null,
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      };

      const sourceBranch: PrismaBranch = {
        id: 'branch-source',
        campaignId: 'campaign-1',
        parentId: 'branch-base',
        name: 'Source Branch',
        description: null,
        divergedAt: new Date('2025-01-02'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-02'),
        updatedAt: new Date('2025-01-02'),
        deletedAt: null,
      };

      const targetBranch: PrismaBranch = {
        id: 'branch-target',
        campaignId: 'campaign-1',
        parentId: 'branch-base',
        name: 'Target Branch',
        description: null,
        divergedAt: new Date('2025-01-03'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-03'),
        updatedAt: new Date('2025-01-03'),
        deletedAt: null,
      };

      const baseVersion = {
        id: 'version-base',
        entityType: 'settlement',
        entityId: 'settlement-1',
        branchId: 'branch-base',
        validFrom: new Date('2025-01-01'),
        validTo: null,
        payloadGz: Buffer.from('base'),
        comment: null,
        version: 1,
        createdAt: new Date('2025-01-01'),
        createdBy: 'user-1',
      };

      const targetVersion = {
        id: 'version-target',
        entityType: 'settlement',
        entityId: 'settlement-1',
        branchId: 'branch-target',
        validFrom: new Date('2025-01-03'),
        validTo: null,
        payloadGz: Buffer.from('target'),
        comment: null,
        version: 2,
        createdAt: new Date('2025-01-03'),
        createdBy: 'user-1',
      };

      const worldTime = new Date('2025-01-10');

      // Mock branch lookups
      mockPrisma.branch.findUnique
        .mockResolvedValueOnce(sourceBranch)
        .mockResolvedValueOnce(targetBranch);

      // Mock ancestry lookups
      mockBranchService.getAncestry
        .mockResolvedValueOnce([baseBranch, sourceBranch])
        .mockResolvedValueOnce([baseBranch, targetBranch]);

      mockVersionService.resolveVersion
        .mockResolvedValueOnce(baseVersion) // base
        .mockResolvedValueOnce(null) // source (doesn't exist)
        .mockResolvedValueOnce(targetVersion); // target

      // Act
      const result = await service.getEntityVersionsForMerge(
        'settlement',
        'settlement-1',
        'branch-source',
        'branch-target',
        'branch-base',
        worldTime
      );

      // Assert
      expect(result).toEqual({
        base: baseVersion,
        source: null,
        target: targetVersion,
      });
    });

    it('should handle entity that exists only in source (new entity to be merged)', async () => {
      // Arrange: Entity created in source, doesn't exist in base or target
      const baseBranch: PrismaBranch = {
        id: 'branch-base',
        campaignId: 'campaign-1',
        parentId: null,
        name: 'Main',
        description: null,
        divergedAt: null,
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      };

      const sourceBranch: PrismaBranch = {
        id: 'branch-source',
        campaignId: 'campaign-1',
        parentId: 'branch-base',
        name: 'Source Branch',
        description: null,
        divergedAt: new Date('2025-01-02'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-02'),
        updatedAt: new Date('2025-01-02'),
        deletedAt: null,
      };

      const targetBranch: PrismaBranch = {
        id: 'branch-target',
        campaignId: 'campaign-1',
        parentId: 'branch-base',
        name: 'Target Branch',
        description: null,
        divergedAt: new Date('2025-01-03'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-03'),
        updatedAt: new Date('2025-01-03'),
        deletedAt: null,
      };

      const sourceVersion = {
        id: 'version-source',
        entityType: 'settlement',
        entityId: 'settlement-1',
        branchId: 'branch-source',
        validFrom: new Date('2025-01-02'),
        validTo: null,
        payloadGz: Buffer.from('source'),
        comment: null,
        version: 1,
        createdAt: new Date('2025-01-02'),
        createdBy: 'user-1',
      };

      const worldTime = new Date('2025-01-10');

      // Mock branch lookups
      mockPrisma.branch.findUnique
        .mockResolvedValueOnce(sourceBranch)
        .mockResolvedValueOnce(targetBranch);

      // Mock ancestry lookups
      mockBranchService.getAncestry
        .mockResolvedValueOnce([baseBranch, sourceBranch])
        .mockResolvedValueOnce([baseBranch, targetBranch]);

      mockVersionService.resolveVersion
        .mockResolvedValueOnce(null) // base
        .mockResolvedValueOnce(sourceVersion) // source
        .mockResolvedValueOnce(null); // target

      // Act
      const result = await service.getEntityVersionsForMerge(
        'settlement',
        'settlement-1',
        'branch-source',
        'branch-target',
        'branch-base',
        worldTime
      );

      // Assert
      expect(result).toEqual({
        base: null,
        source: sourceVersion,
        target: null,
      });
    });
  });

  describe('cherryPickVersion', () => {
    const sourceVersion = {
      id: 'version-source',
      entityType: 'settlement',
      entityId: 'settlement-1',
      branchId: 'branch-source',
      validFrom: new Date('2025-01-02'),
      validTo: null,
      payloadCompressed: Buffer.from('compressed'),
      payloadCompressionType: 'gzip',
      comment: 'Source change',
      createdBy: 'user-1',
      createdAt: new Date('2025-01-02'),
    };

    const targetVersion = {
      id: 'version-target',
      entityType: 'settlement',
      entityId: 'settlement-1',
      branchId: 'branch-target',
      validFrom: new Date('2025-01-01'),
      validTo: null,
      payloadCompressed: Buffer.from('compressed'),
      payloadCompressionType: 'gzip',
      comment: 'Target state',
      createdBy: 'user-1',
      createdAt: new Date('2025-01-01'),
    };

    const mockUser = {
      id: 'user-1',
      email: 'user@example.com',
      username: 'testuser',
      role: 'USER',
    };

    it('should throw NotFoundException if source version does not exist', async () => {
      // Arrange
      mockPrisma.version.findUnique = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.cherryPickVersion('version-nonexistent', 'branch-target', mockUser as any)
      ).rejects.toThrow('Version version-nonexistent not found');
    });

    it('should throw BadRequestException if target branch does not exist', async () => {
      // Arrange
      mockPrisma.version.findUnique = jest.fn().mockResolvedValue(sourceVersion);
      mockPrisma.branch.findUnique = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.cherryPickVersion('version-source', 'branch-nonexistent', mockUser as any)
      ).rejects.toThrow('Target branch branch-nonexistent not found');
    });

    it('should create new version in target branch when no conflict exists', async () => {
      // Arrange
      const sourcePayload = { name: 'New Name', population: 1000 };
      const targetBranch = {
        id: 'branch-target',
        campaignId: 'campaign-1',
        parentId: 'branch-main',
        name: 'Target Branch',
        description: null,
        divergedAt: new Date('2025-01-01'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      };

      mockPrisma.version.findUnique = jest.fn().mockResolvedValue(sourceVersion);
      mockPrisma.branch.findUnique = jest.fn().mockResolvedValue(targetBranch);
      mockVersionService.resolveVersion = jest.fn().mockResolvedValue(null); // No existing version in target
      mockVersionService.decompressVersion = jest.fn().mockResolvedValue(sourcePayload);
      mockVersionService.createVersion = jest.fn().mockResolvedValue({
        ...sourceVersion,
        id: 'version-new',
        branchId: 'branch-target',
      });
      mockAuditService.log = jest.fn().mockResolvedValue(undefined);

      // Act
      const result = await service.cherryPickVersion(
        'version-source',
        'branch-target',
        mockUser as any
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.hasConflict).toBe(false);
      expect(result.versionCreated).toBeTruthy();
      expect(mockVersionService.createVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'settlement',
          entityId: 'settlement-1',
          branchId: 'branch-target',
          payload: sourcePayload,
        }),
        mockUser
      );
    });

    it('should detect conflict when target branch has modified the same entity', async () => {
      // Arrange
      const sourcePayload = { name: 'Name from Source', population: 1000 };
      const targetPayload = { name: 'Name from Target', population: 800 };
      const targetBranch = {
        id: 'branch-target',
        campaignId: 'campaign-1',
        parentId: 'branch-main',
        name: 'Target Branch',
        description: null,
        divergedAt: new Date('2025-01-01'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      };

      mockPrisma.version.findUnique = jest.fn().mockResolvedValue(sourceVersion);
      mockPrisma.branch.findUnique = jest.fn().mockResolvedValue(targetBranch);
      mockVersionService.resolveVersion = jest.fn().mockResolvedValue(targetVersion);
      mockVersionService.decompressVersion
        .mockResolvedValueOnce(sourcePayload) // source
        .mockResolvedValueOnce(targetPayload); // target

      // Act
      const result = await service.cherryPickVersion(
        'version-source',
        'branch-target',
        mockUser as any
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.hasConflict).toBe(true);
      expect(result.conflicts).toHaveLength(2); // name and population conflicts
      expect(result.conflicts?.some((c) => c.path === 'name')).toBe(true);
      expect(result.conflicts?.some((c) => c.path === 'population')).toBe(true);
    });

    it('should create version when manually resolving cherry-pick conflict', async () => {
      // Arrange
      const sourcePayload = { name: 'Name from Source', population: 1000 };
      const targetPayload = { name: 'Name from Target', population: 800 };
      const resolvedPayload = { name: 'Name from Source', population: 1000 }; // Choose source for both
      const targetBranch = {
        id: 'branch-target',
        campaignId: 'campaign-1',
        parentId: 'branch-main',
        name: 'Target Branch',
        description: null,
        divergedAt: new Date('2025-01-01'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      };

      mockPrisma.version.findUnique = jest.fn().mockResolvedValue(sourceVersion);
      mockPrisma.branch.findUnique = jest.fn().mockResolvedValue(targetBranch);
      mockVersionService.resolveVersion = jest.fn().mockResolvedValue(targetVersion);
      mockVersionService.decompressVersion
        .mockResolvedValueOnce(sourcePayload) // source
        .mockResolvedValueOnce(targetPayload); // target
      mockVersionService.createVersion = jest.fn().mockResolvedValue({
        ...sourceVersion,
        id: 'version-new',
        branchId: 'branch-target',
      });
      mockAuditService.log = jest.fn().mockResolvedValue(undefined);

      const resolutions = [
        {
          entityType: 'settlement',
          entityId: 'settlement-1',
          path: 'name',
          resolvedValue: JSON.stringify('Name from Source'),
        },
        {
          entityType: 'settlement',
          entityId: 'settlement-1',
          path: 'population',
          resolvedValue: JSON.stringify(1000),
        },
      ];

      // Act
      const result = await service.cherryPickVersion(
        'version-source',
        'branch-target',
        mockUser as any,
        resolutions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.hasConflict).toBe(false);
      expect(result.versionCreated).toBeTruthy();
      expect(mockVersionService.createVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: resolvedPayload,
        }),
        mockUser
      );
    });

    it('should return conflict information if conflicts exist but no resolutions provided', async () => {
      // Arrange
      const sourcePayload = { name: 'Name from Source', population: 1000 };
      const targetPayload = { name: 'Name from Target', population: 800 };
      const targetBranch = {
        id: 'branch-target',
        campaignId: 'campaign-1',
        parentId: 'branch-main',
        name: 'Target Branch',
        description: null,
        divergedAt: new Date('2025-01-01'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      };

      mockPrisma.version.findUnique = jest.fn().mockResolvedValue(sourceVersion);
      mockPrisma.branch.findUnique = jest.fn().mockResolvedValue(targetBranch);
      mockVersionService.resolveVersion = jest.fn().mockResolvedValue(targetVersion);
      mockVersionService.decompressVersion
        .mockResolvedValueOnce(sourcePayload)
        .mockResolvedValueOnce(targetPayload);

      // Act
      const result = await service.cherryPickVersion(
        'version-source',
        'branch-target',
        mockUser as any
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.hasConflict).toBe(true);
      expect(result.conflicts).toHaveLength(2);
      expect(result.conflicts?.some((c) => c.path === 'name')).toBe(true);
      expect(result.conflicts?.some((c) => c.path === 'population')).toBe(true);
    });

    it('should handle cherry-picking entity that does not exist in target branch', async () => {
      // Arrange
      const sourcePayload = { name: 'New Settlement', population: 500 };
      const targetBranch = {
        id: 'branch-target',
        campaignId: 'campaign-1',
        parentId: 'branch-main',
        name: 'Target Branch',
        description: null,
        divergedAt: new Date('2025-01-01'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      };

      mockPrisma.version.findUnique = jest.fn().mockResolvedValue(sourceVersion);
      mockPrisma.branch.findUnique = jest.fn().mockResolvedValue(targetBranch);
      mockVersionService.resolveVersion = jest.fn().mockResolvedValue(null); // No version in target
      mockVersionService.decompressVersion = jest.fn().mockResolvedValue(sourcePayload);
      mockVersionService.createVersion = jest.fn().mockResolvedValue({
        ...sourceVersion,
        id: 'version-new',
        branchId: 'branch-target',
      });
      mockAuditService.log = jest.fn().mockResolvedValue(undefined);

      // Act
      const result = await service.cherryPickVersion(
        'version-source',
        'branch-target',
        mockUser as any
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.hasConflict).toBe(false);
      expect(mockVersionService.createVersion).toHaveBeenCalled();
    });

    it('should use the correct world time from source version for cherry-pick', async () => {
      // Arrange
      const sourcePayload = { name: 'Settlement', population: 1000 };
      const targetBranch = {
        id: 'branch-target',
        campaignId: 'campaign-1',
        parentId: 'branch-main',
        name: 'Target Branch',
        description: null,
        divergedAt: new Date('2025-01-01'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      };

      mockPrisma.version.findUnique = jest.fn().mockResolvedValue(sourceVersion);
      mockPrisma.branch.findUnique = jest.fn().mockResolvedValue(targetBranch);
      mockVersionService.resolveVersion = jest.fn().mockResolvedValue(null);
      mockVersionService.decompressVersion = jest.fn().mockResolvedValue(sourcePayload);
      mockVersionService.createVersion = jest.fn().mockResolvedValue({
        ...sourceVersion,
        id: 'version-new',
        branchId: 'branch-target',
      });
      mockAuditService.log = jest.fn().mockResolvedValue(undefined);

      // Act
      await service.cherryPickVersion('version-source', 'branch-target', mockUser as any);

      // Assert
      expect(mockVersionService.resolveVersion).toHaveBeenCalledWith(
        'settlement',
        'settlement-1',
        'branch-target',
        sourceVersion.validFrom
      );
    });

    it('should create audit log entry for cherry-pick operation', async () => {
      // Arrange
      const sourcePayload = { name: 'Settlement', population: 1000 };
      const targetBranch = {
        id: 'branch-target',
        campaignId: 'campaign-1',
        parentId: 'branch-main',
        name: 'Target Branch',
        description: null,
        divergedAt: new Date('2025-01-01'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      };

      mockPrisma.version.findUnique = jest.fn().mockResolvedValue(sourceVersion);
      mockPrisma.branch.findUnique = jest.fn().mockResolvedValue(targetBranch);
      mockVersionService.resolveVersion = jest.fn().mockResolvedValue(null);
      mockVersionService.decompressVersion = jest.fn().mockResolvedValue(sourcePayload);
      mockVersionService.createVersion = jest.fn().mockResolvedValue({
        ...sourceVersion,
        id: 'version-new',
        branchId: 'branch-target',
      });
      mockAuditService.log = jest.fn().mockResolvedValue(undefined);

      // Act
      await service.cherryPickVersion('version-source', 'branch-target', mockUser as any);

      // Assert
      expect(mockAuditService.log).toHaveBeenCalledWith(
        'version',
        'settlement:settlement-1',
        'CHERRY_PICK',
        'user-1',
        expect.objectContaining({
          sourceVersionId: 'version-source',
          targetBranchId: 'branch-target',
        })
      );
    });

    it('should handle cherry-picking with partial resolutions', async () => {
      // Arrange
      const sourcePayload = { name: 'Name from Source', population: 1000 };
      const targetPayload = { name: 'Name from Target', population: 800 };
      const targetBranch = {
        id: 'branch-target',
        campaignId: 'campaign-1',
        parentId: 'branch-main',
        name: 'Target Branch',
        description: null,
        divergedAt: new Date('2025-01-01'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      };

      mockPrisma.version.findUnique = jest.fn().mockResolvedValue(sourceVersion);
      mockPrisma.branch.findUnique = jest.fn().mockResolvedValue(targetBranch);
      mockVersionService.resolveVersion = jest.fn().mockResolvedValue(targetVersion);
      mockVersionService.decompressVersion
        .mockResolvedValueOnce(sourcePayload)
        .mockResolvedValueOnce(targetPayload);

      // Only resolve one of the two conflicts
      const resolutions = [
        {
          entityType: 'settlement',
          entityId: 'settlement-1',
          path: 'name',
          resolvedValue: JSON.stringify('Name from Source'),
        },
      ];

      // Act & Assert
      await expect(
        service.cherryPickVersion('version-source', 'branch-target', mockUser as any, resolutions)
      ).rejects.toThrow('not all conflicts have been resolved');
    });

    it('should handle cherry-picking nested property conflicts', async () => {
      // Arrange
      const sourcePayload = { name: 'Settlement', resources: { gold: 1000, food: 500 } };
      const targetPayload = { name: 'Settlement', resources: { gold: 800, food: 500 } };
      const targetBranch = {
        id: 'branch-target',
        campaignId: 'campaign-1',
        parentId: 'branch-main',
        name: 'Target Branch',
        description: null,
        divergedAt: new Date('2025-01-01'),
        isPinned: false,
        color: null,
        tags: [],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      };

      mockPrisma.version.findUnique = jest.fn().mockResolvedValue(sourceVersion);
      mockPrisma.branch.findUnique = jest.fn().mockResolvedValue(targetBranch);
      mockVersionService.resolveVersion = jest.fn().mockResolvedValue(targetVersion);
      mockVersionService.decompressVersion
        .mockResolvedValueOnce(sourcePayload)
        .mockResolvedValueOnce(targetPayload);

      // Act
      const result = await service.cherryPickVersion(
        'version-source',
        'branch-target',
        mockUser as any
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.hasConflict).toBe(true);
      expect(result.conflicts?.some((c) => c.path === 'resources.gold')).toBe(true);
    });
  });
});
