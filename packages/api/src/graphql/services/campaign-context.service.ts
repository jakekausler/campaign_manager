/**
 * Campaign Context Service
 * Aggregates all entity state (parties, kingdoms, settlements, structures) for a campaign
 * Provides context for rules engine to evaluate conditions
 */

import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import type { Party, Kingdom, Settlement, Structure } from '@prisma/client';
import type Redis from 'ioredis';

import { PrismaService } from '../../database/prisma.service';
import { REDIS_CACHE } from '../cache/redis-cache.provider';
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
  // Redis cache for campaign context (supports multiple API instances)
  private readonly cacheTTL: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CACHE)
    private readonly redis: Redis,
    @Inject(forwardRef(() => PartyService))
    private readonly partyService: PartyService,
    @Inject(forwardRef(() => KingdomService))
    private readonly kingdomService: KingdomService,
    @Inject(forwardRef(() => SettlementService))
    private readonly settlementService: SettlementService,
    @Inject(forwardRef(() => StructureService))
    private readonly structureService: StructureService
  ) {
    // TTL in seconds (default 60 seconds, configurable via env, max 1 hour)
    const ttl = parseInt(process.env.CAMPAIGN_CONTEXT_CACHE_TTL || '60', 10);
    this.cacheTTL = isNaN(ttl) || ttl <= 0 ? 60 : Math.min(ttl, 3600);
  }

  /**
   * Get complete campaign context for rules engine
   * Aggregates all entity state (parties, kingdoms, settlements, structures)
   * Supports multiple parties per campaign
   */
  async getCampaignContext(campaignId: string, user: AuthenticatedUser): Promise<CampaignContext> {
    // Check cache first
    const cached = await this.getCachedContext(campaignId);
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

    // Fetch all settlements across all kingdoms in a single batch query
    const kingdomIds = kingdoms.map((k) => k.id);
    const settlements = await this.settlementService.findByKingdoms(kingdomIds, user);

    // Fetch all structures across all settlements in a single batch query
    const settlementIds = settlements.map((s) => s.id);
    const structures = await this.structureService.findBySettlements(settlementIds, user);

    // Build context
    const context: CampaignContext = {
      campaignId,
      parties: parties.map((p) => this.mapPartyToContext(p)),
      kingdoms: kingdoms.map((k) => this.mapKingdomToContext(k)),
      settlements: settlements.map((s) => this.mapSettlementToContext(s)),
      structures: structures.map((s) => this.mapStructureToContext(s)),
    };

    // Monitor context size and warn if too large
    this.monitorContextSize(context);

    // Cache the result (fire and forget - don't await to avoid blocking response)
    void this.cacheContext(campaignId, context);

    return context;
  }

  /**
   * Invalidate cached context for a campaign
   * Called when any entity in the campaign changes
   */
  async invalidateContext(campaignId: string): Promise<void> {
    const cacheKey = this.getCacheKey(campaignId);
    await this.redis.del(cacheKey);
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
  private mapPartyToContext(party: Party): PartyContext {
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
  private mapKingdomToContext(kingdom: Kingdom): KingdomContext {
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
  private mapSettlementToContext(settlement: Settlement): SettlementContext {
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
  private mapStructureToContext(structure: Structure): StructureContext {
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
   * Get cached context from Redis if available and not expired
   */
  private async getCachedContext(campaignId: string): Promise<CampaignContext | null> {
    try {
      const cacheKey = this.getCacheKey(campaignId);
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        const parsed = JSON.parse(cached);

        // Validate that parsed data matches CampaignContext structure
        if (this.isValidCampaignContext(parsed)) {
          return parsed as CampaignContext;
        } else {
          console.error('Invalid cache data structure, refetching from DB');
          return null;
        }
      }

      return null;
    } catch (error) {
      // Log error but don't fail - just return null to refetch from DB
      console.error('Redis cache get error:', error);
      return null;
    }
  }

  /**
   * Cache context in Redis with TTL
   */
  private async cacheContext(campaignId: string, context: CampaignContext): Promise<void> {
    try {
      const serialized = JSON.stringify(context);

      // Check payload size to prevent memory issues
      const sizeInMB = Buffer.byteLength(serialized) / (1024 * 1024);
      const maxSizeMB = 10; // 10MB threshold

      if (sizeInMB > maxSizeMB) {
        console.warn(
          `Context too large to cache (${sizeInMB.toFixed(2)}MB exceeds ${maxSizeMB}MB limit) for campaign ${campaignId}, skipping cache`
        );
        return;
      }

      const cacheKey = this.getCacheKey(campaignId);
      await this.redis.setex(cacheKey, this.cacheTTL, serialized);
    } catch (error) {
      // Log error but don't fail - caching is optional
      console.error('Redis cache set error:', error);
    }
  }

  /**
   * Monitor context size and log warnings if it's too large
   */
  private monitorContextSize(context: CampaignContext): void {
    const totalEntities =
      context.parties.length +
      context.kingdoms.length +
      context.settlements.length +
      context.structures.length;

    // Warning threshold for large campaigns (configurable via env, min 100, max 10000)
    const threshold = parseInt(process.env.CONTEXT_SIZE_WARNING_THRESHOLD || '1000', 10);
    const warningThreshold =
      isNaN(threshold) || threshold < 100 ? 1000 : Math.min(threshold, 10000);

    if (totalEntities > warningThreshold) {
      console.warn(
        `Campaign context is large (${totalEntities} total entities): ` +
          `${context.parties.length} parties, ` +
          `${context.kingdoms.length} kingdoms, ` +
          `${context.settlements.length} settlements, ` +
          `${context.structures.length} structures. ` +
          `Campaign ID: ${context.campaignId}. ` +
          `Consider pagination or chunking for very large campaigns.`
      );
    }

    // Log metrics for monitoring (can be ingested by monitoring systems)
    if (process.env.NODE_ENV === 'production') {
      console.log(
        JSON.stringify({
          type: 'campaign_context_metrics',
          campaignId: context.campaignId,
          totalEntities,
          parties: context.parties.length,
          kingdoms: context.kingdoms.length,
          settlements: context.settlements.length,
          structures: context.structures.length,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }

  /**
   * Validate that parsed cache data matches CampaignContext structure
   */
  private isValidCampaignContext(data: unknown): data is CampaignContext {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const context = data as Record<string, unknown>;

    return (
      typeof context.campaignId === 'string' &&
      Array.isArray(context.parties) &&
      Array.isArray(context.kingdoms) &&
      Array.isArray(context.settlements) &&
      Array.isArray(context.structures)
    );
  }

  /**
   * Generate Redis cache key for campaign context
   */
  private getCacheKey(campaignId: string): string {
    return `campaign:context:${campaignId}`;
  }
}
