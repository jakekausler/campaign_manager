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
   * Logs an audit event for entity changes with state tracking and automatic diff calculation.
   *
   * Creates a comprehensive audit log entry that tracks who changed what, when, and why.
   * When both previousState and newState are provided, automatically calculates a structured
   * diff using the VersionDiff format (added/modified/removed fields).
   *
   * **Enhanced Audit Fields (TICKET-032):**
   * - `previousState`: Full entity snapshot before mutation (enables rollback, debugging)
   * - `newState`: Full entity snapshot after mutation (enables verification, comparison)
   * - `diff`: Auto-calculated structured diff in VersionDiff format
   * - `reason`: User-provided explanation for the change
   *
   * **Non-Blocking Pattern:**
   * This method catches and logs errors internally to prevent audit failures from breaking
   * main operations. Errors are logged automatically, so you can use a simple fire-and-forget:
   * ```typescript
   * // Simplest pattern (errors logged automatically)
   * this.auditService.log(...);
   *
   * // Or with optional custom error handling
   * this.auditService.log(...).catch(err => this.logger.error('Custom audit error handling', err));
   * ```
   *
   * @param entityType - The type of entity being audited (e.g., 'Settlement', 'Structure', 'Event')
   * @param entityId - The unique identifier of the entity instance
   * @param operation - The type of operation performed (CREATE, UPDATE, DELETE, ARCHIVE, RESTORE, FORK, MERGE, CHERRY_PICK)
   * @param userId - The ID of the user performing the operation (for accountability)
   * @param changes - Legacy change data for backward compatibility (gradually being phased out)
   * @param metadata - Optional additional context (e.g., { source: 'graphql', ip: '1.2.3.4' }), default: {}
   * @param previousState - **[Optional]** Full entity state before the operation (for UPDATE/DELETE operations)
   * @param newState - **[Optional]** Full entity state after the operation (for CREATE/UPDATE operations)
   * @param reason - **[Optional]** User-provided explanation for why the change was made (max 500 chars)
   *
   * @returns Promise<void> - Always resolves; errors are caught and logged internally to prevent blocking mutations
   *
   * @example Basic Usage (Legacy Format)
   * ```typescript
   * await auditService.log('Settlement', id, 'UPDATE', userId, { name: 'New Name' });
   * ```
   *
   * @example Enhanced Usage with State Tracking
   * ```typescript
   * const previousSettlement = await prisma.settlement.findUnique({ where: { id } });
   * const updatedSettlement = await prisma.settlement.update({ where: { id }, data });
   *
   * // Fire-and-forget to avoid blocking mutation
   * this.auditService.log(
   *   'Settlement',
   *   id,
   *   'UPDATE',
   *   userId,
   *   data,                    // Legacy changes field
   *   { source: 'graphql' },   // Optional metadata
   *   previousSettlement,      // Full state before (for diff)
   *   updatedSettlement,       // Full state after (for diff)
   *   'Updated settlement name after player vote' // Reason
   * ).catch(err => {
   *   this.logger.error('Audit log failed', err);
   * });
   * ```
   *
   * @example CREATE Operation
   * ```typescript
   * // No previousState for CREATE
   * await auditService.log(
   *   'Settlement', newSettlement.id, 'CREATE', userId,
   *   createData, {},
   *   undefined,       // No previousState
   *   newSettlement,   // newState only
   *   'Created new settlement for quest reward'
   * );
   * ```
   *
   * @example DELETE Operation
   * ```typescript
   * // No newState for DELETE
   * await auditService.log(
   *   'Settlement', id, 'DELETE', userId,
   *   {}, {},
   *   deletedSettlement,  // previousState only
   *   undefined,          // No newState
   *   'Deleted settlement due to cataclysm event'
   * );
   * ```
   *
   * @see {@link calculateDiff} - Utility used for automatic diff calculation
   * @see docs/features/audit-system.md - Complete audit system documentation
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
