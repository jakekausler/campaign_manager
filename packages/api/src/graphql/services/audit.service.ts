/**
 * Audit Service
 * Centralized service for logging all entity mutations
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

export type AuditOperation = 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'RESTORE';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an audit entry for an entity mutation
   *
   * @param entityType - The type of entity (e.g., 'campaign', 'world', 'event')
   * @param entityId - The ID of the entity
   * @param operation - The operation performed (CREATE, UPDATE, DELETE, ARCHIVE, RESTORE)
   * @param userId - The ID of the user who performed the operation
   * @param changes - The changes made (for CREATE: new values, for UPDATE: diff, for DELETE/ARCHIVE: timestamp)
   * @param metadata - Optional metadata (IP address, user agent, etc.)
   */
  async log(
    entityType: string,
    entityId: string,
    operation: AuditOperation,
    userId: string,
    changes: Record<string, unknown>,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      await this.prisma.audit.create({
        data: {
          entityType,
          entityId,
          operation,
          userId,
          changes: changes as Prisma.InputJsonValue,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      // Log audit failure but don't throw to prevent breaking main operations
      console.error('Audit log failed:', {
        entityType,
        entityId,
        operation,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // In production, this should go to a monitoring system
    }
  }
}
