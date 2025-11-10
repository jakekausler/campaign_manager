/**
 * @fileoverview Campaign Service - Business logic for campaign operations
 *
 * Manages campaign CRUD operations with soft delete, archive, and cascade delete patterns.
 * Implements access control via ownership and membership roles, optimistic locking for
 * concurrent edits, version history tracking, audit logging, and real-time updates.
 *
 * Key features:
 * - CRUD operations with soft delete (deletedAt) and archive (archivedAt) support
 * - Access control: owner or GM membership required for write operations
 * - Cascade delete: propagates to events, encounters, characters, parties, kingdoms, branches
 * - Optimistic locking: version-based conflict detection for concurrent edits
 * - Version history: snapshots campaign state for time-travel queries
 * - Audit logging: tracks all mutations with user attribution
 * - Real-time updates: publishes WebSocket and GraphQL subscription events
 * - Batch operations: optimized queries to avoid N+1 patterns during cascade delete
 *
 * @module services/campaign
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import type { Campaign as PrismaCampaign, Prisma } from '@prisma/client';
import type { RedisPubSub } from 'graphql-redis-subscriptions';

import { createEntityUpdatedEvent } from '@campaign/shared';

import { PrismaService } from '../../database/prisma.service';
import { WebSocketPublisherService } from '../../websocket/websocket-publisher.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions';
import type { CreateCampaignInput, UpdateCampaignData } from '../inputs/campaign.input';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';

import { AuditService } from './audit.service';
import { VersionService, type CreateVersionInput } from './version.service';

/**
 * Service for managing campaign lifecycle and access control
 *
 * Handles campaign CRUD operations with comprehensive soft delete, archive, and cascade
 * delete patterns. Enforces access control via ownership and membership roles, implements
 * optimistic locking for concurrent edit detection, maintains version history for
 * time-travel queries, and publishes real-time updates via WebSocket and GraphQL subscriptions.
 *
 * Access Control Rules:
 * - Read: campaign owner or any campaign member (via memberships)
 * - Write (update/delete/archive): campaign owner or GM role member
 * - Soft delete only (no hard delete): preserves data for potential recovery
 *
 * Cascade Delete Hierarchy:
 * - Campaign deletion cascades to: events, encounters, characters, parties, kingdoms
 *   (which cascade to settlements, which cascade to structures), and branches
 * - Archive does NOT cascade (campaign is hidden but children remain accessible)
 *
 * @class CampaignService
 * @injectable
 */
