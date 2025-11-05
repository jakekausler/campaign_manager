/**
 * Audit Service
 * Centralized service for logging all entity mutations
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { calculateDiff } from '../utils/version.utils';

export type AuditOperation =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ARCHIVE'
  | 'RESTORE'
  | 'FORK'
  | 'MERGE'
  | 'CHERRY_PICK';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an audit entry for an entity mutation
   *
   * @param entityType - The type of entity (e.g., 'campaign', 'world', 'event')
   * @param entityId - The ID of the entity
   * @param operation - The operation performed (CREATE, UPDATE, DELETE, ARCHIVE, RESTORE, FORK, MERGE, CHERRY_PICK)
   * @param userId - The ID of the user who performed the operation
   * @param changes - The changes made (for CREATE: new values, for UPDATE: diff, for DELETE/ARCHIVE: timestamp)
   * @param metadata - Optional metadata (IP address, user agent, etc.)
   * @param previousState - Optional full entity state before the operation
   * @param newState - Optional full entity state after the operation
   * @param reason - Optional user-provided explanation for the operation
   */
  async log(
    entityType: string,
    entityId: string,
    operation: AuditOperation,
    userId: string,
    changes: Record<string, unknown>,
    metadata: Record<string, unknown> = {},
    previousState?: Record<string, unknown>,
    newState?: Record<string, unknown>,
    reason?: string
  ): Promise<void> {
    try {
      // Calculate diff automatically if both states are provided
      let diff: Prisma.InputJsonValue | undefined;
      if (previousState && newState) {
        const calculated = calculateDiff(previousState, newState);
        // Convert VersionDiff to InputJsonValue via JSON serialization
        diff = JSON.parse(JSON.stringify(calculated)) as Prisma.InputJsonValue;
      }

      await this.prisma.audit.create({
        data: {
          entityType,
          entityId,
          operation,
          userId,
          changes: changes as Prisma.InputJsonValue,
          metadata: metadata as Prisma.InputJsonValue,
          // Enhanced audit fields (nullable for backward compatibility)
          previousState: previousState ? (previousState as Prisma.InputJsonValue) : undefined,
          newState: newState ? (newState as Prisma.InputJsonValue) : undefined,
          diff: diff || undefined,
          reason: reason || undefined,
        },
      });
    } catch (error) {
      // Log audit failure but don't throw to prevent breaking main operations
      this.logger.error('Audit log failed', {
        entityType,
        entityId,
        operation,
        hasEnhancedData: !!(previousState || newState || reason),
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }
}
