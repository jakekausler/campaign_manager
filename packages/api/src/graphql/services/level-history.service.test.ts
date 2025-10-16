import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';

import { LevelHistoryService, EntityType } from './level-history.service';

describe('LevelHistoryService', () => {
  let service: LevelHistoryService;
  let prisma: jest.Mocked<PrismaService>;

  const mockUserId = 'user-1';
  const mockEntityId = 'entity-1';
  const mockCampaignId = 'campaign-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LevelHistoryService,
        {
          provide: PrismaService,
          useValue: {
            audit: {
              findMany: jest.fn(),
            },
            party: {
              findMany: jest.fn(),
            },
            kingdom: {
              findMany: jest.fn(),
            },
            settlement: {
              findMany: jest.fn(),
            },
            structure: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<LevelHistoryService>(LevelHistoryService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLevelHistory', () => {
    it('should return empty array when no audit entries found', async () => {
      (prisma.audit.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getLevelHistory('party', mockEntityId);

      expect(result).toEqual([]);
      expect(prisma.audit.findMany).toHaveBeenCalledWith({
        where: {
          entityType: 'party',
          entityId: mockEntityId,
          operation: { in: ['CREATE', 'UPDATE'] },
        },
        orderBy: {
          timestamp: 'asc',
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });
    });

    it('should build level history from chronological audits', async () => {
      const mockAudits = [
        {
          id: 'audit-1',
          entityType: 'kingdom',
          entityId: mockEntityId,
          operation: 'CREATE',
          userId: mockUserId,
          changes: { level: 1 },
          timestamp: new Date('2025-01-10T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
        {
          id: 'audit-2',
          entityType: 'kingdom',
          entityId: mockEntityId,
          operation: 'UPDATE',
          userId: mockUserId,
          changes: { level: 3 },
          timestamp: new Date('2025-01-15T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
        {
          id: 'audit-3',
          entityType: 'kingdom',
          entityId: mockEntityId,
          operation: 'UPDATE',
          userId: mockUserId,
          changes: { level: 5 },
          timestamp: new Date('2025-01-20T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
      ];

      (prisma.audit.findMany as jest.Mock).mockResolvedValue(mockAudits);

      const result = await service.getLevelHistory('kingdom', mockEntityId);

      expect(result).toHaveLength(3);
      // Most recent first (reverse chronological)
      expect(result[0]).toMatchObject({
        entityType: 'kingdom',
        entityId: mockEntityId,
        oldLevel: 3,
        newLevel: 5,
        changedBy: mockUserId,
      });
      expect(result[1]).toMatchObject({
        entityType: 'kingdom',
        entityId: mockEntityId,
        oldLevel: 1,
        newLevel: 3,
        changedBy: mockUserId,
      });
      expect(result[2]).toMatchObject({
        entityType: 'kingdom',
        entityId: mockEntityId,
        oldLevel: null, // First change has no previous level
        newLevel: 1,
        changedBy: mockUserId,
      });
    });

    it('should handle party manualLevelOverride changes', async () => {
      const mockAudits = [
        {
          id: 'audit-1',
          entityType: 'party',
          entityId: mockEntityId,
          operation: 'CREATE',
          userId: mockUserId,
          changes: { averageLevel: 5 },
          timestamp: new Date('2025-01-10T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
        {
          id: 'audit-2',
          entityType: 'party',
          entityId: mockEntityId,
          operation: 'UPDATE',
          userId: mockUserId,
          changes: { manualLevelOverride: 10 },
          timestamp: new Date('2025-01-15T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
      ];

      (prisma.audit.findMany as jest.Mock).mockResolvedValue(mockAudits);

      const result = await service.getLevelHistory('party', mockEntityId);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        entityType: 'party',
        entityId: mockEntityId,
        oldLevel: 5, // Previous was averageLevel
        newLevel: 10,
        changedBy: mockUserId,
      });
      expect(result[1]).toMatchObject({
        entityType: 'party',
        entityId: mockEntityId,
        oldLevel: null,
        newLevel: 5,
        changedBy: mockUserId,
      });
    });

    it('should skip audit entries without level changes', async () => {
      const mockAudits = [
        {
          id: 'audit-1',
          entityType: 'kingdom',
          entityId: mockEntityId,
          operation: 'CREATE',
          userId: mockUserId,
          changes: { level: 1, name: 'Test Kingdom' },
          timestamp: new Date('2025-01-10T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
        {
          id: 'audit-2',
          entityType: 'kingdom',
          entityId: mockEntityId,
          operation: 'UPDATE',
          userId: mockUserId,
          changes: { name: 'New Kingdom Name' }, // Not a level change
          timestamp: new Date('2025-01-12T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
        {
          id: 'audit-3',
          entityType: 'kingdom',
          entityId: mockEntityId,
          operation: 'UPDATE',
          userId: mockUserId,
          changes: { level: 5 },
          timestamp: new Date('2025-01-15T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
      ];

      (prisma.audit.findMany as jest.Mock).mockResolvedValue(mockAudits);

      const result = await service.getLevelHistory('kingdom', mockEntityId);

      expect(result).toHaveLength(2);
      expect(result[0].newLevel).toBe(5);
      expect(result[1].newLevel).toBe(1);
    });

    it('should handle null oldLevel for first level change', async () => {
      const mockAudits = [
        {
          id: 'audit-1',
          entityType: 'settlement',
          entityId: mockEntityId,
          operation: 'UPDATE',
          userId: mockUserId,
          changes: { level: 5 },
          timestamp: new Date('2025-01-15T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
      ];

      (prisma.audit.findMany as jest.Mock).mockResolvedValue(mockAudits);

      const result = await service.getLevelHistory('settlement', mockEntityId);

      expect(result).toHaveLength(1);
      expect(result[0].oldLevel).toBeNull();
      expect(result[0].newLevel).toBe(5);
    });
  });

  describe('getCampaignLevelHistory', () => {
    it('should return empty array when campaign has no entities', async () => {
      (prisma.party.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.kingdom.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.settlement.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.structure.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.audit.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getCampaignLevelHistory(mockCampaignId);

      expect(result).toEqual([]);
    });

    it('should aggregate level history from all entity types in single query', async () => {
      // Mock entities
      (prisma.party.findMany as jest.Mock).mockResolvedValue([{ id: 'party-1' }]);
      (prisma.kingdom.findMany as jest.Mock).mockResolvedValue([{ id: 'kingdom-1' }]);
      (prisma.settlement.findMany as jest.Mock).mockResolvedValue([{ id: 'settlement-1' }]);
      (prisma.structure.findMany as jest.Mock).mockResolvedValue([{ id: 'structure-1' }]);

      // Mock single audit query with all entities' data
      (prisma.audit.findMany as jest.Mock).mockResolvedValue([
        {
          entityType: 'party',
          entityId: 'party-1',
          operation: 'UPDATE',
          userId: mockUserId,
          changes: { manualLevelOverride: 10 },
          timestamp: new Date('2025-01-15T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
        {
          entityType: 'kingdom',
          entityId: 'kingdom-1',
          operation: 'UPDATE',
          userId: mockUserId,
          changes: { level: 5 },
          timestamp: new Date('2025-01-14T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
        {
          entityType: 'settlement',
          entityId: 'settlement-1',
          operation: 'UPDATE',
          userId: mockUserId,
          changes: { level: 3 },
          timestamp: new Date('2025-01-13T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
        {
          entityType: 'structure',
          entityId: 'structure-1',
          operation: 'UPDATE',
          userId: mockUserId,
          changes: { level: 2 },
          timestamp: new Date('2025-01-12T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
      ]);

      const result = await service.getCampaignLevelHistory(mockCampaignId);

      expect(result).toHaveLength(4);
      // Should be sorted by timestamp descending (most recent first)
      expect(result[0].entityType).toBe('party');
      expect(result[0].newLevel).toBe(10);
      expect(result[1].entityType).toBe('kingdom');
      expect(result[1].newLevel).toBe(5);
      expect(result[2].entityType).toBe('settlement');
      expect(result[2].newLevel).toBe(3);
      expect(result[3].entityType).toBe('structure');
      expect(result[3].newLevel).toBe(2);

      // Verify single audit query was made
      expect(prisma.audit.findMany).toHaveBeenCalledTimes(1);
    });

    it('should correctly track oldLevel across multiple changes per entity', async () => {
      (prisma.party.findMany as jest.Mock).mockResolvedValue([{ id: 'party-1' }]);
      (prisma.kingdom.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.settlement.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.structure.findMany as jest.Mock).mockResolvedValue([]);

      // Multiple changes for same entity
      (prisma.audit.findMany as jest.Mock).mockResolvedValue([
        {
          entityType: 'party',
          entityId: 'party-1',
          operation: 'CREATE',
          userId: mockUserId,
          changes: { averageLevel: 5 },
          timestamp: new Date('2025-01-10T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
        {
          entityType: 'party',
          entityId: 'party-1',
          operation: 'UPDATE',
          userId: mockUserId,
          changes: { averageLevel: 7 },
          timestamp: new Date('2025-01-15T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
        {
          entityType: 'party',
          entityId: 'party-1',
          operation: 'UPDATE',
          userId: mockUserId,
          changes: { manualLevelOverride: 10 },
          timestamp: new Date('2025-01-20T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
      ]);

      const result = await service.getCampaignLevelHistory(mockCampaignId);

      expect(result).toHaveLength(3);
      // Most recent first
      expect(result[0]).toMatchObject({
        entityId: 'party-1',
        oldLevel: 7,
        newLevel: 10,
      });
      expect(result[1]).toMatchObject({
        entityId: 'party-1',
        oldLevel: 5,
        newLevel: 7,
      });
      expect(result[2]).toMatchObject({
        entityId: 'party-1',
        oldLevel: null,
        newLevel: 5,
      });
    });

    it('should correctly sort campaign level history by timestamp', async () => {
      (prisma.party.findMany as jest.Mock).mockResolvedValue([
        { id: 'party-1' },
        { id: 'party-2' },
      ]);
      (prisma.kingdom.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.settlement.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.structure.findMany as jest.Mock).mockResolvedValue([]);

      (prisma.audit.findMany as jest.Mock).mockResolvedValue([
        {
          entityType: 'party',
          entityId: 'party-1',
          operation: 'UPDATE',
          userId: mockUserId,
          changes: { manualLevelOverride: 5 },
          timestamp: new Date('2025-01-10T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
        {
          entityType: 'party',
          entityId: 'party-2',
          operation: 'UPDATE',
          userId: mockUserId,
          changes: { manualLevelOverride: 8 },
          timestamp: new Date('2025-01-20T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
      ]);

      const result = await service.getCampaignLevelHistory(mockCampaignId);

      expect(result).toHaveLength(2);
      // party-2 should be first (more recent timestamp)
      expect(result[0].entityId).toBe('party-2');
      expect(result[0].newLevel).toBe(8);
      expect(result[1].entityId).toBe('party-1');
      expect(result[1].newLevel).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('should handle malformed audit changes gracefully', async () => {
      const mockAudits = [
        {
          id: 'audit-1',
          entityType: 'kingdom',
          entityId: mockEntityId,
          operation: 'UPDATE',
          userId: mockUserId,
          changes: null, // Malformed
          timestamp: new Date('2025-01-15T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
        {
          id: 'audit-2',
          entityType: 'kingdom',
          entityId: mockEntityId,
          operation: 'UPDATE',
          userId: mockUserId,
          changes: 'invalid', // Not an object
          timestamp: new Date('2025-01-16T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
      ];

      (prisma.audit.findMany as jest.Mock).mockResolvedValue(mockAudits);

      const result = await service.getLevelHistory('kingdom', mockEntityId);

      expect(result).toEqual([]);
    });

    it('should handle empty changes object', async () => {
      const mockAudits = [
        {
          id: 'audit-1',
          entityType: 'structure',
          entityId: mockEntityId,
          operation: 'UPDATE',
          userId: mockUserId,
          changes: {}, // Empty changes
          timestamp: new Date('2025-01-15T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
      ];

      (prisma.audit.findMany as jest.Mock).mockResolvedValue(mockAudits);

      const result = await service.getLevelHistory('structure', mockEntityId);

      expect(result).toEqual([]);
    });

    it('should work with all entity types', async () => {
      const entityTypes: EntityType[] = ['party', 'kingdom', 'settlement', 'structure'];

      for (const entityType of entityTypes) {
        (prisma.audit.findMany as jest.Mock).mockResolvedValue([]);

        const result = await service.getLevelHistory(entityType, mockEntityId);

        expect(result).toEqual([]);
        expect(prisma.audit.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              entityType,
            }),
          })
        );
      }
    });

    it('should handle array changes gracefully', async () => {
      const mockAudits = [
        {
          id: 'audit-1',
          entityType: 'kingdom',
          entityId: mockEntityId,
          operation: 'UPDATE',
          userId: mockUserId,
          changes: ['invalid', 'array'], // Array instead of object
          timestamp: new Date('2025-01-15T10:00:00Z'),
          user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
        },
      ];

      (prisma.audit.findMany as jest.Mock).mockResolvedValue(mockAudits);

      const result = await service.getLevelHistory('kingdom', mockEntityId);

      expect(result).toEqual([]);
    });
  });
});
