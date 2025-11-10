/**
 * @fileoverview Level History Service
 *
 * Service for tracking and querying historical level changes across all entity types
 * (parties, kingdoms, settlements, structures) using the audit system. Provides efficient
 * querying of level progression history with optimized batch queries to avoid N+1 problems.
 *
 * Key features:
 * - Extracts level changes from audit logs
 * - Supports multiple level fields (level, manualLevelOverride, averageLevel)
 * - Provides chronological and reverse-chronological ordering
 * - Campaign-wide level progression tracking
 * - Efficient batch queries for multiple entities
 *
 * @module services/level-history
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

/**
 * Represents a single level change event for an entity
 *
 * @interface LevelChangeRecord
 * @property {string} entityType - Type of entity (party, kingdom, settlement, structure)
 * @property {string} entityId - Unique identifier of the entity
 * @property {number | null} oldLevel - Previous level value (null for initial level)
 * @property {number} newLevel - New level value after the change
 * @property {string} changedBy - User ID who made the change
 * @property {Date} changedAt - Timestamp when the change occurred
 * @property {string} [reason] - Optional reason for the level change
 */
export interface LevelChangeRecord {
  entityType: 'party' | 'kingdom' | 'settlement' | 'structure';
  entityId: string;
  oldLevel: number | null;
  newLevel: number;
  changedBy: string; // User ID
  changedAt: Date;
  reason?: string;
}

/**
 * Supported entity types for level tracking
 *
 * @typedef {('party' | 'kingdom' | 'settlement' | 'structure')} EntityType
 */
export type EntityType = 'party' | 'kingdom' | 'settlement' | 'structure';

/**
 * Type definition for audit changes JSON
 * Represents the possible level-related fields in audit change records
 *
 * @interface AuditChanges
 * @property {number} [level] - Direct level value (parties, kingdoms)
 * @property {number | null} [manualLevelOverride] - Manual override level
 * @property {number} [averageLevel] - Computed average level
 */
type AuditChanges = {
  level?: number;
  manualLevelOverride?: number | null;
  averageLevel?: number;
  [key: string]: unknown;
};

/**
 * Type guard to validate audit changes structure
 *
 * @param {unknown} value - Value to check
 * @returns {value is AuditChanges} True if value is a valid AuditChanges object
 */
