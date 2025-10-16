import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

export interface LevelChangeRecord {
  entityType: 'party' | 'kingdom' | 'settlement' | 'structure';
  entityId: string;
  oldLevel: number | null;
  newLevel: number;
  changedBy: string; // User ID
  changedAt: Date;
  reason?: string;
}

export type EntityType = 'party' | 'kingdom' | 'settlement' | 'structure';

/**
 * Type definition for audit changes JSON
 */
type AuditChanges = {
  level?: number;
  manualLevelOverride?: number | null;
  averageLevel?: number;
  [key: string]: unknown;
};

/**
 * Type guard to validate audit changes structure
 */
function isAuditChanges(value: unknown): value is AuditChanges {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Service for tracking and querying level history across all entity types.
 * Uses the existing Audit system to store level change records.
 */
@Injectable()
export class LevelHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get level history for a specific entity
   * Returns chronological list of level changes from audit logs
   *
   * Performance: Fetches all audits in a single query and processes in memory
   * to avoid N+1 query problems.
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
   * Get level history for all entities in a campaign
   * Useful for campaign-wide level progression tracking
   *
   * Performance: Fetches all entities and their audits efficiently using
   * parallel queries and batching.
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
