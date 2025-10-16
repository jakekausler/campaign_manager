/**
 * VersionService Unit Tests
 * Tests for versioning system functionality
 */

import { NotFoundException } from '@nestjs/common';
import type { Version } from '@prisma/client';

import type { PrismaService } from '../../database/prisma.service';
import { compressPayload, decompressPayload, calculateDiff } from '../utils/version.utils';

import type { AuditService } from './audit.service';
import { VersionService } from './version.service';

// Mock the version utils module
jest.mock('../utils/version.utils');

describe('VersionService', () => {
  let service: VersionService;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockAudit: jest.Mocked<AuditService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'admin',
  };

  const mockPayload = {
    name: 'Test Campaign',
    description: 'A test campaign',
    isActive: true,
  };

  const mockCompressedPayload = Buffer.from('compressed-data');

  const mockBranch = {
    id: 'branch-1',
    campaignId: 'campaign-1',
    name: 'Main',
    description: 'Main branch',
    parentId: null,
    divergedAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    deletedAt: null,
    campaign: {
      ownerId: 'user-1',
      memberships: [
        {
          userId: 'user-1',
          role: 'OWNER',
        },
      ],
    },
  };

  beforeEach(() => {
    // Create mock implementations
    mockPrisma = {
      version: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      branch: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    mockAudit = {
      log: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    service = new VersionService(mockPrisma, mockAudit);

    // Setup default mock implementations
    (compressPayload as jest.Mock).mockResolvedValue(mockCompressedPayload);
    (decompressPayload as jest.Mock).mockResolvedValue(mockPayload);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createVersion', () => {
    it('should create a new version with compressed payload', async () => {
      const input = {
        entityType: 'campaign',
        entityId: 'campaign-1',
        branchId: 'branch-1',
        validFrom: new Date('2025-01-01'),
        validTo: null,
        payload: mockPayload,
        comment: 'Initial version',
      };

      const expectedVersion: Version = {
        id: 'version-1',
        entityType: 'campaign',
        entityId: 'campaign-1',
        branchId: 'branch-1',
        validFrom: new Date('2025-01-01'),
        validTo: null,
        payloadGz: mockCompressedPayload,
        createdAt: new Date(),
        createdBy: 'user-1',
        comment: 'Initial version',
        version: 1,
      };

      // Mock branch lookup for authorization
      (mockPrisma.branch.findUnique as jest.Mock).mockResolvedValue(mockBranch);

      // Mock latest version query (no previous versions)
      (mockPrisma.version.findFirst as jest.Mock).mockResolvedValueOnce(null);

      // Mock version creation
      (mockPrisma.version.create as jest.Mock).mockResolvedValue(expectedVersion);

      const result = await service.createVersion(input, mockUser);

      // Verify branch lookup with authorization data
      expect(mockPrisma.branch.findUnique).toHaveBeenCalledWith({
        where: { id: 'branch-1' },
        include: { campaign: { select: { ownerId: true, memberships: true } } },
      });

      // Verify latest version query
      expect(mockPrisma.version.findFirst).toHaveBeenCalledWith({
        where: {
          entityType: 'campaign',
          entityId: 'campaign-1',
          branchId: 'branch-1',
        },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      // Verify compression was called
      expect(compressPayload).toHaveBeenCalledWith(mockPayload);

      // Verify Prisma create was called with compressed payload
      expect(mockPrisma.version.create).toHaveBeenCalledWith({
        data: {
          entityType: 'campaign',
          entityId: 'campaign-1',
          branchId: 'branch-1',
          validFrom: new Date('2025-01-01'),
          validTo: null,
          payloadGz: mockCompressedPayload,
          createdBy: 'user-1',
          comment: 'Initial version',
          version: 1,
        },
      });

      // Verify audit log was created
      expect(mockAudit.log).toHaveBeenCalledWith(
        'version',
        expectedVersion.id,
        'CREATE',
        'user-1',
        expect.any(Object)
      );

      expect(result).toEqual(expectedVersion);
    });

    it('should create version without comment', async () => {
      const input = {
        entityType: 'campaign',
        entityId: 'campaign-1',
        branchId: 'branch-1',
        validFrom: new Date('2025-01-01'),
        validTo: null,
        payload: mockPayload,
      };

      const expectedVersion: Version = {
        id: 'version-1',
        entityType: 'campaign',
        entityId: 'campaign-1',
        branchId: 'branch-1',
        validFrom: new Date('2025-01-01'),
        validTo: null,
        payloadGz: mockCompressedPayload,
        createdAt: new Date(),
        createdBy: 'user-1',
        comment: null,
        version: 1,
      };

      // Mock branch lookup for authorization
      (mockPrisma.branch.findUnique as jest.Mock).mockResolvedValue(mockBranch);

      // Mock latest version query (no previous versions)
      (mockPrisma.version.findFirst as jest.Mock).mockResolvedValueOnce(null);

      // Mock version creation
      (mockPrisma.version.create as jest.Mock).mockResolvedValue(expectedVersion);

      const result = await service.createVersion(input, mockUser);

      expect(result.comment).toBeNull();
    });
  });

  describe('closeVersion', () => {
    it('should update version validTo field', async () => {
      const versionId = 'version-1';
      const validTo = new Date('2025-02-01');

      const updatedVersion: Version = {
        id: versionId,
        entityType: 'campaign',
        entityId: 'campaign-1',
        branchId: 'branch-1',
        validFrom: new Date('2025-01-01'),
        validTo,
        payloadGz: mockCompressedPayload,
        createdAt: new Date(),
        createdBy: 'user-1',
        comment: null,
        version: 1,
      };

      (mockPrisma.version.update as jest.Mock).mockResolvedValue(updatedVersion);

      const result = await service.closeVersion(versionId, validTo);

      expect(mockPrisma.version.update).toHaveBeenCalledWith({
        where: { id: versionId },
        data: { validTo },
      });

      expect(result.validTo).toEqual(validTo);
    });
  });

  describe('findVersionHistory', () => {
    it('should return version history in chronological order', async () => {
      const entityType = 'campaign';
      const entityId = 'campaign-1';
      const branchId = 'branch-1';

      const versions: Version[] = [
        {
          id: 'version-1',
          entityType,
          entityId,
          branchId,
          validFrom: new Date('2025-01-01'),
          validTo: new Date('2025-02-01'),
          payloadGz: mockCompressedPayload,
          createdAt: new Date('2025-01-01'),
          createdBy: 'user-1',
          comment: 'First version',
          version: 1,
        },
        {
          id: 'version-2',
          entityType,
          entityId,
          branchId,
          validFrom: new Date('2025-02-01'),
          validTo: null,
          payloadGz: mockCompressedPayload,
          createdAt: new Date('2025-02-01'),
          createdBy: 'user-1',
          comment: 'Second version',
          version: 2,
        },
      ];

      (mockPrisma.version.findMany as jest.Mock).mockResolvedValue(versions);

      const result = await service.findVersionHistory(entityType, entityId, branchId);

      expect(mockPrisma.version.findMany).toHaveBeenCalledWith({
        where: {
          entityType,
          entityId,
          branchId,
        },
        orderBy: {
          validFrom: 'asc',
        },
      });

      expect(result).toEqual(versions);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no versions exist', async () => {
      (mockPrisma.version.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findVersionHistory('campaign', 'campaign-1', 'branch-1');

      expect(result).toEqual([]);
    });
  });

  describe('findVersionInBranch', () => {
    it('should find current version (validTo is null)', async () => {
      const version: Version = {
        id: 'version-1',
        entityType: 'campaign',
        entityId: 'campaign-1',
        branchId: 'branch-1',
        validFrom: new Date('2025-01-01'),
        validTo: null,
        payloadGz: mockCompressedPayload,
        createdAt: new Date('2025-01-01'),
        createdBy: 'user-1',
        comment: null,
        version: 1,
      };

      (mockPrisma.version.findFirst as jest.Mock).mockResolvedValue(version);

      const result = await service.findVersionInBranch(
        'campaign',
        'campaign-1',
        'branch-1',
        new Date('2025-02-01')
      );

      expect(mockPrisma.version.findFirst).toHaveBeenCalledWith({
        where: {
          entityType: 'campaign',
          entityId: 'campaign-1',
          branchId: 'branch-1',
          validFrom: { lte: new Date('2025-02-01') },
          OR: [{ validTo: { gt: new Date('2025-02-01') } }, { validTo: null }],
        },
        orderBy: { validFrom: 'desc' },
      });

      expect(result).toEqual(version);
    });

    it('should find historical version (validFrom <= asOf < validTo)', async () => {
      const version: Version = {
        id: 'version-1',
        entityType: 'campaign',
        entityId: 'campaign-1',
        branchId: 'branch-1',
        validFrom: new Date('2025-01-01'),
        validTo: new Date('2025-02-01'),
        payloadGz: mockCompressedPayload,
        createdAt: new Date('2025-01-01'),
        createdBy: 'user-1',
        comment: null,
        version: 1,
      };

      (mockPrisma.version.findFirst as jest.Mock).mockResolvedValue(version);

      const result = await service.findVersionInBranch(
        'campaign',
        'campaign-1',
        'branch-1',
        new Date('2025-01-15')
      );

      expect(result).toEqual(version);
    });

    it('should return null when no version found', async () => {
      (mockPrisma.version.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.findVersionInBranch(
        'campaign',
        'campaign-1',
        'branch-1',
        new Date('2025-01-01')
      );

      expect(result).toBeNull();
    });
  });

  describe('resolveVersion', () => {
    it('should find version in current branch', async () => {
      const version: Version = {
        id: 'version-1',
        entityType: 'campaign',
        entityId: 'campaign-1',
        branchId: 'branch-1',
        validFrom: new Date('2025-01-01'),
        validTo: null,
        payloadGz: mockCompressedPayload,
        createdAt: new Date('2025-01-01'),
        createdBy: 'user-1',
        comment: null,
        version: 1,
      };

      // Mock branch lookup to get campaignId
      (mockPrisma.branch.findUnique as jest.Mock).mockResolvedValue({
        campaignId: 'campaign-1',
      });

      // Mock branch hierarchy query
      (mockPrisma.branch.findMany as jest.Mock).mockResolvedValue([
        { id: 'branch-1', parentId: null },
      ]);

      // Mock version found in current branch
      (mockPrisma.version.findFirst as jest.Mock).mockResolvedValue(version);

      const result = await service.resolveVersion(
        'campaign',
        'campaign-1',
        'branch-1',
        new Date('2025-02-01')
      );

      expect(result).toEqual(version);

      // Should query for branch to get campaignId
      expect(mockPrisma.branch.findUnique).toHaveBeenCalledWith({
        where: { id: 'branch-1' },
        select: { campaignId: true },
      });

      // Should query for branch hierarchy
      expect(mockPrisma.branch.findMany).toHaveBeenCalledWith({
        where: { campaignId: 'campaign-1', deletedAt: null },
        select: { id: true, parentId: true },
      });
    });

    it('should walk up branch ancestry when version not in current branch', async () => {
      const parentVersion: Version = {
        id: 'version-parent',
        entityType: 'campaign',
        entityId: 'campaign-1',
        branchId: 'branch-parent',
        validFrom: new Date('2025-01-01'),
        validTo: null,
        payloadGz: mockCompressedPayload,
        createdAt: new Date('2025-01-01'),
        createdBy: 'user-1',
        comment: null,
        version: 1,
      };

      // Mock branch lookup to get campaignId
      (mockPrisma.branch.findUnique as jest.Mock).mockResolvedValue({
        campaignId: 'campaign-1',
      });

      // Mock branch hierarchy with parent-child relationship
      (mockPrisma.branch.findMany as jest.Mock).mockResolvedValue([
        { id: 'branch-child', parentId: 'branch-parent' },
        { id: 'branch-parent', parentId: null },
      ]);

      // First call: no version in child branch
      // Second call: version found in parent branch
      (mockPrisma.version.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(parentVersion);

      const result = await service.resolveVersion(
        'campaign',
        'campaign-1',
        'branch-child',
        new Date('2025-01-01')
      );

      // Should query child branch first
      expect(mockPrisma.version.findFirst).toHaveBeenNthCalledWith(1, {
        where: {
          entityType: 'campaign',
          entityId: 'campaign-1',
          branchId: 'branch-child',
          validFrom: { lte: new Date('2025-01-01') },
          OR: [{ validTo: { gt: new Date('2025-01-01') } }, { validTo: null }],
        },
        orderBy: { validFrom: 'desc' },
      });

      // Should query parent branch
      expect(mockPrisma.version.findFirst).toHaveBeenNthCalledWith(2, {
        where: {
          entityType: 'campaign',
          entityId: 'campaign-1',
          branchId: 'branch-parent',
          validFrom: { lte: new Date('2025-01-01') },
          OR: [{ validTo: { gt: new Date('2025-01-01') } }, { validTo: null }],
        },
        orderBy: { validFrom: 'desc' },
      });

      expect(result).toEqual(parentVersion);
    });

    it('should return null when no version found in branch hierarchy', async () => {
      // Mock branch lookup to get campaignId
      (mockPrisma.branch.findUnique as jest.Mock).mockResolvedValue({
        campaignId: 'campaign-1',
      });

      // Mock branch hierarchy
      (mockPrisma.branch.findMany as jest.Mock).mockResolvedValue([
        { id: 'branch-1', parentId: null },
      ]);

      // No version found
      (mockPrisma.version.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.resolveVersion(
        'campaign',
        'campaign-1',
        'branch-1',
        new Date('2025-01-01')
      );

      expect(result).toBeNull();
    });

    it('should throw error when branch not found', async () => {
      (mockPrisma.version.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.branch.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.resolveVersion('campaign', 'campaign-1', 'invalid-branch', new Date('2025-01-01'))
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getVersionDiff', () => {
    it('should calculate diff between two versions', async () => {
      const oldPayload = { name: 'Old Name', count: 5 };
      const newPayload = { name: 'New Name', count: 10, isActive: true };

      const version1: Version = {
        id: 'version-1',
        entityType: 'campaign',
        entityId: 'campaign-1',
        branchId: 'branch-1',
        validFrom: new Date('2025-01-01'),
        validTo: new Date('2025-02-01'),
        payloadGz: Buffer.from('old-compressed'),
        createdAt: new Date('2025-01-01'),
        createdBy: 'user-1',
        comment: null,
        version: 1,
      };

      const version2: Version = {
        id: 'version-2',
        entityType: 'campaign',
        entityId: 'campaign-1',
        branchId: 'branch-1',
        validFrom: new Date('2025-02-01'),
        validTo: null,
        payloadGz: Buffer.from('new-compressed'),
        createdAt: new Date('2025-02-01'),
        createdBy: 'user-1',
        comment: null,
        version: 2,
      };

      (mockPrisma.version.findFirst as jest.Mock)
        .mockResolvedValueOnce(version1)
        .mockResolvedValueOnce(version2);

      (decompressPayload as jest.Mock)
        .mockResolvedValueOnce(oldPayload)
        .mockResolvedValueOnce(newPayload);

      const mockDiff = {
        added: { isActive: true },
        modified: { name: { old: 'Old Name', new: 'New Name' }, count: { old: 5, new: 10 } },
        removed: {},
      };
      (calculateDiff as jest.Mock).mockReturnValue(mockDiff);

      const result = await service.getVersionDiff('version-1', 'version-2');

      expect(mockPrisma.version.findFirst).toHaveBeenCalledTimes(2);
      expect(decompressPayload).toHaveBeenCalledTimes(2);
      expect(calculateDiff).toHaveBeenCalledWith(oldPayload, newPayload);

      // Verify the result contains the diff structure
      expect(result).toHaveProperty('added');
      expect(result).toHaveProperty('modified');
      expect(result).toHaveProperty('removed');
      expect(result).toEqual(mockDiff);
    });

    it('should throw error when first version not found', async () => {
      (mockPrisma.version.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(service.getVersionDiff('invalid-1', 'version-2')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw error when second version not found', async () => {
      const version1: Version = {
        id: 'version-1',
        entityType: 'campaign',
        entityId: 'campaign-1',
        branchId: 'branch-1',
        validFrom: new Date('2025-01-01'),
        validTo: new Date('2025-02-01'),
        payloadGz: mockCompressedPayload,
        createdAt: new Date('2025-01-01'),
        createdBy: 'user-1',
        comment: null,
        version: 1,
      };

      (mockPrisma.version.findFirst as jest.Mock)
        .mockResolvedValueOnce(version1)
        .mockResolvedValueOnce(null);

      await expect(service.getVersionDiff('version-1', 'invalid-2')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('restoreVersion', () => {
    it('should create new version with historical payload', async () => {
      const historicalVersion: Version = {
        id: 'version-old',
        entityType: 'campaign',
        entityId: 'campaign-1',
        branchId: 'branch-1',
        validFrom: new Date('2025-01-01'),
        validTo: new Date('2025-02-01'),
        payloadGz: Buffer.from('old-compressed'),
        createdAt: new Date('2025-01-01'),
        createdBy: 'user-1',
        comment: 'Old version',
        version: 1,
      };

      const restoredVersion: Version = {
        id: 'version-restored',
        entityType: 'campaign',
        entityId: 'campaign-1',
        branchId: 'branch-1',
        validFrom: new Date('2025-03-01'),
        validTo: null,
        payloadGz: Buffer.from('old-compressed'),
        createdAt: new Date('2025-03-01'),
        createdBy: 'user-1',
        comment: 'Restored from version-old',
        version: 3,
      };

      // Mock finding the historical version
      (mockPrisma.version.findFirst as jest.Mock)
        .mockResolvedValueOnce(historicalVersion)
        // Mock finding latest version for version numbering
        .mockResolvedValueOnce({ version: 2 });

      // Mock branch lookup for authorization
      (mockPrisma.branch.findUnique as jest.Mock).mockResolvedValue(mockBranch);

      // Mock version creation
      (mockPrisma.version.create as jest.Mock).mockResolvedValue(restoredVersion);

      const result = await service.restoreVersion('version-old', mockUser, new Date('2025-03-01'));

      expect(mockPrisma.version.findFirst).toHaveBeenNthCalledWith(1, {
        where: { id: 'version-old' },
      });

      // Should verify authorization
      expect(mockPrisma.branch.findUnique).toHaveBeenCalledWith({
        where: { id: 'branch-1' },
        include: { campaign: { select: { ownerId: true, memberships: true } } },
      });

      // Should query for latest version number
      expect(mockPrisma.version.findFirst).toHaveBeenNthCalledWith(2, {
        where: {
          entityType: 'campaign',
          entityId: 'campaign-1',
          branchId: 'branch-1',
        },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      // Should NOT decompress/recompress - just reuse the compressed payload
      expect(decompressPayload).not.toHaveBeenCalled();
      expect(compressPayload).not.toHaveBeenCalled();

      expect(mockPrisma.version.create).toHaveBeenCalledWith({
        data: {
          entityType: 'campaign',
          entityId: 'campaign-1',
          branchId: 'branch-1',
          validFrom: new Date('2025-03-01'),
          validTo: null,
          payloadGz: Buffer.from('old-compressed'),
          createdBy: 'user-1',
          comment: 'Restored from version-old',
          version: 3,
        },
      });

      // Should create audit entry
      expect(mockAudit.log).toHaveBeenCalledWith(
        'version',
        restoredVersion.id,
        'RESTORE',
        'user-1',
        expect.any(Object)
      );

      expect(result).toEqual(restoredVersion);
    });

    it('should throw error when version to restore not found', async () => {
      (mockPrisma.version.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.restoreVersion('invalid-version', mockUser, new Date('2025-03-01'))
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('decompressVersion', () => {
    it('should decompress version payload', async () => {
      const version: Version = {
        id: 'version-1',
        entityType: 'campaign',
        entityId: 'campaign-1',
        branchId: 'branch-1',
        validFrom: new Date('2025-01-01'),
        validTo: null,
        payloadGz: mockCompressedPayload,
        createdAt: new Date('2025-01-01'),
        createdBy: 'user-1',
        comment: null,
        version: 1,
      };

      (decompressPayload as jest.Mock).mockResolvedValue(mockPayload);

      const result = await service.decompressVersion(version);

      expect(decompressPayload).toHaveBeenCalledWith(mockCompressedPayload);
      expect(result).toEqual(mockPayload);
    });
  });
});
