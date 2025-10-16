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
});