@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly versionService: VersionService,
    @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub,
    private readonly websocketPublisher: WebSocketPublisherService
  ) {}

  /**
   * Finds a single campaign by ID with access control
   *
   * Retrieves a non-deleted campaign if the authenticated user is the owner or a member.
   * Filters out soft-deleted campaigns (deletedAt IS NOT NULL) but includes archived campaigns.
   * Used as the primary access control gate for all campaign operations.
   *
   * @param id - Campaign UUID to retrieve
   * @param user - Authenticated user context (must be owner or member)
   * @returns Campaign if found and user has access, null otherwise
   *
   * @example
   * ```typescript
   * const campaign = await campaignService.findById('campaign-uuid', user);
   * if (!campaign) {
   *   throw new NotFoundException('Campaign not found or access denied');
   * }
   * ```
   */
  async findById(id: string, user: AuthenticatedUser): Promise<PrismaCampaign | null> {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id,
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

    return campaign;
  }

  /**
   * Finds all active campaigns accessible to the authenticated user
   *
   * Retrieves non-deleted and non-archived campaigns where the user is either the owner
   * or a member (via CampaignMembership records). Results are sorted alphabetically by
   * campaign name. Excludes archived campaigns to support hiding inactive campaigns from
   * the default campaign list view.
   *
   * @param user - Authenticated user context
   * @returns Array of campaigns (empty array if none accessible), ordered by name ascending
   *
   * @example
   * ```typescript
   * const campaigns = await campaignService.findAll(user);
   * // Returns campaigns where user is owner or member, excluding deleted/archived
   * ```
   */
  async findAll(user: AuthenticatedUser): Promise<PrismaCampaign[]> {
    return this.prisma.campaign.findMany({
      where: {
        deletedAt: null,
        archivedAt: null,
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
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Finds all active campaigns for a specific world with access control
   *
   * Retrieves non-deleted and non-archived campaigns that belong to the specified world
   * where the user is either the owner or a member. Useful for world-scoped queries
   * where clients need to list all accessible campaigns within a particular game world.
   * Results are sorted alphabetically by campaign name.
   *
   * @param worldId - World UUID to filter campaigns by
   * @param user - Authenticated user context
   * @returns Array of campaigns in the world (empty if none accessible), ordered by name ascending
   *
   * @example
   * ```typescript
   * const campaigns = await campaignService.findByWorldId('world-uuid', user);
   * // Returns all user's campaigns in the specified world, excluding deleted/archived
   * ```
   */
  async findByWorldId(worldId: string, user: AuthenticatedUser): Promise<PrismaCampaign[]> {
    return this.prisma.campaign.findMany({
      where: {
        worldId,
        deletedAt: null,
        archivedAt: null,
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
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Creates a new campaign with default branch and audit trail
   *
   * Creates a campaign owned by the authenticated user, automatically creates a "Main" branch
   * as the default timeline, logs the creation in the audit trail, and publishes a real-time
   * update event via WebSocket. Validates that the target world exists before creation.
   *
   * Side effects:
   * - Creates default "Main" branch for primary campaign timeline
   * - Logs CREATE audit entry with campaign details
   * - Publishes entityUpdated WebSocket event for real-time UI updates
   *
   * @param input - Campaign creation data including name, worldId, settings, and isActive flag
   * @param user - Authenticated user context (becomes campaign owner)
   * @returns Newly created campaign (without branch relation loaded)
   * @throws {NotFoundException} If the specified world does not exist or is deleted
   *
   * @example
   * ```typescript
   * const campaign = await campaignService.create({
   *   name: 'Dragon Heist',
   *   worldId: 'world-uuid',
   *   settings: { maxPlayers: 6, difficulty: 'hard' },
   *   isActive: true
   * }, user);
   * // Campaign created with id, ownerId set to user.id, and default "Main" branch
   * ```
   */
  async create(input: CreateCampaignInput, user: AuthenticatedUser): Promise<PrismaCampaign> {
    // Verify world exists
    const world = await this.prisma.world.findFirst({
      where: { id: input.worldId, deletedAt: null },
    });

    if (!world) {
      throw new NotFoundException(`World with ID ${input.worldId} not found`);
    }

    // Create campaign
    const campaign = await this.prisma.campaign.create({
      data: {
        name: input.name,
        worldId: input.worldId,
        ownerId: user.id,
        settings: (input.settings ?? {}) as Prisma.InputJsonValue,
        isActive: input.isActive ?? true,
      },
    });

    // Create default branch
    await this.prisma.branch.create({
      data: {
        campaignId: campaign.id,
        name: 'Main',
        description: 'Primary campaign timeline',
      },
    });

    // Create audit entry
    await this.audit.log('campaign', campaign.id, 'CREATE', user.id, {
      name: campaign.name,
      worldId: campaign.worldId,
      settings: campaign.settings,
      isActive: campaign.isActive,
    });

    // Publish WebSocket event for real-time updates
    this.websocketPublisher.publishEntityUpdated(
      createEntityUpdatedEvent('campaign', campaign.id, campaign.id, {
        changedFields: ['name', 'worldId', 'settings', 'isActive'],
        userId: user.id,
        source: 'api',
      })
    );

    return campaign;
  }

  /**
   * Updates a campaign with optimistic locking, versioning, and access control
   *
   * Updates campaign fields (name, settings, isActive) with concurrent edit detection via
   * optimistic locking. Validates user has edit permissions (owner or GM), verifies branch
   * belongs to the campaign, checks version matches to prevent lost updates, creates a version
   * snapshot for time-travel queries, logs the update in audit trail, and publishes real-time
   * events via GraphQL subscription and WebSocket.
   *
   * Optimistic Locking Flow:
   * 1. Client reads campaign with current version (e.g., version: 5)
   * 2. Client edits and submits update with expectedVersion: 5
   * 3. Server checks current version === expectedVersion
   * 4. If mismatch, throws OptimisticLockException (another user edited)
   * 5. If match, increments version and commits update atomically
   *
   * Side effects:
   * - Increments version field to detect concurrent modifications
   * - Creates version snapshot with full campaign state at worldTime
   * - Logs UPDATE audit entry with changed fields
   * - Publishes entityModified GraphQL subscription event with new version
   * - Publishes entityUpdated WebSocket event with changedFields array
   *
   * @param id - Campaign UUID to update
   * @param input - Partial update data (only provided fields are updated)
   * @param user - Authenticated user context (must be owner or GM)
   * @param expectedVersion - Client's last known version for optimistic locking
   * @param branchId - Branch UUID for version history tracking (must belong to campaign)
   * @param worldTime - World-time timestamp for version snapshot (defaults to current real-time)
   * @returns Updated campaign with incremented version
   * @throws {NotFoundException} If campaign not found or user lacks access
   * @throws {BadRequestException} If branch not found or doesn't belong to campaign
   * @throws {ForbiddenException} If user lacks edit permissions (not owner/GM)
   * @throws {OptimisticLockException} If version mismatch indicates concurrent modification
   *
   * @example
   * ```typescript
   * // Client reads campaign (version: 5)
   * const updated = await campaignService.update(
   *   'campaign-uuid',
   *   { name: 'Curse of Strahd', isActive: false },
   *   user,
   *   5, // expectedVersion from client
   *   'branch-uuid',
   *   new Date('2024-03-15T00:00:00Z') // world-time for version
   * );
   * // Returns campaign with version: 6, throws OptimisticLockException if another user edited
   * ```
   */
  async update(
    id: string,
    input: UpdateCampaignData,
    user: AuthenticatedUser,
    expectedVersion: number,
    branchId: string,
    worldTime: Date = new Date()
  ): Promise<PrismaCampaign> {
    // Verify campaign exists and user has access
    const campaign = await this.findById(id, user);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    // Verify branchId belongs to this campaign
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, campaignId: id, deletedAt: null },
    });

    if (!branch) {
      throw new BadRequestException(
        `Branch with ID ${branchId} not found or does not belong to this campaign`
      );
    }

    // Verify user has edit permissions (owner or GM)
    const hasPermission = await this.hasEditPermission(id, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to update this campaign');
    }

    // Optimistic locking check: verify version matches
    if (campaign.version !== expectedVersion) {
      throw new OptimisticLockException(
        `Campaign was modified by another user. Expected version ${expectedVersion}, but found ${campaign.version}. Please refresh and try again.`,
        expectedVersion,
        campaign.version
      );
    }

    // Build update data with incremented version
    const updateData: Prisma.CampaignUpdateInput = {
      version: campaign.version + 1,
    };
    const changedFields: string[] = [];
    if (input.name !== undefined) {
      updateData.name = input.name;
      changedFields.push('name');
    }
    if (input.settings !== undefined) {
      updateData.settings = input.settings as Prisma.InputJsonValue;
      changedFields.push('settings');
    }
    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
      changedFields.push('isActive');
    }

    // Create new version payload (all fields)
    const newPayload: Record<string, unknown> = {
      ...campaign,
      ...updateData,
      version: campaign.version + 1,
    };

    // Use transaction to atomically update entity and create version
    const updated = await this.prisma.$transaction(async (tx) => {
      // Update campaign with new version
      const updatedCampaign = await tx.campaign.update({
        where: { id },
        data: updateData,
      });

      // Create version snapshot
      const versionInput: CreateVersionInput = {
        entityType: 'campaign',
        entityId: id,
        branchId,
        validFrom: worldTime,
        validTo: null,
        payload: newPayload,
      };
      await this.versionService.createVersion(versionInput, user);

      return updatedCampaign;
    });

    // Create audit entry
    await this.audit.log('campaign', id, 'UPDATE', user.id, updateData);

    // Publish entityModified event for concurrent edit detection
    await this.pubSub.publish(`entity.modified.${id}`, {
      entityModified: {
        entityId: id,
        entityType: 'campaign',
        version: updated.version,
        modifiedBy: user.id,
        modifiedAt: updated.updatedAt,
      },
    });

    // Publish WebSocket event for real-time updates
    this.websocketPublisher.publishEntityUpdated(
      createEntityUpdatedEvent('campaign', id, id, {
        changedFields,
        userId: user.id,
        source: 'api',
      })
    );

    return updated;
  }

  /**
   * Soft deletes a campaign with cascade to child entities
   *
   * Marks the campaign and all child entities as deleted by setting deletedAt timestamp.
   * Does NOT hard delete records (preserves data for potential recovery or audit purposes).
   * Validates user has delete permissions (owner or GM), then cascades deletion to:
   * events, encounters, characters, parties, kingdoms (which cascade to settlements and
   * structures), and branches. Uses batch operations to optimize database queries and
   * avoid N+1 patterns.
   *
   * Cascade Hierarchy (all soft delete):
   * - Campaign → Events (direct children)
   * - Campaign → Encounters (direct children)
   * - Campaign → Characters (direct children)
   * - Campaign → Parties (direct children)
   * - Campaign → Kingdoms → Settlements → Structures (nested cascade)
   * - Campaign → Branches (direct children)
   *
   * Side effects:
   * - Sets deletedAt on campaign and all cascaded child entities
   * - Logs DELETE audit entry with deletedAt timestamp
   * - Publishes entityUpdated WebSocket event with deletedAt in changedFields
   * - Does NOT delete memberships (allows audit trail preservation)
   *
   * @param id - Campaign UUID to soft delete
   * @param user - Authenticated user context (must be owner or GM)
   * @returns Soft-deleted campaign with deletedAt timestamp
   * @throws {NotFoundException} If campaign not found or user lacks access
   * @throws {ForbiddenException} If user lacks delete permissions (not owner/GM)
   *
   * @example
   * ```typescript
   * const deleted = await campaignService.delete('campaign-uuid', user);
   * // Campaign and all children have deletedAt set, excluded from default queries
   * ```
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaCampaign> {
    // Verify campaign exists and user has access
    const campaign = await this.findById(id, user);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    // Verify user has delete permissions (owner or GM)
    const hasPermission = await this.hasEditPermission(id, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to delete this campaign');
    }

    const deletedAt = new Date();

    // Soft delete campaign
    const deleted = await this.prisma.campaign.update({
      where: { id },
      data: { deletedAt },
    });

    // Cascade delete to child entities
    await this.cascadeDelete(id, deletedAt);

    // Create audit entry
    await this.audit.log('campaign', id, 'DELETE', user.id, { deletedAt });

    // Publish WebSocket event for real-time updates
    this.websocketPublisher.publishEntityUpdated(
      createEntityUpdatedEvent('campaign', id, id, {
        changedFields: ['deletedAt'],
        userId: user.id,
        source: 'api',
      })
    );

    return deleted;
  }

  /**
   * Archives a campaign without cascading to child entities
   *
   * Marks the campaign as archived by setting archivedAt timestamp. Unlike soft delete,
   * archive does NOT cascade to child entities - only the campaign itself is hidden from
   * default queries. This allows hiding inactive campaigns while preserving full access
   * to all campaign data (events, encounters, characters, etc.) if needed. Useful for
   * completed or paused campaigns that should be hidden but not deleted.
   *
   * Archive vs Soft Delete:
   * - Archive: Sets archivedAt, excludes from findAll(), does NOT cascade
   * - Soft Delete: Sets deletedAt, cascades to all children, harder to recover
   *
   * Side effects:
   * - Sets archivedAt on campaign only (children remain accessible)
   * - Logs ARCHIVE audit entry with archivedAt timestamp
   * - Does NOT publish WebSocket event (archive is a status change, not data modification)
   *
   * @param id - Campaign UUID to archive
   * @param user - Authenticated user context (must be owner or GM)
   * @returns Archived campaign with archivedAt timestamp
   * @throws {NotFoundException} If campaign not found or user lacks access
   * @throws {ForbiddenException} If user lacks edit permissions (not owner/GM)
   *
   * @example
   * ```typescript
   * const archived = await campaignService.archive('campaign-uuid', user);
   * // Campaign hidden from findAll() but all child entities remain accessible
   * ```
   */
  async archive(id: string, user: AuthenticatedUser): Promise<PrismaCampaign> {
    // Verify campaign exists and user has access
    const campaign = await this.findById(id, user);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.hasEditPermission(id, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to archive this campaign');
    }

    const archivedAt = new Date();

    const archived = await this.prisma.campaign.update({
      where: { id },
      data: { archivedAt },
    });

    // Create audit entry
    await this.audit.log('campaign', id, 'ARCHIVE', user.id, { archivedAt });

    return archived;
  }

  /**
   * Restores an archived campaign to active status
   *
   * Clears the archivedAt timestamp to make the campaign visible in default queries again.
   * Unlike delete/archive, this method searches for campaigns even if archived (removes
   * archivedAt filter from findFirst) to allow restoration. Only affects the campaign itself,
   * not child entities.
   *
   * Side effects:
   * - Clears archivedAt (sets to null) to restore campaign to active status
   * - Logs RESTORE audit entry with archivedAt: null
   * - Does NOT publish WebSocket event (status change, not data modification)
   *
   * @param id - Campaign UUID to restore
   * @param user - Authenticated user context (must be owner or GM)
   * @returns Restored campaign with archivedAt set to null
   * @throws {NotFoundException} If campaign not found (even including archived) or user lacks access
   * @throws {ForbiddenException} If user lacks edit permissions (not owner/GM)
   *
   * @example
   * ```typescript
   * const restored = await campaignService.restore('campaign-uuid', user);
   * // Campaign now appears in findAll() results again
   * ```
   */
  async restore(id: string, user: AuthenticatedUser): Promise<PrismaCampaign> {
    // Find campaign even if archived
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id,
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
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.hasEditPermission(id, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to restore this campaign');
    }

    const restored = await this.prisma.campaign.update({
      where: { id },
      data: { archivedAt: null },
    });

    // Create audit entry
    await this.audit.log('campaign', id, 'RESTORE', user.id, { archivedAt: null });

    return restored;
  }

  /**
   * Cascades soft delete to all child entities using batch operations
   *
   * Implements cascade delete hierarchy for campaign deletion. Uses batch updateMany
   * operations to avoid N+1 query patterns and optimize performance. Processes nested
   * hierarchies (kingdoms → settlements → structures) by first collecting IDs, then
   * updating in reverse dependency order (structures first, then settlements, then kingdoms).
   *
   * Cascade Hierarchy (executed in this order):
   * 1. Events (direct children of campaign)
   * 2. Encounters (direct children of campaign)
   * 3. Characters (direct children of campaign)
   * 4. Parties (direct children of campaign)
   * 5. Structures (grandchildren via kingdoms → settlements)
   * 6. Settlements (children via kingdoms)
   * 7. Kingdoms (direct children of campaign)
   * 8. Branches (direct children of campaign)
   *
   * Performance Optimization:
   * - Uses updateMany with IN clauses instead of individual updates
   * - Collects all IDs first to minimize database round-trips
   * - Updates in batches per entity type, not per record
   * - Avoids N+1 queries by using findMany with select instead of iteration
   *
   * @param campaignId - Campaign UUID whose children should be cascade deleted
   * @param deletedAt - Timestamp to set on all soft-deleted entities
   * @private
   */
  private async cascadeDelete(campaignId: string, deletedAt: Date): Promise<void> {
    // Soft delete all events
    await this.prisma.event.updateMany({
      where: { campaignId, deletedAt: null },
      data: { deletedAt },
    });

    // Soft delete all encounters
    await this.prisma.encounter.updateMany({
      where: { campaignId, deletedAt: null },
      data: { deletedAt },
    });

    // Soft delete all characters
    await this.prisma.character.updateMany({
      where: { campaignId, deletedAt: null },
      data: { deletedAt },
    });

    // Soft delete all parties
    await this.prisma.party.updateMany({
      where: { campaignId, deletedAt: null },
      data: { deletedAt },
    });

    // Cascade delete kingdoms → settlements → structures (optimized batch operations)
    // Get all kingdom IDs for this campaign
    const kingdoms = await this.prisma.kingdom.findMany({
      where: { campaignId, deletedAt: null },
      select: { id: true },
    });
    const kingdomIds = kingdoms.map((k) => k.id);

    if (kingdomIds.length > 0) {
      // Get all settlement IDs for these kingdoms
      const settlements = await this.prisma.settlement.findMany({
        where: { kingdomId: { in: kingdomIds }, deletedAt: null },
        select: { id: true },
      });
      const settlementIds = settlements.map((s) => s.id);

      // Batch update all structures for these settlements
      if (settlementIds.length > 0) {
        await this.prisma.structure.updateMany({
          where: { settlementId: { in: settlementIds }, deletedAt: null },
          data: { deletedAt },
        });
      }

      // Batch update all settlements
      await this.prisma.settlement.updateMany({
        where: { id: { in: settlementIds }, deletedAt: null },
        data: { deletedAt },
      });

      // Batch update all kingdoms
      await this.prisma.kingdom.updateMany({
        where: { id: { in: kingdomIds }, deletedAt: null },
        data: { deletedAt },
      });
    }

    // Soft delete all branches
    await this.prisma.branch.updateMany({
      where: { campaignId, deletedAt: null },
      data: { deletedAt },
    });
  }

  /**
   * Checks if user has edit permissions for a campaign
   *
   * Validates the authenticated user has sufficient permissions to modify the campaign.
   * Edit permissions are granted if the user is either the campaign owner OR has a
   * campaign membership with OWNER or GM role. Used as the authorization gate for
   * update, delete, archive, and restore operations.
   *
   * Permission Hierarchy:
   * - Campaign owner (ownerId matches user.id): Always granted
   * - Membership with OWNER role: Granted (co-owner scenario)
   * - Membership with GM role: Granted (game master can manage campaign)
   * - Membership with PLAYER role: Denied (players have read-only access)
   * - No membership: Denied (no access)
   *
   * @param campaignId - Campaign UUID to check permissions for
   * @param user - Authenticated user context
   * @returns True if user is owner or has OWNER/GM membership role, false otherwise
   * @private
   */
  private async hasEditPermission(campaignId: string, user: AuthenticatedUser): Promise<boolean> {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        OR: [
          { ownerId: user.id },
          {
            memberships: {
              some: {
                userId: user.id,
                role: {
                  in: ['OWNER', 'GM'],
                },
              },
            },
          },
        ],
      },
    });

    return campaign !== null;
  }

  /**
   * Retrieves campaign state at a specific point in world-time (time-travel query)
   *
   * Resolves the campaign's historical state as it existed at the specified world-time
   * timestamp within a given branch. Uses the version history system to retrieve the most
   * recent version snapshot where validFrom <= worldTime and (validTo > worldTime OR validTo IS NULL).
   * Supports "what-if" scenario analysis and historical state inspection. Validates user
   * has access to the campaign before returning historical data.
   *
   * Version Resolution:
   * 1. Validates user has access to current campaign
   * 2. Queries versions table for matching entityId, branchId, and time range
   * 3. Decompresses version payload (may be gzip-compressed JSON)
   * 4. Returns full campaign object as it existed at that time
   *
   * Use Cases:
   * - Viewing campaign state before a major change
   * - Comparing campaign configurations across different points in time
   * - Auditing campaign modifications with full historical context
   * - Branch comparison to see divergence from a common ancestor
   *
   * @param id - Campaign UUID to retrieve historical state for
   * @param branchId - Branch UUID for version history lookup (branches have independent timelines)
   * @param worldTime - World-time timestamp to query (not real-world time)
   * @param user - Authenticated user context (must have access to current campaign)
   * @returns Campaign state at worldTime, or null if no version exists or user lacks access
   *
   * @example
   * ```typescript
   * // Get campaign as it was on Jan 1, 2024 in main branch
   * const historical = await campaignService.getCampaignAsOf(
   *   'campaign-uuid',
   *   'main-branch-uuid',
   *   new Date('2024-01-01T00:00:00Z'),
   *   user
   * );
   * if (historical) {
   *   console.log('Campaign name was:', historical.name);
   *   console.log('Version at that time:', historical.version);
   * }
   * ```
   */
  async getCampaignAsOf(
    id: string,
    branchId: string,
    worldTime: Date,
    user: AuthenticatedUser
  ): Promise<PrismaCampaign | null> {
    // Verify user has access to the campaign
    const campaign = await this.findById(id, user);
    if (!campaign) {
      return null;
    }

    // Resolve version at the specified time
    const version = await this.versionService.resolveVersion('campaign', id, branchId, worldTime);

    if (!version) {
      return null;
    }

    // Decompress and return the historical payload as a Campaign object
    const payload = await this.versionService.decompressVersion(version);

    return payload as PrismaCampaign;
  }
}
