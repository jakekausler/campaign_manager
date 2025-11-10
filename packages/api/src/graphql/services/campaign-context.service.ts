/**
 * @file Campaign Context Service
 *
 * Service for building and caching campaign context used by the rules engine for condition evaluation.
 * Aggregates all entity state (parties, kingdoms, settlements, structures) from a campaign into a
 * single context object that can be efficiently evaluated against JSONLogic conditions.
 *
 * Key Responsibilities:
 * - Build comprehensive campaign context including all entities and their variables
 * - Cache context in Redis for performance across multiple API instances
 * - Handle context invalidation when entity state changes
 * - Monitor and warn about large contexts that may impact performance
 * - Support multi-party campaigns with efficient batch queries
 *
 * Architecture:
 * - Uses Redis for distributed caching (TTL-based, configurable)
 * - Lazy loading with cache-aside pattern (check cache, populate on miss)
 * - Fire-and-forget caching to avoid blocking response times
 * - Graceful degradation if Redis is unavailable
 *
 * Performance Considerations:
 * - Batch fetches settlements and structures to minimize database queries
 * - Context size monitoring with configurable warning thresholds
 * - Cache size limits (10MB max) to prevent memory issues
 * - Production metrics logging for observability
 *
 * @module CampaignContextService
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
 *
 * Simplified representation of a party for condition evaluation. Contains only the fields
 * commonly referenced in JSONLogic conditions (level, variables).
 *
 * @property id - Unique party identifier
 * @property name - Display name of the party
 * @property level - Effective party level (manualLevelOverride takes precedence over averageLevel)
 * @property variables - Custom variables for condition evaluation (from party.variables JSON field)
 */
export interface PartyContext {
  id: string;
  name: string;
  level: number; // Either averageLevel or manualLevelOverride
  variables: Record<string, unknown>;
}

/**
 * Context for a single kingdom
 *
 * Simplified representation of a kingdom for condition evaluation.
 *
 * @property id - Unique kingdom identifier
 * @property name - Display name of the kingdom
 * @property level - Kingdom power level
 * @property variables - Custom variables for condition evaluation (from kingdom.variables JSON field)
 */
export interface KingdomContext {
  id: string;
  name: string;
  level: number;
  variables: Record<string, unknown>;
}

/**
 * Context for a single settlement
 *
 * Simplified representation of a settlement for condition evaluation. Includes reference
 * to parent kingdom for relational queries in conditions.
 *
 * @property id - Unique settlement identifier
 * @property name - Display name of the settlement
 * @property kingdomId - ID of the parent kingdom
 * @property level - Settlement development level
 * @property variables - Custom variables for condition evaluation (from settlement.variables JSON field)
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
 *
 * Simplified representation of a structure for condition evaluation. Includes type and
 * parent settlement for relational queries in conditions.
 *
 * @property id - Unique structure identifier
 * @property name - Display name of the structure
 * @property type - Structure type (e.g., "Castle", "Temple", "Market")
 * @property settlementId - ID of the parent settlement
 * @property level - Structure upgrade level
 * @property variables - Custom variables for condition evaluation (from structure.variables JSON field)
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
 *
 * Aggregated snapshot of all entity state in a campaign at a point in time. This context
 * is passed to the rules engine for evaluating JSONLogic conditions on events, encounters,
 * and effects. The structure is optimized for condition evaluation performance.
 *
 * Example Usage in Conditions:
 * ```json
 * {
 *   ">=": [
 *     { "var": "parties.0.level" },
 *     5
 *   ]
 * }
 * ```
 *
 * @property campaignId - Unique campaign identifier
 * @property parties - All parties in the campaign (supports multiple parties)
 * @property kingdoms - All kingdoms in the campaign
 * @property settlements - All settlements across all kingdoms (flat list for performance)
 * @property structures - All structures across all settlements (flat list for performance)
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
 *
 * Used to identify which entity type changed, allowing for potential future optimizations
 * where only affected portions of the context are invalidated.
 */
export type EntityType = 'party' | 'kingdom' | 'settlement' | 'structure';

/**
 * Service for building and managing campaign context for rules engine condition evaluation
 *
 * This service aggregates entity state from parties, kingdoms, settlements, and structures
 * into a unified context object that can be efficiently evaluated against JSONLogic conditions.
 * It implements distributed caching using Redis to optimize performance across multiple
 * API instances.
 *
 * Architecture Pattern: Cache-Aside
 * - Check Redis cache first on read
 * - On cache miss, query database and populate cache
 * - Fire-and-forget cache writes to avoid blocking
 * - Graceful degradation if Redis fails
 *
 * Cache Invalidation Strategy:
 * - Explicit invalidation when entities change (levels or variables)
 * - TTL-based expiration as safety net (default 60s, configurable)
 * - Currently invalidates entire campaign context (granular invalidation future enhancement)
 *
 * Performance Optimizations:
 * - Batch queries for settlements and structures (minimize N+1)
 * - Size monitoring with configurable thresholds
 * - Maximum cache payload size (10MB) to prevent memory issues
 * - Production metrics for observability
 *
 * Configuration:
 * - `CAMPAIGN_CONTEXT_CACHE_TTL` - Cache TTL in seconds (default: 60, max: 3600)
 * - `CONTEXT_SIZE_WARNING_THRESHOLD` - Entity count warning threshold (default: 1000, max: 10000)
 *
 * @class CampaignContextService
 */
