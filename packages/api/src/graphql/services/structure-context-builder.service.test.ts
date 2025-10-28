/**
 * StructureContextBuilderService Unit Tests
 * Tests structure context building with operational status determination
 */

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';

import { StructureContextBuilderService } from './structure-context-builder.service';

describe('StructureContextBuilderService', () => {
  let service: StructureContextBuilderService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StructureContextBuilderService,
        {
          provide: PrismaService,
          useValue: {
            structure: {
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<StructureContextBuilderService>(StructureContextBuilderService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('buildContext', () => {
    it('should build complete structure context with operational status', async () => {
      // Arrange
      const mockStructure = {
        id: 'structure-123',
        name: 'Temple of Light',
        type: 'temple',
        level: 5,
        settlementId: 'settlement-456',
        variables: {
          integrity: 95,
          consecration: 'high',
          worshippers: 250,
        },
      };

      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(mockStructure);

      // Act
      const result = await service.buildContext('structure-123');

      // Assert
      expect(result).toEqual({
        id: 'structure-123',
        name: 'Temple of Light',
        type: 'temple',
        level: 5,
        settlementId: 'settlement-456',
        variables: {
          integrity: 95,
          consecration: 'high',
          worshippers: 250,
        },
        operational: true, // integrity >= 50
      });

      expect(prisma.structure.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'structure-123',
          deletedAt: null,
        },
      });
    });

    it('should determine operational=true when explicit operational flag is true', async () => {
      // Arrange
      const mockStructure = {
        id: 'structure-operational',
        name: 'Functioning Forge',
        type: 'forge',
        level: 3,
        settlementId: 'settlement-456',
        variables: {
          operational: true,
          temperature: 'high',
        },
      };

      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(mockStructure);

      // Act
      const result = await service.buildContext('structure-operational');

      // Assert
      expect(result.operational).toBe(true);
    });

    it('should determine operational=false when explicit operational flag is false', async () => {
      // Arrange
      const mockStructure = {
        id: 'structure-broken',
        name: 'Broken Barracks',
        type: 'barracks',
        level: 2,
        settlementId: 'settlement-456',
        variables: {
          operational: false,
          damage: 'severe',
        },
      };

      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(mockStructure);

      // Act
      const result = await service.buildContext('structure-broken');

      // Assert
      expect(result.operational).toBe(false);
    });

    it('should determine operational=true when integrity >= 50', async () => {
      // Arrange
      const mockStructure = {
        id: 'structure-decent',
        name: 'Decent Market',
        type: 'market',
        level: 4,
        settlementId: 'settlement-456',
        variables: {
          integrity: 50,
          goods: 'plentiful',
        },
      };

      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(mockStructure);

      // Act
      const result = await service.buildContext('structure-decent');

      // Assert
      expect(result.operational).toBe(true);
    });

    it('should determine operational=false when integrity < 50', async () => {
      // Arrange
      const mockStructure = {
        id: 'structure-damaged',
        name: 'Damaged Library',
        type: 'library',
        level: 3,
        settlementId: 'settlement-456',
        variables: {
          integrity: 49,
          books: 'damaged',
        },
      };

      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(mockStructure);

      // Act
      const result = await service.buildContext('structure-damaged');

      // Assert
      expect(result.operational).toBe(false);
    });

    it('should prioritize explicit operational flag over integrity', async () => {
      // Arrange - operational=false takes precedence even with high integrity
      const mockStructure = {
        id: 'structure-closed',
        name: 'Closed Tavern',
        type: 'tavern',
        level: 2,
        settlementId: 'settlement-456',
        variables: {
          operational: false,
          integrity: 100,
          reason: 'quarantine',
        },
      };

      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(mockStructure);

      // Act
      const result = await service.buildContext('structure-closed');

      // Assert
      expect(result.operational).toBe(false);
    });

    it('should default to operational=true when no status indicators present', async () => {
      // Arrange
      const mockStructure = {
        id: 'structure-simple',
        name: 'Simple Shrine',
        type: 'temple',
        level: 1,
        settlementId: 'settlement-456',
        variables: {
          deity: 'nature',
        },
      };

      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(mockStructure);

      // Act
      const result = await service.buildContext('structure-simple');

      // Assert
      expect(result.operational).toBe(true);
    });

    it('should handle structure with null level gracefully', async () => {
      // Arrange
      const mockStructure = {
        id: 'structure-null-level',
        name: 'New Structure',
        type: 'market',
        level: null,
        settlementId: 'settlement-456',
        variables: {},
      };

      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(mockStructure);

      // Act
      const result = await service.buildContext('structure-null-level');

      // Assert
      expect(result.level).toBe(1); // Default to 1
    });

    it('should handle structure with null variables gracefully', async () => {
      // Arrange
      const mockStructure = {
        id: 'structure-null-vars',
        name: 'Varless Structure',
        type: 'barracks',
        level: 2,
        settlementId: 'settlement-456',
        variables: null,
      };

      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(mockStructure);

      // Act
      const result = await service.buildContext('structure-null-vars');

      // Assert
      expect(result.variables).toEqual({});
      expect(result.operational).toBe(true);
    });

    it('should handle structure with empty variables object', async () => {
      // Arrange
      const mockStructure = {
        id: 'structure-empty-vars',
        name: 'Empty Vars Structure',
        type: 'temple',
        level: 3,
        settlementId: 'settlement-456',
        variables: {},
      };

      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(mockStructure);

      // Act
      const result = await service.buildContext('structure-empty-vars');

      // Assert
      expect(result.variables).toEqual({});
      expect(result.operational).toBe(true);
    });

    it('should throw NotFoundException when structure does not exist', async () => {
      // Arrange
      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.buildContext('nonexistent-structure')).rejects.toThrow(
        new NotFoundException('Structure with ID nonexistent-structure not found')
      );
    });

    it('should throw NotFoundException when structure is soft-deleted', async () => {
      // Arrange
      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.buildContext('deleted-structure')).rejects.toThrow(NotFoundException);

      // Verify query included deletedAt: null filter
      expect(prisma.structure.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'deleted-structure',
          deletedAt: null,
        },
      });
    });

    it('should handle integrity value exactly at threshold (50)', async () => {
      // Arrange
      const mockStructure = {
        id: 'structure-threshold',
        name: 'Threshold Structure',
        type: 'forge',
        level: 3,
        settlementId: 'settlement-456',
        variables: {
          integrity: 50,
        },
      };

      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(mockStructure);

      // Act
      const result = await service.buildContext('structure-threshold');

      // Assert
      expect(result.operational).toBe(true);
    });

    it('should handle integrity value just below threshold (49)', async () => {
      // Arrange
      const mockStructure = {
        id: 'structure-below-threshold',
        name: 'Below Threshold Structure',
        type: 'library',
        level: 2,
        settlementId: 'settlement-456',
        variables: {
          integrity: 49,
        },
      };

      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(mockStructure);

      // Act
      const result = await service.buildContext('structure-below-threshold');

      // Assert
      expect(result.operational).toBe(false);
    });

    it('should handle integrity value of 0', async () => {
      // Arrange
      const mockStructure = {
        id: 'structure-destroyed',
        name: 'Destroyed Structure',
        type: 'barracks',
        level: 1,
        settlementId: 'settlement-456',
        variables: {
          integrity: 0,
          status: 'ruins',
        },
      };

      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(mockStructure);

      // Act
      const result = await service.buildContext('structure-destroyed');

      // Assert
      expect(result.operational).toBe(false);
    });

    it('should handle integrity value of 100', async () => {
      // Arrange
      const mockStructure = {
        id: 'structure-pristine',
        name: 'Pristine Structure',
        type: 'temple',
        level: 5,
        settlementId: 'settlement-456',
        variables: {
          integrity: 100,
          status: 'perfect',
        },
      };

      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(mockStructure);

      // Act
      const result = await service.buildContext('structure-pristine');

      // Assert
      expect(result.operational).toBe(true);
    });

    it('should ignore non-boolean operational values', async () => {
      // Arrange
      const mockStructure = {
        id: 'structure-invalid-operational',
        name: 'Invalid Operational Value',
        type: 'market',
        level: 3,
        settlementId: 'settlement-456',
        variables: {
          operational: 'yes', // Invalid value
          integrity: 75,
        },
      };

      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(mockStructure);

      // Act
      const result = await service.buildContext('structure-invalid-operational');

      // Assert
      // Should fall back to integrity check
      expect(result.operational).toBe(true);
    });

    it('should ignore non-numeric integrity values', async () => {
      // Arrange
      const mockStructure = {
        id: 'structure-invalid-integrity',
        name: 'Invalid Integrity Value',
        type: 'forge',
        level: 2,
        settlementId: 'settlement-456',
        variables: {
          integrity: 'good', // Invalid value
        },
      };

      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(mockStructure);

      // Act
      const result = await service.buildContext('structure-invalid-integrity');

      // Assert
      // Should default to operational=true
      expect(result.operational).toBe(true);
    });

    it('should preserve all custom typed variables in context', async () => {
      // Arrange
      const mockStructure = {
        id: 'structure-custom-vars',
        name: 'Complex Structure',
        type: 'library',
        level: 4,
        settlementId: 'settlement-456',
        variables: {
          books: 5000,
          scholars: 12,
          rareManuscripts: true,
          specialty: 'arcane',
          cataloging: {
            system: 'dewey',
            complete: false,
          },
        },
      };

      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(mockStructure);

      // Act
      const result = await service.buildContext('structure-custom-vars');

      // Assert
      expect(result.variables).toEqual({
        books: 5000,
        scholars: 12,
        rareManuscripts: true,
        specialty: 'arcane',
        cataloging: {
          system: 'dewey',
          complete: false,
        },
      });
    });
  });
});
