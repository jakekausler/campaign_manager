/**
 * Campaign Context Service
 * Aggregates all entity state (parties, kingdoms, settlements, structures) for a campaign
 * Provides context for rules engine to evaluate conditions
 */

import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';

import { KingdomService } from './kingdom.service';
import { PartyService } from './party.service';
import { SettlementService } from './settlement.service';
import { StructureService } from './structure.service';

/**
 * Context for a single party
 */
export interface PartyContext {
  id: string;
  name: string;
  level: number; // Either averageLevel or manualLevelOverride
  variables: Record<string, unknown>;
}

/**
 * Context for a single kingdom
 */
export interface KingdomContext {
  id: string;
  name: string;
  level: number;
  variables: Record<string, unknown>;
}

/**
 * Context for a single settlement
 */
export interface SettlementContext {
  id: string;
  name: string;
  kingdomId: string;
  level: number;
  variables: Record<string, unknown>;
}

/**
 * Context for a single structure
 */
export interface StructureContext {
  id: string;
  name: string;
  type: string;
  settlementId: string;
  level: number;
  variables: Record<string, unknown>;
}

/**
 * Complete campaign context for rules engine
 * Includes all entity state that can be referenced in conditions
 */
export interface CampaignContext {
  campaignId: string;
  parties: PartyContext[];
  kingdoms: KingdomContext[];
  settlements: SettlementContext[];
  structures: StructureContext[];
}

/**
 * Entity types that can trigger context invalidation
 */
export type EntityType = 'party' | 'kingdom' | 'settlement' | 'structure';

@Injectable()
export class CampaignContextService {
  // Simple in-memory cache
  // In production, this should use Redis with TTL
  private contextCache: Map<string, CampaignContext> = new Map();
  private cacheTTL = 60000; // 60 seconds
  private cacheTimestamps: Map<string, number> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly partyService: PartyService,
    private readonly kingdomService: KingdomService,
    private readonly settlementService: SettlementService,
    private readonly structureService: StructureService
  ) {}

  /**
   * Get complete campaign context for rules engine
   * Aggregates all entity state (parties, kingdoms, settlements, structures)
   * Supports multiple parties per campaign
   */
  async getCampaignContext(campaignId: string, user: AuthenticatedUser): Promise<CampaignContext> {
    // Check cache first
    const cached = this.getCachedContext(campaignId);
    if (cached) {
      return cached;
    }

    // Verify campaign exists and user has access
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        deletedAt: null,
        OR: [
          { ownerId: user.id },
          {
            memberships: {
              some: {
                userId: user.id,
              },
            },
          },
        ],
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found`);
    }

    // Fetch all parties for this campaign
    const parties = await this.partyService.findByCampaign(campaignId, user);

    // Fetch all kingdoms for this campaign
    const kingdoms = await this.kingdomService.findByCampaign(campaignId, user);

    // Fetch all settlements across all kingdoms
    const settlements = [];
    for (const kingdom of kingdoms) {
      const kingdomSettlements = await this.settlementService.findByKingdom(kingdom.id, user);
      if (Array.isArray(kingdomSettlements)) {
        settlements.push(...kingdomSettlements);
      }
    }

    // Fetch all structures across all settlements
    const structures = [];
    for (const settlement of settlements) {
      const settlementStructures = await this.structureService.findBySettlement(
        settlement.id,
        user
      );
      if (Array.isArray(settlementStructures)) {
        structures.push(...settlementStructures);
      }
    }

    // Build context
    const context: CampaignContext = {
      campaignId,
      parties: parties.map((p) => this.mapPartyToContext(p)),
      kingdoms: kingdoms.map((k) => this.mapKingdomToContext(k)),
      settlements: settlements.map((s) => this.mapSettlementToContext(s)),
      structures: structures.map((s) => this.mapStructureToContext(s)),
    };

    // Cache the result
    this.cacheContext(campaignId, context);

    return context;
  }

  /**
   * Invalidate cached context for a campaign
   * Called when any entity in the campaign changes
   */
  async invalidateContext(campaignId: string): Promise<void> {
    this.contextCache.delete(campaignId);
    this.cacheTimestamps.delete(campaignId);
  }

  /**
   * Invalidate context when an entity changes
   * Called by entity services when levels or variables change
   */
  async invalidateContextForEntity(
    _entityType: EntityType,
    _entityId: string,
    campaignId: string
  ): Promise<void> {
    // For now, just invalidate the entire campaign context
    // In the future, we could do more granular invalidation
    await this.invalidateContext(campaignId);
  }

  /**
   * Map Party entity to context format
   */
  private mapPartyToContext(party: any): PartyContext {
    return {
      id: party.id,
      name: party.name,
      // Use manualLevelOverride if set, otherwise use averageLevel
      level: party.manualLevelOverride ?? party.averageLevel ?? 0,
      variables: (party.variables as Record<string, unknown>) ?? {},
    };
  }

  /**
   * Map Kingdom entity to context format
   */
  private mapKingdomToContext(kingdom: any): KingdomContext {
    return {
      id: kingdom.id,
      name: kingdom.name,
      level: kingdom.level ?? 0,
      variables: (kingdom.variables as Record<string, unknown>) ?? {},
    };
  }

  /**
   * Map Settlement entity to context format
   */
  private mapSettlementToContext(settlement: any): SettlementContext {
    return {
      id: settlement.id,
      name: settlement.name,
      kingdomId: settlement.kingdomId,
      level: settlement.level ?? 0,
      variables: (settlement.variables as Record<string, unknown>) ?? {},
    };
  }

  /**
   * Map Structure entity to context format
   */
  private mapStructureToContext(structure: any): StructureContext {
    return {
      id: structure.id,
      name: structure.name,
      type: structure.type,
      settlementId: structure.settlementId,
      level: structure.level ?? 0,
      variables: (structure.variables as Record<string, unknown>) ?? {},
    };
  }

  /**
   * Get cached context if available and not expired
   */
  private getCachedContext(campaignId: string): CampaignContext | null {
    const cached = this.contextCache.get(campaignId);
    const timestamp = this.cacheTimestamps.get(campaignId);

    if (cached && timestamp && Date.now() - timestamp < this.cacheTTL) {
      return cached;
    }

    // Cache expired, remove it
    this.contextCache.delete(campaignId);
    this.cacheTimestamps.delete(campaignId);
    return null;
  }

  /**
   * Cache context with timestamp
   */
  private cacheContext(campaignId: string, context: CampaignContext): void {
    this.contextCache.set(campaignId, context);
    this.cacheTimestamps.set(campaignId, Date.now());
  }
}
