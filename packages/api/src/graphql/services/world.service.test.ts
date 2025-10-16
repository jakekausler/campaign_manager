/**
 * World Service Tests
 */

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';

import { AuditService } from './audit.service';
import { WorldService } from './world.service';

describe('WorldService', () => {
  let service: WorldService;
  let prisma: PrismaService;
  let audit: AuditService;

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'user',
  };

  const mockWorld = {
    id: 'world-1',
    name: 'Middle Earth',
    calendars: { gregorian: { name: 'Gregorian' } },
    settings: { timezone: 'UTC' },
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    archivedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorldService,
        {
          provide: PrismaService,
          useValue: {
            world: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            campaign: {
              updateMany: jest.fn(),
            },
            location: {
              updateMany: jest.fn(),
            },
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WorldService>(WorldService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a world by ID', async () => {
      (prisma.world.findFirst as jest.Mock).mockResolvedValue(mockWorld);

      const result = await service.findById('world-1');

      expect(result).toEqual(mockWorld);
      expect(prisma.world.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'world-1',
          deletedAt: null,
        },
      });
    });

    it('should return null if world not found', async () => {
      (prisma.world.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all non-deleted, non-archived worlds', async () => {
      const worlds = [mockWorld, { ...mockWorld, id: 'world-2', name: 'Forgotten Realms' }];
      (prisma.world.findMany as jest.Mock).mockResolvedValue(worlds);

      const result = await service.findAll();

      expect(result).toEqual(worlds);
      expect(prisma.world.findMany).toHaveBeenCalledWith({
        where: {
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
    it('should create a new world with valid data', async () => {
      const input = {
        name: 'Middle Earth',
        calendars: { gregorian: { name: 'Gregorian' } },
        settings: { timezone: 'UTC' },
      };

      (prisma.world.create as jest.Mock).mockResolvedValue(mockWorld);

      const result = await service.create(input, mockUser);

      expect(result).toEqual(mockWorld);
      expect(prisma.world.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          calendars: input.calendars,
          settings: input.settings,
        },
      });
      expect(audit.log).toHaveBeenCalledWith('world', mockWorld.id, 'CREATE', mockUser.id, {
        name: mockWorld.name,
        calendars: mockWorld.calendars,
        settings: mockWorld.settings,
      });
    });

    it('should create a world with default empty settings', async () => {
      const input = {
        name: 'Middle Earth',
        calendars: { gregorian: { name: 'Gregorian' } },
      };

      (prisma.world.create as jest.Mock).mockResolvedValue({
        ...mockWorld,
        settings: {},
      });

      await service.create(input, mockUser);

      expect(prisma.world.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          calendars: input.calendars,
          settings: {},
        },
      });
    });
  });

  describe('update', () => {
    it('should update a world with valid data', async () => {
      const input = {
        name: 'Updated Middle Earth',
      };

      (prisma.world.findFirst as jest.Mock).mockResolvedValue(mockWorld);
      (prisma.world.update as jest.Mock).mockResolvedValue({
        ...mockWorld,
        name: input.name,
      });

      const result = await service.update('world-1', input, mockUser);

      expect(result.name).toBe(input.name);
      expect(prisma.world.update).toHaveBeenCalledWith({
        where: { id: 'world-1' },
        data: { name: input.name },
      });
      expect(audit.log).toHaveBeenCalledWith('world', 'world-1', 'UPDATE', mockUser.id, {
        name: input.name,
      });
    });

    it('should throw NotFoundException if world not found', async () => {
      (prisma.world.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'Test' }, mockUser)).rejects.toThrow(
        NotFoundException
      );
      expect(prisma.world.update).not.toHaveBeenCalled();
    });

    it('should only update provided fields', async () => {
      const input = {
        settings: { newSetting: 'value' },
      };

      (prisma.world.findFirst as jest.Mock).mockResolvedValue(mockWorld);
      (prisma.world.update as jest.Mock).mockResolvedValue({
        ...mockWorld,
        settings: input.settings,
      });

      await service.update('world-1', input, mockUser);

      expect(prisma.world.update).toHaveBeenCalledWith({
        where: { id: 'world-1' },
        data: { settings: input.settings },
      });
    });
  });

  describe('delete', () => {
    it('should soft delete a world', async () => {
      (prisma.world.findFirst as jest.Mock).mockResolvedValue(mockWorld);
      (prisma.world.update as jest.Mock).mockResolvedValue({
        ...mockWorld,
        deletedAt: expect.any(Date),
      });

      const result = await service.delete('world-1', mockUser);

      expect(result.deletedAt).toBeDefined();
      expect(prisma.world.update).toHaveBeenCalledWith({
        where: { id: 'world-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith('world', 'world-1', 'DELETE', mockUser.id, {
        deletedAt: expect.any(Date),
      });
    });

    it('should cascade delete to campaigns', async () => {
      (prisma.world.findFirst as jest.Mock).mockResolvedValue(mockWorld);
      (prisma.world.update as jest.Mock).mockResolvedValue({
        ...mockWorld,
        deletedAt: new Date(),
      });

      await service.delete('world-1', mockUser);

      expect(prisma.campaign.updateMany).toHaveBeenCalledWith({
        where: { worldId: 'world-1', deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should cascade delete to locations', async () => {
      (prisma.world.findFirst as jest.Mock).mockResolvedValue(mockWorld);
      (prisma.world.update as jest.Mock).mockResolvedValue({
        ...mockWorld,
        deletedAt: new Date(),
      });

      await service.delete('world-1', mockUser);

      expect(prisma.location.updateMany).toHaveBeenCalledWith({
        where: { worldId: 'world-1', deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException if world not found', async () => {
      (prisma.world.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.world.update).not.toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    it('should archive a world', async () => {
      (prisma.world.findFirst as jest.Mock).mockResolvedValue(mockWorld);
      (prisma.world.update as jest.Mock).mockResolvedValue({
        ...mockWorld,
        archivedAt: expect.any(Date),
      });

      const result = await service.archive('world-1', mockUser);

      expect(result.archivedAt).toBeDefined();
      expect(prisma.world.update).toHaveBeenCalledWith({
        where: { id: 'world-1' },
        data: { archivedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith('world', 'world-1', 'ARCHIVE', mockUser.id, {
        archivedAt: expect.any(Date),
      });
    });

    it('should throw NotFoundException if world not found', async () => {
      (prisma.world.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.archive('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.world.update).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('should restore an archived world', async () => {
      const archivedWorld = {
        ...mockWorld,
        archivedAt: new Date(),
      };

      (prisma.world.findFirst as jest.Mock).mockResolvedValue(archivedWorld);
      (prisma.world.update as jest.Mock).mockResolvedValue({
        ...archivedWorld,
        archivedAt: null,
      });

      const result = await service.restore('world-1', mockUser);

      expect(result.archivedAt).toBeNull();
      expect(prisma.world.update).toHaveBeenCalledWith({
        where: { id: 'world-1' },
        data: { archivedAt: null },
      });
      expect(audit.log).toHaveBeenCalledWith('world', 'world-1', 'RESTORE', mockUser.id, {
        archivedAt: null,
      });
    });

    it('should throw NotFoundException if world not found', async () => {
      (prisma.world.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.restore('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.world.update).not.toHaveBeenCalled();
    });
  });
});