@Injectable()
export class CampaignContextService {
  /**
   * Redis cache TTL in seconds
   * @private
   */
  private readonly cacheTTL: number;

  /**
   * Constructs the campaign context service
   *
   * Initializes cache TTL from environment variables with validation:
   * - Default: 60 seconds
   * - Minimum: 1 second
   * - Maximum: 3600 seconds (1 hour)
   *
   * Uses forwardRef for entity services to avoid circular dependency issues
   * (these services may also depend on CampaignContextService).
   *
   * @param prisma - Prisma database client for querying entities
   * @param redis - Redis client for distributed caching
   * @param partyService - Service for fetching party data
   * @param kingdomService - Service for fetching kingdom data
   * @param settlementService - Service for batch-fetching settlement data
   * @param structureService - Service for batch-fetching structure data
   */
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
   * Get complete campaign context for rules engine condition evaluation
   *
   * Builds a comprehensive snapshot of all entity state in a campaign including parties,
   * kingdoms, settlements, and structures. Implements cache-aside pattern with Redis for
   * performance optimization across multiple API instances.
   *
   * Flow:
   * 1. Check Redis cache for existing context
   * 2. If cache hit and valid, return cached context
   * 3. If cache miss:
   *    a. Verify campaign exists and user has access (owner or member)
   *    b. Fetch all parties for the campaign
   *    c. Fetch all kingdoms for the campaign
   *    d. Batch fetch all settlements across all kingdoms
   *    e. Batch fetch all structures across all settlements
   *    f. Build context object with entity mappings
   *    g. Monitor context size and log warnings if needed
   *    h. Fire-and-forget cache write (non-blocking)
   * 4. Return context
   *
   * Performance Characteristics:
   * - Cache hit: ~1-5ms (Redis lookup + deserialization)
   * - Cache miss: ~50-200ms depending on entity count (DB queries + processing)
   * - Batch queries minimize N+1 issues for settlements and structures
   *
   * Access Control:
   * - Verifies user is campaign owner OR has active membership
   * - Entity services handle additional row-level security
   *
   * @param campaignId - Unique identifier of the campaign
   * @param user - Authenticated user making the request (for access control)
   * @returns Complete campaign context with all entity state
   * @throws {NotFoundException} If campaign doesn't exist or user lacks access
   *
   * @example
   * ```typescript
   * const context = await service.getCampaignContext(campaignId, user);
   * console.log(`Campaign has ${context.parties.length} parties`);
   * console.log(`First party level: ${context.parties[0].level}`);
   * ```
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
   *
   * Removes the cached context from Redis, forcing next request to rebuild from database.
   * Called when any entity state changes that would affect condition evaluation (e.g., level
   * changes, variable updates).
   *
   * This is a simple full-context invalidation. Future optimization could implement granular
   * invalidation where only affected portions are removed.
   *
   * @param campaignId - Unique identifier of the campaign to invalidate
   * @returns Promise that resolves when cache entry is deleted
   *
   * @example
   * ```typescript
   * // After updating party level
   * await partyService.updateLevel(partyId, newLevel);
   * await contextService.invalidateContext(campaignId);
   * ```
   */
  async invalidateContext(campaignId: string): Promise<void> {
    const cacheKey = this.getCacheKey(campaignId);
    await this.redis.del(cacheKey);
  }

