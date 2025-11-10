/**
 * @fileoverview Audit Service - Centralized audit logging for entity mutations
 *
 * Provides comprehensive audit trail functionality for tracking all entity changes
 * in the campaign management system. Captures who changed what, when, and why,
 * with support for automatic diff calculation, full state snapshots, and
 * user-provided reasoning.
 *
 * **Key Features:**
 * - Non-blocking audit logging (errors don't break main operations)
 * - Automatic diff calculation between previous and new states
 * - Full entity snapshots for point-in-time restoration
 * - Support for all mutation operations (CRUD + branching operations)
 * - User accountability tracking with optional reasoning
 * - Flexible metadata for additional context
 *
 * **Common Use Cases:**
 * - Entity change tracking (CREATE, UPDATE, DELETE)
 * - Branching operations audit trail (FORK, MERGE, CHERRY_PICK)
 * - User activity monitoring and accountability
 * - Debugging and troubleshooting entity mutations
 * - Compliance and security auditing
 * - Point-in-time state restoration
 *
 * @module services/audit
 * @see {@link calculateDiff} - Utility for automatic diff calculation
 * @see docs/features/audit-system.md - Complete audit system documentation
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { calculateDiff } from '../utils/version.utils';

/**
 * Audit operation types representing different entity mutation operations.
 *
 * Includes standard CRUD operations plus domain-specific operations for
 * archival management and branching system operations.
 *
 * **Operation Categories:**
 * - **CRUD**: CREATE, UPDATE, DELETE
 * - **Lifecycle**: ARCHIVE, RESTORE
 * - **Branching**: FORK, MERGE, CHERRY_PICK
 *
 * @example
 * ```typescript
 * // Standard CRUD operations
 * const op1: AuditOperation = 'CREATE';
 * const op2: AuditOperation = 'UPDATE';
 * const op3: AuditOperation = 'DELETE';
 *
 * // Lifecycle operations
 * const op4: AuditOperation = 'ARCHIVE';  // Soft delete
 * const op5: AuditOperation = 'RESTORE';  // Unarchive
 *
 * // Branching operations
 * const op6: AuditOperation = 'FORK';       // Create branch
 * const op7: AuditOperation = 'MERGE';      // Merge branches
 * const op8: AuditOperation = 'CHERRY_PICK'; // Apply specific change
 * ```
 */
export type AuditOperation =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ARCHIVE'
  | 'RESTORE'
  | 'FORK'
  | 'MERGE'
  | 'CHERRY_PICK';

/**
 * Centralized audit logging service for tracking entity mutations.
 *
 * Provides non-blocking audit trail functionality with comprehensive change tracking,
 * automatic diff calculation, and full state snapshots. All audit operations are
 * designed to be fire-and-forget, ensuring that audit failures never break main
 * business operations.
 *
 * **Architecture:**
 * - Non-blocking: Errors are caught and logged, never thrown
 * - State tracking: Captures full entity snapshots before and after changes
 * - Auto-diff: Automatically calculates structured diffs when states provided
 * - Flexible: Supports both legacy (changes only) and enhanced (full state) patterns
 *
 * **Integration Pattern:**
 * ```typescript
 * // In any service that mutates entities
 * constructor(private readonly auditService: AuditService) {}
 *
 * async updateEntity(id: string, data: UpdateInput, userId: string) {
 *   const previous = await this.findOne(id);
 *   const updated = await this.update(id, data);
 *
 *   // Fire-and-forget audit logging
 *   this.auditService.log(
 *     'EntityName', id, 'UPDATE', userId,
 *     data, {}, previous, updated, 'User-provided reason'
 *   );
 *
 *   return updated;
 * }
 * ```
 *
 * **Performance Considerations:**
 * - Audit writes are async and non-blocking
 * - Full state snapshots increase storage but enable powerful debugging
 * - Consider archiving/pruning old audit logs for long-running campaigns
 *
 * @see {@link log} - Main method for creating audit log entries
 * @see {@link AuditOperation} - Available operation types
 */
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
