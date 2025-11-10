/**
 * Location Service Tests
 */

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { CacheStatsService } from '../../common/cache/cache-stats.service';
import { CacheService } from '../../common/cache/cache.service';
import { SpatialService } from '../../common/services/spatial.service';
import { TileCacheService } from '../../common/services/tile-cache.service';
import { PrismaService } from '../../database/prisma.service';
import { REDIS_CACHE } from '../cache/redis-cache.provider';
import type { AuthenticatedUser } from '../context/graphql-context';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';

import { AuditService } from './audit.service';
import { LocationService } from './location.service';
import { VersionService } from './version.service';

describe('LocationService', () => {
  let service: LocationService;
  let prisma: PrismaService;
  let audit: AuditService;
  let tileCacheService: TileCacheService;

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'user',
  };

  const mockWorld = {
    id: 'world-1',
    name: 'Middle Earth',
    calendars: {},
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    archivedAt: null,
  };

  const mockLocation = {
    id: 'location-1',
    worldId: 'world-1',
    type: 'region',
    geom: null,
    name: 'The Shire',
    description: 'A peaceful land',
    parentLocationId: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    archivedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationService,
        CacheService,
        {
          provide: PrismaService,
          useValue: {
            world: {
              findFirst: jest.fn(),
            },
            location: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            branch: {
              findFirst: jest.fn(),
            },
            $queryRaw: jest.fn(),
            $executeRaw: jest.fn(),
            $transaction: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: TileCacheService,
          useValue: {
            generateTileKey: jest.fn(),
            get: jest.fn(),
            set: jest.fn(),
            invalidate: jest.fn(),
            invalidateWorld: jest.fn(),
            clear: jest.fn(),
            getStats: jest.fn(),
          },
        },
        {
          provide: VersionService,
          useValue: {
            createVersion: jest.fn(),
            resolveVersion: jest.fn(),
            decompressVersion: jest.fn(),
          },
        },
        {
          provide: SpatialService,
          useValue: {
            validateGeometry: jest.fn(),
            geoJsonToEWKB: jest.fn(),
          },
        },
        {
          provide: REDIS_PUBSUB,
          useValue: {
            publish: jest.fn(),
          },
        },
        {
          provide: REDIS_CACHE,
          useValue: {
            get: jest.fn(),
            setex: jest.fn(),
            del: jest.fn(),
            scan: jest.fn(),
            keyPrefix: 'cache:',
          },
        },
        {
          provide: CacheStatsService,
          useValue: {
            recordHit: jest.fn(),
            recordMiss: jest.fn(),
            recordSet: jest.fn(),
            recordInvalidation: jest.fn(),
            recordCascadeInvalidation: jest.fn(),
            getStats: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LocationService>(LocationService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
    tileCacheService = module.get<TileCacheService>(TileCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a location by ID', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([mockLocation]);

      const result = await service.findById('location-1');

      expect(result).toEqual(mockLocation);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should return null if location not found', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByWorldId', () => {
    it('should return all non-deleted, non-archived locations for a world', async () => {
      const locations = [mockLocation, { ...mockLocation, id: 'location-2', name: 'Rivendell' }];
      (prisma.location.findMany as jest.Mock).mockResolvedValue(locations);

      const result = await service.findByWorldId('world-1');

      expect(result).toEqual(locations);
      expect(prisma.location.findMany).toHaveBeenCalledWith({
        where: {
          worldId: 'world-1',
          deletedAt: null,
          archivedAt: null,
        },
        orderBy: {
          name: 'asc',
        },
      });
    });
  });

  describe('findChildren', () => {
    it('should return child locations for a parent', async () => {
      const children = [
        { ...mockLocation, id: 'child-1', parentLocationId: 'location-1', name: 'Hobbiton' },
        { ...mockLocation, id: 'child-2', parentLocationId: 'location-1', name: 'Bywater' },
      ];
      (prisma.location.findMany as jest.Mock).mockResolvedValue(children);

      const result = await service.findChildren('location-1');

      expect(result).toEqual(children);
      expect(prisma.location.findMany).toHaveBeenCalledWith({
        where: {
          parentLocationId: 'location-1',
          deletedAt: null,
          archivedAt: null,
        },
        orderBy: {
          name: 'asc',
        },
      });
    });
  });

  describe('create', () => {
    it('should create a new location with valid data', async () => {
      const input = {
        worldId: 'world-1',
        type: 'region',
        name: 'The Shire',
        description: 'A peaceful land',
      };

      (prisma.world.findFirst as jest.Mock).mockResolvedValue(mockWorld);
      (prisma.location.create as jest.Mock).mockResolvedValue(mockLocation);

      const result = await service.create(input, mockUser);

      expect(result).toEqual(mockLocation);
      expect(prisma.location.create).toHaveBeenCalledWith({
        data: {
          worldId: input.worldId,
          type: input.type,
          name: input.name,
          description: input.description,
          parentLocationId: null,
        },
      });
      expect(audit.log).toHaveBeenCalledWith('location', mockLocation.id, 'CREATE', mockUser.id, {
        worldId: mockLocation.worldId,
        type: mockLocation.type,
        name: mockLocation.name,
        description: mockLocation.description,
        parentLocationId: mockLocation.parentLocationId,
      });
      expect(tileCacheService.invalidateWorld).toHaveBeenCalledWith(mockLocation.worldId);
    });

    it('should create a location with a parent', async () => {
      const parentLocation = { ...mockLocation, id: 'parent-1' };
      const input = {
        worldId: 'world-1',
        type: 'point',
        name: 'Hobbiton',
        parentLocationId: 'parent-1',
      };

      (prisma.world.findFirst as jest.Mock).mockResolvedValue(mockWorld);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(parentLocation);
      (prisma.location.create as jest.Mock).mockResolvedValue({
        ...mockLocation,
        id: 'location-2',
        name: 'Hobbiton',
        parentLocationId: 'parent-1',
      });

      await service.create(input, mockUser);

      expect(prisma.location.findFirst).toHaveBeenCalledWith({
        where: { id: 'parent-1', deletedAt: null },
      });
      expect(prisma.location.create).toHaveBeenCalledWith({
        data: {
          worldId: input.worldId,
          type: input.type,
          name: input.name,
          description: null,
          parentLocationId: input.parentLocationId,
        },
      });
      expect(tileCacheService.invalidateWorld).toHaveBeenCalledWith(mockLocation.worldId);
    });

    it('should throw NotFoundException if world not found', async () => {
      const input = {
        worldId: 'nonexistent',
        type: 'region',
      };

      (prisma.world.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(input, mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.location.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if parent location not found', async () => {
      const input = {
        worldId: 'world-1',
        type: 'point',
        parentLocationId: 'nonexistent',
      };

      (prisma.world.findFirst as jest.Mock).mockResolvedValue(mockWorld);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(input, mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.location.create).not.toHaveBeenCalled();
    });

    it('should throw error if parent location belongs to different world', async () => {
      const parentLocation = { ...mockLocation, id: 'parent-1', worldId: 'world-2' };
      const input = {
        worldId: 'world-1',
        type: 'point',
        parentLocationId: 'parent-1',
      };

      (prisma.world.findFirst as jest.Mock).mockResolvedValue(mockWorld);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(parentLocation);

      await expect(service.create(input, mockUser)).rejects.toThrow(
        'Parent location must belong to the same world'
      );
      expect(prisma.location.create).not.toHaveBeenCalled();
    });
  });

  // TODO: Update tests need to be rewritten for new versioning system
  // New signature: update(id, input, user, expectedVersion, branchId, worldTime?)
  describe.skip('update', () => {
    it('should update a location with valid data', async () => {
      const input = {
        name: 'Updated Shire',
        description: 'An even more peaceful land',
      };

      (prisma.location.findFirst as jest.Mock).mockResolvedValue(mockLocation);
      (prisma.location.update as jest.Mock).mockResolvedValue({
        ...mockLocation,
        ...input,
      });

      // @ts-expect-error - Old signature, needs rewrite for versioning
      const result = await service.update('location-1', input, mockUser);

      expect(result.name).toBe(input.name);
      expect(prisma.location.update).toHaveBeenCalledWith({
        where: { id: 'location-1' },
        data: input,
      });
      expect(audit.log).toHaveBeenCalledWith(
        'location',
        'location-1',
        'UPDATE',
        mockUser.id,
        input
      );
    });

    it('should throw NotFoundException if location not found', async () => {
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(null);

      // @ts-expect-error - Old signature, needs rewrite for versioning
      await expect(service.update('nonexistent', { name: 'Test' }, mockUser)).rejects.toThrow(
        NotFoundException
      );
      expect(prisma.location.update).not.toHaveBeenCalled();
    });

    it('should throw error if location set as its own parent', async () => {
      const input = {
        parentLocationId: 'location-1',
      };

      (prisma.location.findFirst as jest.Mock).mockResolvedValue(mockLocation);

      // @ts-expect-error - Old signature, needs rewrite for versioning
      await expect(service.update('location-1', input, mockUser)).rejects.toThrow(
        'Location cannot be its own parent'
      );
      expect(prisma.location.update).not.toHaveBeenCalled();
    });

    it('should allow removing parent by setting to null', async () => {
      const input = {
        parentLocationId: null,
      };

      (prisma.location.findFirst as jest.Mock).mockResolvedValue({
        ...mockLocation,
        parentLocationId: 'parent-1',
      });
      (prisma.location.update as jest.Mock).mockResolvedValue({
        ...mockLocation,
        parentLocationId: null,
      });

      // @ts-expect-error - Old signature, needs rewrite for versioning
      await service.update('location-1', input, mockUser);

      expect(prisma.location.update).toHaveBeenCalledWith({
        where: { id: 'location-1' },
        data: { parent: { disconnect: true } },
      });
    });

    it('should throw error if new parent belongs to different world', async () => {
      const newParent = { ...mockLocation, id: 'parent-1', worldId: 'world-2' };
      const input = {
        parentLocationId: 'parent-1',
      };

      (prisma.location.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockLocation) // First call: find the location being updated
        .mockResolvedValueOnce(newParent); // Second call: find the new parent

      // @ts-expect-error - Old signature, needs rewrite for versioning
      await expect(service.update('location-1', input, mockUser)).rejects.toThrow(
        'Parent location must belong to the same world'
      );
      expect(prisma.location.update).not.toHaveBeenCalled();
    });

    it('should detect and prevent circular references', async () => {
      const location1 = { ...mockLocation, id: 'loc-1', parentLocationId: null };
      const location2 = { ...mockLocation, id: 'loc-2', parentLocationId: 'loc-1' };
      const location3 = { ...mockLocation, id: 'loc-3', parentLocationId: 'loc-2' };

      const input = {
        parentLocationId: 'loc-3', // Try to make loc-1 a child of loc-3 (circular!)
      };

      (prisma.location.findFirst as jest.Mock)
        .mockResolvedValueOnce(location1) // Find location being updated (loc-1)
        .mockResolvedValueOnce(location3) // Find new parent (loc-3)
        .mockResolvedValueOnce(location2) // Traverse: loc-3's parent is loc-2
        .mockResolvedValueOnce(location1); // Traverse: loc-2's parent is loc-1 - CIRCULAR!

      // @ts-expect-error - Old signature, needs rewrite for versioning
      await expect(service.update('loc-1', input, mockUser)).rejects.toThrow(
        'Cannot set parent: would create circular reference'
      );
      expect(prisma.location.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete a location', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([mockLocation]); // findById uses $queryRaw
      (prisma.location.findMany as jest.Mock).mockResolvedValue([]); // No children
      (prisma.location.update as jest.Mock).mockResolvedValue({
        ...mockLocation,
        deletedAt: expect.any(Date),
      });

      const result = await service.delete('location-1', mockUser);

      expect(result.deletedAt).toBeDefined();
      expect(prisma.location.update).toHaveBeenCalledWith({
        where: { id: 'location-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith('location', 'location-1', 'DELETE', mockUser.id, {
        deletedAt: expect.any(Date),
      });
      expect(tileCacheService.invalidateWorld).toHaveBeenCalledWith(mockLocation.worldId);
    });

    it('should cascade delete to child locations', async () => {
      const children = [
        { id: 'child-1', parentLocationId: 'location-1' },
        { id: 'child-2', parentLocationId: 'location-1' },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([mockLocation]); // findById uses $queryRaw
      (prisma.location.findMany as jest.Mock)
        .mockResolvedValueOnce(children) // Children of parent
        .mockResolvedValueOnce([]) // No children of child-1
        .mockResolvedValueOnce([]); // No children of child-2
      (prisma.location.update as jest.Mock).mockResolvedValue({
        ...mockLocation,
        deletedAt: new Date(),
      });
      (prisma.location.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

      await service.delete('location-1', mockUser);

      // Should update children
      expect(prisma.location.updateMany).toHaveBeenCalledWith({
        where: {
          parentLocationId: 'location-1',
          deletedAt: null,
        },
        data: { deletedAt: expect.any(Date) },
      });
      expect(tileCacheService.invalidateWorld).toHaveBeenCalledWith(mockLocation.worldId);
    });

    it('should recursively cascade delete through multiple levels', async () => {
      const level1Children = [{ id: 'level1-1' }];
      const level2Children = [{ id: 'level2-1' }];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([mockLocation]); // findById uses $queryRaw
      (prisma.location.findMany as jest.Mock)
        .mockResolvedValueOnce(level1Children) // Children of root
        .mockResolvedValueOnce(level2Children) // Children of level1-1
        .mockResolvedValueOnce([]); // No children of level2-1
      (prisma.location.update as jest.Mock).mockResolvedValue({
        ...mockLocation,
        deletedAt: new Date(),
      });
      (prisma.location.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await service.delete('location-1', mockUser);

      // Should cascade through all levels (3 updateMany calls: one per level)
      // Level 2 (deepest) -> Level 1 -> Root level
      expect(prisma.location.updateMany).toHaveBeenCalledTimes(3);
      expect(tileCacheService.invalidateWorld).toHaveBeenCalledWith(mockLocation.worldId);
    });

    it('should throw NotFoundException if location not found', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]); // findById returns null

      await expect(service.delete('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.location.update).not.toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    it('should archive a location', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([mockLocation]); // findById uses $queryRaw
      (prisma.location.update as jest.Mock).mockResolvedValue({
        ...mockLocation,
        archivedAt: expect.any(Date),
      });

      const result = await service.archive('location-1', mockUser);

      expect(result.archivedAt).toBeDefined();
      expect(prisma.location.update).toHaveBeenCalledWith({
        where: { id: 'location-1' },
        data: { archivedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith('location', 'location-1', 'ARCHIVE', mockUser.id, {
        archivedAt: expect.any(Date),
      });
    });

    it('should throw NotFoundException if location not found', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]); // findById returns null

      await expect(service.archive('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.location.update).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('should restore an archived location', async () => {
      const archivedLocation = {
        ...mockLocation,
        archivedAt: new Date(),
      };

      (prisma.location.findFirst as jest.Mock).mockResolvedValue(archivedLocation);
      (prisma.location.update as jest.Mock).mockResolvedValue({
        ...archivedLocation,
        archivedAt: null,
      });

      const result = await service.restore('location-1', mockUser);

      expect(result.archivedAt).toBeNull();
      expect(prisma.location.update).toHaveBeenCalledWith({
        where: { id: 'location-1' },
        data: { archivedAt: null },
      });
      expect(audit.log).toHaveBeenCalledWith('location', 'location-1', 'RESTORE', mockUser.id, {
        archivedAt: null,
      });
    });

    it('should throw NotFoundException if location not found', async () => {
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.restore('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.location.update).not.toHaveBeenCalled();
    });
  });
});
