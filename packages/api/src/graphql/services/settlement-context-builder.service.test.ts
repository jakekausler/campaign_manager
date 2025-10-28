/**
 * SettlementContextBuilderService Unit Tests
 * Tests settlement context building with structure statistics calculation
 */

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';

import { SettlementContextBuilderService } from './settlement-context-builder.service';

describe('SettlementContextBuilderService', () => {
  let service: SettlementContextBuilderService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementContextBuilderService,
        {
          provide: PrismaService,
          useValue: {
            settlement: {
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SettlementContextBuilderService>(SettlementContextBuilderService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('buildContext', () => {
    it('should build complete settlement context with structure statistics', async () => {
      // Arrange
      const mockSettlement = {
        id: 'settlement-123',
        name: 'Riverside',
        level: 5,
        kingdomId: 'kingdom-456',
        locationId: 'location-789',
        variables: {
          population: 8500,
          prosperity: 'thriving',
          defenseRating: 7,
        },
        structures: [
          { id: 'str-1', type: 'temple', level: 4 },
          { id: 'str-2', type: 'temple', level: 5 },
          { id: 'str-3', type: 'barracks', level: 3 },
          { id: 'str-4', type: 'market', level: 4 },
          { id: 'str-5', type: 'market', level: 5 },
          { id: 'str-6', type: 'market', level: 3 },
          { id: 'str-7', type: 'library', level: 6 },
          { id: 'str-8', type: 'forge', level: 4 },
          { id: 'str-9', type: 'forge', level: 4 },
          { id: 'str-10', type: 'tavern', level: 2 },
          { id: 'str-11', type: 'tavern', level: 3 },
          { id: 'str-12', type: 'tavern', level: 5 },
        ],
      };

      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(mockSettlement);

      // Act
      const result = await service.buildContext('settlement-123');

      // Assert
      expect(result).toEqual({
        id: 'settlement-123',
        name: 'Riverside',
        level: 5,
        kingdomId: 'kingdom-456',
        locationId: 'location-789',
        variables: {
          population: 8500,
          prosperity: 'thriving',
          defenseRating: 7,
        },
        structures: {
          count: 12,
          byType: {
            temple: 2,
            barracks: 1,
            market: 3,
            library: 1,
            forge: 2,
            tavern: 3,
          },
          averageLevel: 4, // (4+5+3+4+5+3+6+4+4+2+3+5) / 12 = 48 / 12 = 4
        },
      });

      expect(prisma.settlement.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'settlement-123',
          deletedAt: null,
        },
        include: {
          structures: {
            where: {
              deletedAt: null,
            },
            select: {
              id: true,
              type: true,
              level: true,
            },
          },
        },
      });
    });

    it('should build context for settlement with no structures', async () => {
      // Arrange
      const mockSettlement = {
        id: 'settlement-empty',
        name: 'New Settlement',
        level: 1,
        kingdomId: 'kingdom-456',
        locationId: 'location-999',
        variables: {
          population: 100,
        },
        structures: [],
      };

      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(mockSettlement);

      // Act
      const result = await service.buildContext('settlement-empty');

      // Assert
      expect(result.structures).toEqual({
        count: 0,
        byType: {},
        averageLevel: 0,
      });
    });

    it('should handle settlement with single structure', async () => {
      // Arrange
      const mockSettlement = {
        id: 'settlement-single',
        name: 'Hamlet',
        level: 1,
        kingdomId: 'kingdom-456',
        locationId: 'location-888',
        variables: {},
        structures: [{ id: 'str-1', type: 'tavern', level: 1 }],
      };

      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(mockSettlement);

      // Act
      const result = await service.buildContext('settlement-single');

      // Assert
      expect(result.structures).toEqual({
        count: 1,
        byType: {
          tavern: 1,
        },
        averageLevel: 1,
      });
    });

    it('should correctly calculate average level with decimal values', async () => {
      // Arrange
      const mockSettlement = {
        id: 'settlement-decimal',
        name: 'Cityville',
        level: 3,
        kingdomId: 'kingdom-456',
        locationId: 'location-777',
        variables: {},
        structures: [
          { id: 'str-1', type: 'temple', level: 2 },
          { id: 'str-2', type: 'market', level: 3 },
          { id: 'str-3', type: 'library', level: 4 },
        ],
      };

      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(mockSettlement);

      // Act
      const result = await service.buildContext('settlement-decimal');

      // Assert
      // Average: (2 + 3 + 4) / 3 = 9 / 3 = 3
      expect(result.structures.averageLevel).toBe(3);
    });

    it('should handle settlement with null level gracefully', async () => {
      // Arrange
      const mockSettlement = {
        id: 'settlement-null-level',
        name: 'Unnamed',
        level: null,
        kingdomId: 'kingdom-456',
        locationId: 'location-666',
        variables: {},
        structures: [],
      };

      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(mockSettlement);

      // Act
      const result = await service.buildContext('settlement-null-level');

      // Assert
      expect(result.level).toBe(0);
    });

    it('should handle settlement with null variables gracefully', async () => {
      // Arrange
      const mockSettlement = {
        id: 'settlement-null-vars',
        name: 'Varless',
        level: 2,
        kingdomId: 'kingdom-456',
        locationId: 'location-555',
        variables: null,
        structures: [],
      };

      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(mockSettlement);

      // Act
      const result = await service.buildContext('settlement-null-vars');

      // Assert
      expect(result.variables).toEqual({});
    });

    it('should handle structures with null levels gracefully', async () => {
      // Arrange
      const mockSettlement = {
        id: 'settlement-null-structure-levels',
        name: 'Damaged',
        level: 3,
        kingdomId: 'kingdom-456',
        locationId: 'location-444',
        variables: {},
        structures: [
          { id: 'str-1', type: 'temple', level: 3 },
          { id: 'str-2', type: 'market', level: null },
          { id: 'str-3', type: 'barracks', level: 2 },
        ],
      };

      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(mockSettlement);

      // Act
      const result = await service.buildContext('settlement-null-structure-levels');

      // Assert
      // Average: (3 + 0 + 2) / 3 = 5 / 3 ≈ 1.67
      expect(result.structures.averageLevel).toBeCloseTo(1.67, 2);
      expect(result.structures.count).toBe(3);
    });

    it('should throw NotFoundException when settlement does not exist', async () => {
      // Arrange
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.buildContext('nonexistent-settlement')).rejects.toThrow(
        new NotFoundException('Settlement with ID nonexistent-settlement not found')
      );
    });

    it('should throw NotFoundException when settlement is soft-deleted', async () => {
      // Arrange
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.buildContext('deleted-settlement')).rejects.toThrow(NotFoundException);

      // Verify query included deletedAt: null filter
      expect(prisma.settlement.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'deleted-settlement',
          deletedAt: null,
        },
        include: {
          structures: {
            where: {
              deletedAt: null,
            },
            select: {
              id: true,
              type: true,
              level: true,
            },
          },
        },
      });
    });

    it('should correctly count structures by type with many of same type', async () => {
      // Arrange
      const mockSettlement = {
        id: 'settlement-many-barracks',
        name: 'Military Outpost',
        level: 4,
        kingdomId: 'kingdom-456',
        locationId: 'location-333',
        variables: {},
        structures: [
          { id: 'str-1', type: 'barracks', level: 3 },
          { id: 'str-2', type: 'barracks', level: 4 },
          { id: 'str-3', type: 'barracks', level: 3 },
          { id: 'str-4', type: 'barracks', level: 5 },
          { id: 'str-5', type: 'barracks', level: 4 },
          { id: 'str-6', type: 'forge', level: 2 },
        ],
      };

      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(mockSettlement);

      // Act
      const result = await service.buildContext('settlement-many-barracks');

      // Assert
      expect(result.structures.byType).toEqual({
        barracks: 5,
        forge: 1,
      });
      expect(result.structures.count).toBe(6);
    });

    it('should exclude soft-deleted structures from calculations', async () => {
      // Arrange
      // Prisma query already filters deletedAt: null, so soft-deleted structures won't be included
      const mockSettlement = {
        id: 'settlement-filtered',
        name: 'Filtered',
        level: 3,
        kingdomId: 'kingdom-456',
        locationId: 'location-222',
        variables: {},
        structures: [
          // Only non-deleted structures returned by Prisma
          { id: 'str-1', type: 'temple', level: 4 },
          { id: 'str-2', type: 'market', level: 3 },
        ],
      };

      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(mockSettlement);

      // Act
      const result = await service.buildContext('settlement-filtered');

      // Assert
      expect(result.structures.count).toBe(2);
      expect(result.structures.averageLevel).toBe(3.5); // (4 + 3) / 2
    });
  });
});
