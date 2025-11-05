/**
 * Audit Service Tests
 */

import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';

import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: {
            audit: {
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should create an audit entry for CREATE operation', async () => {
      const mockAudit = {
        id: 'audit-1',
        entityType: 'campaign',
        entityId: 'campaign-1',
        operation: 'CREATE',
        userId: 'user-1',
        changes: { name: 'Test Campaign' },
        metadata: {},
        timestamp: new Date(),
      };

      (prisma.audit.create as jest.Mock).mockResolvedValue(mockAudit);

      await service.log('campaign', 'campaign-1', 'CREATE', 'user-1', {
        name: 'Test Campaign',
      });

      expect(prisma.audit.create).toHaveBeenCalledWith({
        data: {
          entityType: 'campaign',
          entityId: 'campaign-1',
          operation: 'CREATE',
          userId: 'user-1',
          changes: { name: 'Test Campaign' },
          metadata: {},
        },
      });
    });

    it('should create an audit entry for UPDATE operation', async () => {
      const mockAudit = {
        id: 'audit-2',
        entityType: 'campaign',
        entityId: 'campaign-1',
        operation: 'UPDATE',
        userId: 'user-1',
        changes: { name: { from: 'Old Name', to: 'New Name' } },
        metadata: {},
        timestamp: new Date(),
      };

      (prisma.audit.create as jest.Mock).mockResolvedValue(mockAudit);

      await service.log('campaign', 'campaign-1', 'UPDATE', 'user-1', {
        name: { from: 'Old Name', to: 'New Name' },
      });

      expect(prisma.audit.create).toHaveBeenCalledWith({
        data: {
          entityType: 'campaign',
          entityId: 'campaign-1',
          operation: 'UPDATE',
          userId: 'user-1',
          changes: { name: { from: 'Old Name', to: 'New Name' } },
          metadata: {},
        },
      });
    });

    it('should create an audit entry for DELETE operation', async () => {
      const mockAudit = {
        id: 'audit-3',
        entityType: 'campaign',
        entityId: 'campaign-1',
        operation: 'DELETE',
        userId: 'user-1',
        changes: { deletedAt: new Date() },
        metadata: {},
        timestamp: new Date(),
      };

      (prisma.audit.create as jest.Mock).mockResolvedValue(mockAudit);

      await service.log('campaign', 'campaign-1', 'DELETE', 'user-1', {
        deletedAt: expect.any(Date),
      });

      expect(prisma.audit.create).toHaveBeenCalledWith({
        data: {
          entityType: 'campaign',
          entityId: 'campaign-1',
          operation: 'DELETE',
          userId: 'user-1',
          changes: { deletedAt: expect.any(Date) },
          metadata: {},
        },
      });
    });

    it('should create an audit entry for ARCHIVE operation', async () => {
      const mockAudit = {
        id: 'audit-4',
        entityType: 'campaign',
        entityId: 'campaign-1',
        operation: 'ARCHIVE',
        userId: 'user-1',
        changes: { archivedAt: new Date() },
        metadata: {},
        timestamp: new Date(),
      };

      (prisma.audit.create as jest.Mock).mockResolvedValue(mockAudit);

      await service.log('campaign', 'campaign-1', 'ARCHIVE', 'user-1', {
        archivedAt: expect.any(Date),
      });

      expect(prisma.audit.create).toHaveBeenCalledWith({
        data: {
          entityType: 'campaign',
          entityId: 'campaign-1',
          operation: 'ARCHIVE',
          userId: 'user-1',
          changes: { archivedAt: expect.any(Date) },
          metadata: {},
        },
      });
    });

    it('should create an audit entry for RESTORE operation', async () => {
      const mockAudit = {
        id: 'audit-5',
        entityType: 'campaign',
        entityId: 'campaign-1',
        operation: 'RESTORE',
        userId: 'user-1',
        changes: { archivedAt: null },
        metadata: {},
        timestamp: new Date(),
      };

      (prisma.audit.create as jest.Mock).mockResolvedValue(mockAudit);

      await service.log('campaign', 'campaign-1', 'RESTORE', 'user-1', {
        archivedAt: null,
      });

      expect(prisma.audit.create).toHaveBeenCalledWith({
        data: {
          entityType: 'campaign',
          entityId: 'campaign-1',
          operation: 'RESTORE',
          userId: 'user-1',
          changes: { archivedAt: null },
          metadata: {},
        },
      });
    });

    it('should include optional metadata in audit entry', async () => {
      const mockAudit = {
        id: 'audit-6',
        entityType: 'campaign',
        entityId: 'campaign-1',
        operation: 'CREATE',
        userId: 'user-1',
        changes: { name: 'Test Campaign' },
        metadata: { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
        timestamp: new Date(),
      };

      (prisma.audit.create as jest.Mock).mockResolvedValue(mockAudit);

      await service.log(
        'campaign',
        'campaign-1',
        'CREATE',
        'user-1',
        { name: 'Test Campaign' },
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );

      expect(prisma.audit.create).toHaveBeenCalledWith({
        data: {
          entityType: 'campaign',
          entityId: 'campaign-1',
          operation: 'CREATE',
          userId: 'user-1',
          changes: { name: 'Test Campaign' },
          metadata: { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
        },
      });
    });
  });

  describe('Enhanced Audit Fields', () => {
    it('should create audit with previousState and newState', async () => {
      const previousState = { name: 'Old Name', level: 1, population: 100 };
      const newState = { name: 'New Name', level: 2, population: 150 };

      const mockAudit = {
        id: 'audit-7',
        entityType: 'settlement',
        entityId: 'settlement-1',
        operation: 'UPDATE',
        userId: 'user-1',
        changes: {},
        metadata: {},
        previousState,
        newState,
        diff: {
          name: { from: 'Old Name', to: 'New Name' },
          level: { from: 1, to: 2 },
          population: { from: 100, to: 150 },
        },
        timestamp: new Date(),
      };

      (prisma.audit.create as jest.Mock).mockResolvedValue(mockAudit);

      await service.log(
        'settlement',
        'settlement-1',
        'UPDATE',
        'user-1',
        {},
        {},
        previousState,
        newState
      );

      // Verify the call includes previousState, newState, and auto-calculated diff
      const callArgs = (prisma.audit.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.data.previousState).toEqual(previousState);
      expect(callArgs.data.newState).toEqual(newState);
      expect(callArgs.data.diff).toBeDefined();
      // Diff should be a plain object (calculateDiff returns structured diff)
      expect(typeof callArgs.data.diff).toBe('object');
    });

    it('should auto-calculate diff when both states are provided', async () => {
      const previousState = { name: 'Castle', defenseRating: 5 };
      const newState = { name: 'Castle', defenseRating: 7 };

      const mockAudit = {
        id: 'audit-8',
        entityType: 'structure',
        entityId: 'structure-1',
        operation: 'UPDATE',
        userId: 'user-1',
        changes: {},
        metadata: {},
        previousState,
        newState,
        diff: {
          added: {},
          modified: { defenseRating: { old: 5, new: 7 } },
          removed: {},
        },
        timestamp: new Date(),
      };

      (prisma.audit.create as jest.Mock).mockResolvedValue(mockAudit);

      await service.log(
        'structure',
        'structure-1',
        'UPDATE',
        'user-1',
        {},
        {},
        previousState,
        newState
      );

      const callArgs = (prisma.audit.create as jest.Mock).mock.calls[0][0];
      // Verify diff was calculated with correct VersionDiff format
      expect(callArgs.data.diff).toBeDefined();
      expect(callArgs.data.diff).toEqual(
        expect.objectContaining({
          added: {},
          modified: expect.objectContaining({
            defenseRating: expect.objectContaining({
              old: 5,
              new: 7,
            }),
          }),
          removed: {},
        })
      );
    });

    it('should create audit with reason field', async () => {
      const mockAudit = {
        id: 'audit-9',
        entityType: 'campaign',
        entityId: 'campaign-1',
        operation: 'UPDATE',
        userId: 'user-1',
        changes: { status: 'archived' },
        metadata: {},
        reason: 'Campaign completed successfully',
        timestamp: new Date(),
      };

      (prisma.audit.create as jest.Mock).mockResolvedValue(mockAudit);

      await service.log(
        'campaign',
        'campaign-1',
        'UPDATE',
        'user-1',
        { status: 'archived' },
        {},
        undefined,
        undefined,
        'Campaign completed successfully'
      );

      expect(prisma.audit.create).toHaveBeenCalledWith({
        data: {
          entityType: 'campaign',
          entityId: 'campaign-1',
          operation: 'UPDATE',
          userId: 'user-1',
          changes: { status: 'archived' },
          metadata: {},
          reason: 'Campaign completed successfully',
        },
      });
    });

    it('should maintain backward compatibility with existing calls', async () => {
      const mockAudit = {
        id: 'audit-10',
        entityType: 'settlement',
        entityId: 'settlement-1',
        operation: 'CREATE',
        userId: 'user-1',
        changes: { name: 'New Settlement' },
        metadata: {},
        timestamp: new Date(),
      };

      (prisma.audit.create as jest.Mock).mockResolvedValue(mockAudit);

      // Old call pattern without new optional parameters
      await service.log('settlement', 'settlement-1', 'CREATE', 'user-1', {
        name: 'New Settlement',
      });

      // Should not include enhanced fields when not provided
      expect(prisma.audit.create).toHaveBeenCalledWith({
        data: {
          entityType: 'settlement',
          entityId: 'settlement-1',
          operation: 'CREATE',
          userId: 'user-1',
          changes: { name: 'New Settlement' },
          metadata: {},
          // previousState, newState, diff, reason should be undefined
        },
      });
    });

    it('should handle CREATE operation with newState but no previousState', async () => {
      const newState = { name: 'New Character', level: 1, class: 'Warrior' };

      const mockAudit = {
        id: 'audit-11',
        entityType: 'character',
        entityId: 'character-1',
        operation: 'CREATE',
        userId: 'user-1',
        changes: {},
        metadata: {},
        newState,
        timestamp: new Date(),
      };

      (prisma.audit.create as jest.Mock).mockResolvedValue(mockAudit);

      await service.log(
        'character',
        'character-1',
        'CREATE',
        'user-1',
        {},
        {},
        undefined, // No previousState for CREATE
        newState
      );

      const callArgs = (prisma.audit.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.data.newState).toEqual(newState);
      expect(callArgs.data.previousState).toBeUndefined();
      // Diff should not be calculated when only one state provided
      expect(callArgs.data.diff).toBeUndefined();
    });

    it('should handle DELETE operation with previousState but no newState', async () => {
      const previousState = { name: 'Deleted Event', status: 'active' };

      const mockAudit = {
        id: 'audit-12',
        entityType: 'event',
        entityId: 'event-1',
        operation: 'DELETE',
        userId: 'user-1',
        changes: {},
        metadata: {},
        previousState,
        timestamp: new Date(),
      };

      (prisma.audit.create as jest.Mock).mockResolvedValue(mockAudit);

      await service.log(
        'event',
        'event-1',
        'DELETE',
        'user-1',
        {},
        {},
        previousState,
        undefined // No newState for DELETE
      );

      const callArgs = (prisma.audit.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.data.previousState).toEqual(previousState);
      expect(callArgs.data.newState).toBeUndefined();
      // Diff should not be calculated when only one state provided
      expect(callArgs.data.diff).toBeUndefined();
    });

    it('should handle all enhanced fields together', async () => {
      const previousState = {
        name: 'Test Branch',
        status: 'active',
        version: 1,
      };
      const newState = { name: 'Test Branch', status: 'merged', version: 2 };
      const reason = 'Merging feature branch after successful testing';

      const mockAudit = {
        id: 'audit-13',
        entityType: 'branch',
        entityId: 'branch-1',
        operation: 'MERGE',
        userId: 'user-1',
        changes: {},
        metadata: { targetBranch: 'main' },
        previousState,
        newState,
        diff: {
          status: { from: 'active', to: 'merged' },
          version: { from: 1, to: 2 },
        },
        reason,
        timestamp: new Date(),
      };

      (prisma.audit.create as jest.Mock).mockResolvedValue(mockAudit);

      await service.log(
        'branch',
        'branch-1',
        'MERGE',
        'user-1',
        {},
        { targetBranch: 'main' },
        previousState,
        newState,
        reason
      );

      const callArgs = (prisma.audit.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.data.previousState).toEqual(previousState);
      expect(callArgs.data.newState).toEqual(newState);
      expect(callArgs.data.diff).toBeDefined();
      expect(callArgs.data.reason).toBe(reason);
      expect(callArgs.data.metadata).toEqual({ targetBranch: 'main' });
    });

    it('should handle null values correctly in state fields', async () => {
      const previousState = { name: 'Test', archivedAt: null };
      const newState = { name: 'Test', archivedAt: new Date() };

      const mockAudit = {
        id: 'audit-14',
        entityType: 'campaign',
        entityId: 'campaign-1',
        operation: 'ARCHIVE',
        userId: 'user-1',
        changes: {},
        metadata: {},
        previousState,
        newState,
        diff: { archivedAt: { from: null, to: expect.any(Date) } },
        timestamp: new Date(),
      };

      (prisma.audit.create as jest.Mock).mockResolvedValue(mockAudit);

      await service.log(
        'campaign',
        'campaign-1',
        'ARCHIVE',
        'user-1',
        {},
        {},
        previousState,
        newState
      );

      const callArgs = (prisma.audit.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.data.previousState).toEqual(previousState);
      expect(callArgs.data.newState).toEqual(
        expect.objectContaining({
          name: 'Test',
          archivedAt: expect.any(Date),
        })
      );
      expect(callArgs.data.diff).toBeDefined();
    });
  });
});