  /**
   * Invalidate context when a specific entity changes
   *
   * Called by entity services (PartyService, KingdomService, etc.) when entity state changes
   * that affects condition evaluation, such as level changes or variable updates.
   *
   * Current Implementation:
   * - Invalidates entire campaign context regardless of entity type
   * - Simple but safe approach that ensures consistency
   *
   * Future Enhancement:
   * - Could implement granular invalidation based on entity type
   * - Example: Only invalidate "parties" array if a party changes
   * - Would require partial cache updates or separate cache keys per entity type
   *
   * @param _entityType - Type of entity that changed (currently unused, for future optimization)
   * @param _entityId - ID of entity that changed (currently unused, for future optimization)
   * @param campaignId - Campaign containing the changed entity
   * @returns Promise that resolves when cache is invalidated
   *
   * @example
   * ```typescript
   * // Called by PartyService when party level changes
   * async updatePartyLevel(partyId: string, newLevel: number, campaignId: string) {
   *   await prisma.party.update({ where: { id: partyId }, data: { level: newLevel } });
   *   await contextService.invalidateContextForEntity('party', partyId, campaignId);
   * }
   * ```
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
   *
   * Transforms full Party database entity into simplified PartyContext for condition evaluation.
   * Selects the effective level (manual override takes precedence over computed average).
   *
   * @param party - Party entity from database
   * @returns Simplified party context for rules engine
   * @private
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
   *
   * Transforms full Kingdom database entity into simplified KingdomContext for condition evaluation.
   *
   * @param kingdom - Kingdom entity from database
   * @returns Simplified kingdom context for rules engine
   * @private
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
   *
   * Transforms full Settlement database entity into simplified SettlementContext for condition
   * evaluation. Preserves parent kingdom ID for relational queries in conditions.
   *
   * @param settlement - Settlement entity from database
   * @returns Simplified settlement context for rules engine
   * @private
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
   *
   * Transforms full Structure database entity into simplified StructureContext for condition
   * evaluation. Preserves type and parent settlement ID for relational queries in conditions.
   *
   * @param structure - Structure entity from database
   * @returns Simplified structure context for rules engine
   * @private
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
   *
   * Attempts to retrieve and deserialize cached campaign context from Redis.
   * Validates structure before returning to ensure data integrity.
   *
   * Error Handling:
   * - Returns null on any error (Redis unavailable, parse error, invalid structure)
   * - Logs errors but doesn't throw to enable graceful degradation
   * - Caller will rebuild context from database on null return
   *
   * @param campaignId - Campaign identifier for cache lookup
   * @returns Cached context if valid, null if missing/invalid/error
   * @private
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
   *
   * Serializes and stores campaign context in Redis with configured TTL. Includes size check
   * to prevent storing excessively large payloads that could cause memory issues.
   *
   * Size Limits:
   * - Maximum cache payload: 10MB
   * - Payloads exceeding limit are logged but not cached
   * - Service continues to work without caching (graceful degradation)
   *
   * Error Handling:
   * - Never throws errors (caching is optional optimization)
   * - Logs errors for observability
   * - If Redis fails, service still works via direct DB queries
   *
   * @param campaignId - Campaign identifier for cache key
   * @param context - Campaign context to serialize and cache
   * @returns Promise that resolves when cache write completes or fails
   * @private
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
   *
   * Tracks context size metrics for performance monitoring and operational visibility.
   * Logs warnings when entity counts exceed configurable thresholds to identify campaigns
   * that may need optimization (pagination, chunking, or archival).
   *
   * Monitoring Strategy:
   * - Counts total entities across all types
   * - Logs warning if total exceeds threshold (default 1000 entities)
   * - In production, emits structured metrics for ingestion by monitoring systems
   *
   * Configuration:
   * - `CONTEXT_SIZE_WARNING_THRESHOLD` environment variable (default: 1000)
   * - Min: 100, Max: 10000
   *
   * Use Cases:
   * - Identify campaigns approaching scale limits
   * - Trigger alerting for operational teams
   * - Support capacity planning decisions
   * - Enable A/B testing of optimization strategies
   *
   * @param context - Campaign context to measure
   * @private
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
   *
   * Type guard function that verifies deserialized cache data has the expected structure
   * before using it as a CampaignContext. Prevents runtime errors from corrupted or
   * malformed cache entries.
   *
   * Validation Checks:
   * - Data is a non-null object
   * - Has string campaignId property
   * - Has array properties for parties, kingdoms, settlements, structures
   *
   * Note: This is a shallow structure check. It doesn't validate individual entity shapes
   * or verify data integrity beyond type validation. For production, consider adding:
   * - Schema validation (e.g., Zod, Joi)
   * - Checksum verification
   * - Version tags for cache format migration
   *
   * @param data - Deserialized data from cache
   * @returns true if data matches CampaignContext structure, false otherwise
   * @private
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
   *
   * Creates a namespaced cache key to avoid collisions with other cached data types.
   * Uses consistent format: `campaign:context:{campaignId}`
   *
   * Key Format Benefits:
   * - Clear namespace hierarchy for Redis key scanning
   * - Supports pattern-based invalidation (future: `campaign:context:*`)
   * - Compatible with Redis Cluster (single campaign stays on one shard)
   * - Human-readable for debugging and monitoring
   *
   * @param campaignId - Campaign identifier
   * @returns Redis cache key
   * @private
   */
  private getCacheKey(campaignId: string): string {
    return `campaign:context:${campaignId}`;
  }
}