function isAuditChanges(value: unknown): value is AuditChanges {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Service for tracking and querying level history across all entity types
 *
 * This service leverages the existing audit system to track historical level changes
 * for parties, kingdoms, settlements, and structures. It provides efficient querying
 * by using optimized batch queries and in-memory processing to avoid N+1 problems.
 *
 * The service handles multiple level field names across different entity types:
 * - `level`: Direct level value (parties, kingdoms)
 * - `manualLevelOverride`: Manual override level
 * - `averageLevel`: Computed average level
 *
 * @class LevelHistoryService
 * @example
 * ```typescript
 * // Get level history for a specific party
 * const history = await levelHistoryService.getLevelHistory('party', 'party-123');
 *
 * // Get campaign-wide level history
 * const campaignHistory = await levelHistoryService.getCampaignLevelHistory('campaign-456');
 * ```
 */
@Injectable()
export class LevelHistoryService {
  /**
   * Creates an instance of LevelHistoryService
   *
   * @param {PrismaService} prisma - Prisma database service for querying audit logs
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves the complete level history for a specific entity
   *
   * Fetches all CREATE and UPDATE audit entries for the specified entity and extracts
   * level changes over time. The method processes audits chronologically to build a
   * complete timeline of level progression, then returns results in reverse chronological
   * order (most recent first).
   *
   * Performance optimization: Fetches all audits in a single query and processes in memory
   * to avoid N+1 query problems. The query includes user data for each change.
   *
   * @param {EntityType} entityType - Type of entity (party, kingdom, settlement, structure)
   * @param {string} entityId - Unique identifier of the entity
   * @returns {Promise<LevelChangeRecord[]>} Array of level change records, most recent first
   *
   * @example
   * ```typescript
   * const partyHistory = await getLevelHistory('party', 'party-123');
   * // Returns: [
   * //   { entityType: 'party', entityId: 'party-123', oldLevel: 4, newLevel: 5, ... },
   * //   { entityType: 'party', entityId: 'party-123', oldLevel: 3, newLevel: 4, ... },
   * //   { entityType: 'party', entityId: 'party-123', oldLevel: null, newLevel: 3, ... }
   * // ]
   * ```
   */
  async getLevelHistory(entityType: EntityType, entityId: string): Promise<LevelChangeRecord[]> {
    // Fetch all audit entries for this entity (CREATE and UPDATE operations)
    // We fetch all to build a complete timeline without N+1 queries
    const audits = await this.prisma.audit.findMany({
      where: {
        entityType,
        entityId,
        operation: { in: ['CREATE', 'UPDATE'] },
      },
      orderBy: {
        timestamp: 'asc', // Chronological order for processing
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

    // Build level history by iterating through sorted audits
    const levelChanges: LevelChangeRecord[] = [];
    let previousLevel: number | null = null;

    for (const audit of audits) {
      if (!isAuditChanges(audit.changes)) {
        continue;
      }

      const changes = audit.changes;
      let newLevel: number | null = null;

      // Extract level from changes (different entities store level differently)
      if (typeof changes.level === 'number') {
        newLevel = changes.level;
      } else if (typeof changes.manualLevelOverride === 'number') {
        newLevel = changes.manualLevelOverride;
      } else if (typeof changes.averageLevel === 'number') {
        newLevel = changes.averageLevel;
      }

      // Only record if we found a level value
      if (newLevel !== null) {
        levelChanges.push({
          entityType,
          entityId,
          oldLevel: previousLevel,
          newLevel,
          changedBy: audit.userId,
          changedAt: audit.timestamp,
        });

        previousLevel = newLevel;
      }
    }

    // Return in reverse chronological order (most recent first)
    return levelChanges.reverse();
  }

  /**
   * Retrieves level history for all entities across an entire campaign
   *
   * Fetches level change history for all parties, kingdoms, settlements, and structures
   * within a campaign. This method provides a comprehensive view of level progression
   * across all entity types, useful for campaign analytics and overview displays.
   *
   * The method uses highly optimized queries:
   * 1. Fetches all entity IDs in parallel (4 concurrent queries)
   * 2. Fetches all audit entries in a single batched query using OR conditions
   * 3. Groups audits by entity and processes in memory
   * 4. Returns combined results sorted by timestamp (most recent first)
   *
   * Performance characteristics:
   * - O(1) database queries regardless of entity count (5 total: 4 for IDs, 1 for audits)
   * - Memory efficient: processes audits in streaming fashion
   * - Handles large campaigns efficiently with proper indexing
   *
   * @param {string} campaignId - Unique identifier of the campaign
   * @returns {Promise<LevelChangeRecord[]>} Combined array of all level changes, most recent first
   *
   * @example
   * ```typescript
   * const campaignHistory = await getCampaignLevelHistory('campaign-456');
   * // Returns: [
   * //   { entityType: 'party', entityId: 'party-1', oldLevel: 5, newLevel: 6, ... },
   * //   { entityType: 'kingdom', entityId: 'kingdom-1', oldLevel: 3, newLevel: 4, ... },
   * //   { entityType: 'settlement', entityId: 'settlement-1', oldLevel: 2, newLevel: 3, ... },
   * //   // ... all level changes across all entities, sorted by timestamp
   * // ]
   * ```
   */
  async getCampaignLevelHistory(campaignId: string): Promise<LevelChangeRecord[]> {
    // Get all entity IDs for this campaign in parallel
    const [parties, kingdoms, settlements, structures] = await Promise.all([
      this.prisma.party.findMany({
        where: { campaignId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.kingdom.findMany({
        where: { campaignId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.settlement.findMany({
        where: { kingdom: { campaignId }, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.structure.findMany({
        where: { settlement: { kingdom: { campaignId } }, deletedAt: null },
        select: { id: true },
      }),
    ]);

    // Build list of all entity IDs with their types
    const entityQueries: Array<{ type: EntityType; id: string }> = [
      ...parties.map((p) => ({ type: 'party' as EntityType, id: p.id })),
      ...kingdoms.map((k) => ({ type: 'kingdom' as EntityType, id: k.id })),
      ...settlements.map((s) => ({ type: 'settlement' as EntityType, id: s.id })),
      ...structures.map((s) => ({ type: 'structure' as EntityType, id: s.id })),
    ];

    // Fetch all audits for all entities in a single query
    // This is much more efficient than querying each entity separately
    const allAudits = await this.prisma.audit.findMany({
      where: {
        OR: entityQueries.map((eq) => ({
          entityType: eq.type,
          entityId: eq.id,
        })),
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

    // Group audits by entity
    const auditsByEntity = new Map<string, typeof allAudits>();
    for (const audit of allAudits) {
      const key = `${audit.entityType}:${audit.entityId}`;
      if (!auditsByEntity.has(key)) {
        auditsByEntity.set(key, []);
      }
      auditsByEntity.get(key)!.push(audit);
    }

    // Process each entity's audits to build level history
    const allLevelChanges: LevelChangeRecord[] = [];

    for (const [key, entityAudits] of auditsByEntity.entries()) {
      const [entityType, entityId] = key.split(':') as [EntityType, string];
      let previousLevel: number | null = null;

      for (const audit of entityAudits) {
        if (!isAuditChanges(audit.changes)) {
          continue;
        }

        const changes = audit.changes;
        let newLevel: number | null = null;

        // Extract level from changes
        if (typeof changes.level === 'number') {
          newLevel = changes.level;
        } else if (typeof changes.manualLevelOverride === 'number') {
          newLevel = changes.manualLevelOverride;
        } else if (typeof changes.averageLevel === 'number') {
          newLevel = changes.averageLevel;
        }

        // Only record if we found a level value
        if (newLevel !== null) {
          allLevelChanges.push({
            entityType,
            entityId,
            oldLevel: previousLevel,
            newLevel,
            changedBy: audit.userId,
            changedAt: audit.timestamp,
          });

          previousLevel = newLevel;
        }
      }
    }

    // Sort by timestamp descending (most recent first)
    allLevelChanges.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());

    return allLevelChanges;
  }
}
