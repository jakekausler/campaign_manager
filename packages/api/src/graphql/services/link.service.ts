/**
 * @fileoverview Link Service
 *
 * Provides service layer operations for managing directed relationships (links) between entities
 * in the campaign management system. Links are bidirectional but directed, meaning they have a
 * source and target, enabling dependency tracking and relationship modeling between Encounters
 * and Events.
 *
 * Key Features:
 * - Directed relationship management with source/target semantics
 * - Cross-entity linking (Encounters and Events)
 * - Campaign-scoped link validation and access control
 * - Duplicate link prevention based on source, target, and type
 * - Soft deletion with audit trail integration
 * - Bidirectional entity queries (as source or target)
 *
 * Link Types:
 * Links use a flexible `linkType` field to categorize relationships:
 * - "depends_on": Target must be completed before source
 * - "enables": Source unlocks or activates target
 * - "related_to": General association without dependency semantics
 * - Custom types: Applications can define additional relationship types
 *
 * Security Model:
 * - Links inherit access control from both source and target entities
 * - Users must have campaign membership for both linked entities
 * - Cross-campaign links are forbidden
 * - All operations include audit logging
 *
 * @module services/link
 */

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Link as PrismaLink, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import type { CreateLinkInput, UpdateLinkInput } from '../inputs/link.input';

import { AuditService } from './audit.service';

/**
 * Service for managing directed relationships (links) between campaign entities.
 *
 * Links represent directed relationships between Encounters and Events, enabling
 * dependency tracking, relationship modeling, and cross-entity navigation. Each link
 * has a source entity, target entity, and a type that categorizes the relationship.
 *
 * Links are campaign-scoped and enforce strict access control, ensuring users can only
 * create and query links for entities within campaigns they have access to. The service
 * prevents duplicate links and validates that linked entities belong to the same campaign.
 *
 * All operations include automatic audit logging for compliance and change tracking.
 *
 * @example
 * ```typescript
 * // Create a dependency link
 * const link = await linkService.create({
 *   sourceType: 'encounter',
 *   sourceId: 'encounter-123',
 *   targetType: 'event',
 *   targetId: 'event-456',
 *   linkType: 'depends_on',
 *   description: 'Quest requires previous event completion'
 * }, user);
 *
 * // Query all links for an entity
 * const links = await linkService.findByEntity('encounter', 'encounter-123', user);
 *
 * // Query only outgoing links (entity as source)
 * const outgoing = await linkService.findBySourceEntity('encounter', 'encounter-123', user);
 * ```
 *
 * @class LinkService
 * @injectable
 */
@Injectable()
export class LinkService {
  /**
   * Creates a new LinkService instance.
   *
   * @param {PrismaService} prisma - Prisma database client for data access
   * @param {AuditService} audit - Audit service for operation logging
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Retrieves a link by its unique identifier with access control verification.
   *
   * This method performs a campaign-scoped lookup, ensuring the authenticated user
   * has access to the source entity's campaign. Only non-deleted links are returned.
   * Returns null if the link doesn't exist or was soft-deleted.
   *
   * Access control is verified through the source entity to ensure the user has
   * permission to view the link. If the link exists but the user lacks access,
   * a ForbiddenException is thrown.
   *
   * @param {string} id - Unique identifier of the link to retrieve
   * @param {AuthenticatedUser} user - Authenticated user context for access control
   * @returns {Promise<PrismaLink | null>} The link record if found and accessible, null otherwise
   * @throws {NotFoundException} If the source entity doesn't exist
   * @throws {ForbiddenException} If the user lacks campaign access
   *
   * @example
   * ```typescript
   * const link = await linkService.findById('link-123', user);
   * if (link) {
   *   console.log(`Link from ${link.sourceType} to ${link.targetType}`);
   * }
   * ```
   */
  async findById(id: string, user: AuthenticatedUser): Promise<PrismaLink | null> {
    const link = await this.prisma.link.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (link) {
      // Verify user has access to the source entity's campaign
      await this.checkEntityAccess(link.sourceType, link.sourceId, user);
    }

    return link;
  }

  /**
   * Retrieves all links associated with an entity in either direction (as source or target).
   *
   * This method performs a bidirectional query, returning links where the specified entity
   * appears as either the source or target. This enables comprehensive relationship discovery
   * for dependency analysis and navigation features.
   *
   * Results are ordered by creation date (newest first) to show recent relationships at the
   * top. Access control is verified through the specified entity to ensure the user has
   * permission to view its relationships.
   *
   * Use this method when you need to see all relationships for an entity regardless of
   * direction. For directional queries (e.g., only outgoing dependencies), use the more
   * specific `findBySourceEntity` or `findByTargetEntity` methods.
   *
   * @param {string} entityType - Type of the entity ('encounter' or 'event')
   * @param {string} entityId - Unique identifier of the entity
   * @param {AuthenticatedUser} user - Authenticated user context for access control
   * @returns {Promise<PrismaLink[]>} Array of links involving the entity, ordered by creation date (desc)
   * @throws {NotFoundException} If the entity doesn't exist
   * @throws {ForbiddenException} If the user lacks campaign access
   * @throws {Error} If entityType is not 'encounter' or 'event'
   *
   * @example
   * ```typescript
   * // Get all links for an encounter (incoming and outgoing)
   * const allLinks = await linkService.findByEntity('encounter', 'encounter-123', user);
   * console.log(`Found ${allLinks.length} total relationships`);
   * ```
   */
  async findByEntity(
    entityType: string,
    entityId: string,
    user: AuthenticatedUser
  ): Promise<PrismaLink[]> {
    // Verify user has access to this entity
    await this.checkEntityAccess(entityType, entityId, user);

    return this.prisma.link.findMany({
      where: {
        OR: [
          { sourceType: entityType, sourceId: entityId },
          { targetType: entityType, targetId: entityId },
        ],
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Retrieves all links where the specified entity is the source (outgoing links).
   *
   * This method returns only outgoing relationships from the specified entity, useful for
   * finding dependencies, prerequisites, or other entities that this entity affects or
   * relates to. For example, if an encounter "depends_on" an event, the encounter is the
   * source and the event is the target.
   *
   * Results are ordered by creation date (newest first). This directional query is ideal
   * for dependency analysis, showing what this entity depends on or enables.
   *
   * @param {string} sourceType - Type of the source entity ('encounter' or 'event')
   * @param {string} sourceId - Unique identifier of the source entity
   * @param {AuthenticatedUser} user - Authenticated user context for access control
   * @returns {Promise<PrismaLink[]>} Array of outgoing links, ordered by creation date (desc)
   * @throws {NotFoundException} If the entity doesn't exist
   * @throws {ForbiddenException} If the user lacks campaign access
   * @throws {Error} If sourceType is not 'encounter' or 'event'
   *
   * @example
   * ```typescript
   * // Get all dependencies for an encounter
   * const dependencies = await linkService.findBySourceEntity('encounter', 'encounter-123', user);
   * const dependsOnLinks = dependencies.filter(link => link.linkType === 'depends_on');
   * console.log(`This encounter depends on ${dependsOnLinks.length} other entities`);
   * ```
   */
  async findBySourceEntity(
    sourceType: string,
    sourceId: string,
    user: AuthenticatedUser
  ): Promise<PrismaLink[]> {
    // Verify user has access to this entity
    await this.checkEntityAccess(sourceType, sourceId, user);

    return this.prisma.link.findMany({
      where: {
        sourceType,
        sourceId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Retrieves all links where the specified entity is the target (incoming links).
   *
   * This method returns only incoming relationships to the specified entity, useful for
   * finding what depends on this entity or what this entity enables. For example, if an
   * encounter "depends_on" this event, the event is the target and receives the incoming
   * dependency link.
   *
   * Results are ordered by creation date (newest first). This directional query is ideal
   * for reverse dependency analysis, showing what depends on or is enabled by this entity.
   *
   * @param {string} targetType - Type of the target entity ('encounter' or 'event')
   * @param {string} targetId - Unique identifier of the target entity
   * @param {AuthenticatedUser} user - Authenticated user context for access control
   * @returns {Promise<PrismaLink[]>} Array of incoming links, ordered by creation date (desc)
   * @throws {NotFoundException} If the entity doesn't exist
   * @throws {ForbiddenException} If the user lacks campaign access
   * @throws {Error} If targetType is not 'encounter' or 'event'
   *
   * @example
   * ```typescript
   * // Find what depends on this event
   * const dependents = await linkService.findByTargetEntity('event', 'event-456', user);
   * const blockedEncounters = dependents.filter(link =>
   *   link.linkType === 'depends_on' && link.sourceType === 'encounter'
   * );
   * console.log(`${blockedEncounters.length} encounters depend on this event`);
   * ```
   */
  async findByTargetEntity(
    targetType: string,
    targetId: string,
    user: AuthenticatedUser
  ): Promise<PrismaLink[]> {
    // Verify user has access to this entity
    await this.checkEntityAccess(targetType, targetId, user);

    return this.prisma.link.findMany({
      where: {
        targetType,
        targetId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Creates a new directed link between two entities with validation and duplicate prevention.
   *
   * This method establishes a directed relationship from a source entity to a target entity,
   * ensuring both entities exist, belong to the same campaign, and the user has access to both.
   * It prevents duplicate links by checking for existing links with the same source, target,
   * and link type combination.
   *
   * The link type categorizes the relationship (e.g., "depends_on", "enables", "related_to")
   * and can be any string value. Applications can define custom link types for specific
   * relationship semantics.
   *
   * Validation includes:
   * - Both entities must exist and be non-deleted
   * - User must have campaign access to both entities
   * - Entities must belong to the same campaign (cross-campaign links forbidden)
   * - No duplicate links (same source, target, and type)
   *
   * All link creations are automatically logged to the audit trail for compliance tracking.
   *
   * @param {CreateLinkInput} input - Link creation data including source, target, type, and optional description
   * @param {AuthenticatedUser} user - Authenticated user context for access control and audit logging
   * @returns {Promise<PrismaLink>} The newly created link record
   * @throws {NotFoundException} If either entity doesn't exist
   * @throws {ForbiddenException} If the user lacks campaign access to either entity
   * @throws {Error} If entities belong to different campaigns
   * @throws {Error} If a link with the same source, target, and type already exists
   * @throws {Error} If entityType is not 'encounter' or 'event'
   *
   * @example
   * ```typescript
   * // Create a dependency link
   * const link = await linkService.create({
   *   sourceType: 'encounter',
   *   sourceId: 'encounter-123',
   *   targetType: 'event',
   *   targetId: 'event-456',
   *   linkType: 'depends_on',
   *   description: 'Quest requires previous event completion'
   * }, user);
   *
   * // Create an enabling relationship
   * const enableLink = await linkService.create({
   *   sourceType: 'event',
   *   sourceId: 'event-789',
   *   targetType: 'encounter',
   *   targetId: 'encounter-123',
   *   linkType: 'enables'
   * }, user);
   * ```
   */
  async create(input: CreateLinkInput, user: AuthenticatedUser): Promise<PrismaLink> {
    // Verify both entities exist and user has access
    await this.checkEntityAccess(input.sourceType, input.sourceId, user);
    await this.checkEntityAccess(input.targetType, input.targetId, user);

    // Verify entities belong to the same campaign
    await this.verifySameCampaign(
      input.sourceType,
      input.sourceId,
      input.targetType,
      input.targetId
    );

    // Check for duplicate link (same source, target, and linkType)
    const existingLink = await this.prisma.link.findFirst({
      where: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        targetType: input.targetType,
        targetId: input.targetId,
        linkType: input.linkType,
        deletedAt: null,
      },
    });

    if (existingLink) {
      throw new Error('A link with this type already exists between these entities');
    }

    const link = await this.prisma.link.create({
      data: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        targetType: input.targetType,
        targetId: input.targetId,
        linkType: input.linkType,
        description: input.description ?? null,
      },
    });

    // Create audit entry
    await this.audit.log('link', link.id, 'CREATE', user.id, {
      sourceType: link.sourceType,
      sourceId: link.sourceId,
      targetType: link.targetType,
      targetId: link.targetId,
      linkType: link.linkType,
      description: link.description,
    });

    return link;
  }

  /**
   * Updates an existing link's type or description with access control verification.
   *
   * This method allows modification of a link's type (e.g., changing from "related_to"
   * to "depends_on") or its description. The source and target entities cannot be changed;
   * to link different entities, delete the old link and create a new one.
   *
   * Only provided fields in the input are updated; undefined fields are left unchanged.
   * Access control is verified through the link's source entity to ensure the user has
   * permission to modify relationships in that campaign.
   *
   * All updates are automatically logged to the audit trail for compliance tracking.
   *
   * @param {string} id - Unique identifier of the link to update
   * @param {UpdateLinkInput} input - Update data containing linkType and/or description
   * @param {AuthenticatedUser} user - Authenticated user context for access control and audit logging
   * @returns {Promise<PrismaLink>} The updated link record
   * @throws {NotFoundException} If the link doesn't exist or was deleted
   * @throws {ForbiddenException} If the user lacks campaign access
   *
   * @example
   * ```typescript
   * // Change link type from related_to to depends_on
   * const updated = await linkService.update('link-123', {
   *   linkType: 'depends_on',
   *   description: 'Updated: Quest now requires event completion'
   * }, user);
   *
   * // Update only the description
   * const withNewDesc = await linkService.update('link-123', {
   *   description: 'Clarified dependency relationship'
   * }, user);
   * ```
   */
  async update(id: string, input: UpdateLinkInput, user: AuthenticatedUser): Promise<PrismaLink> {
    // Verify link exists and user has access
    const link = await this.findById(id, user);
    if (!link) {
      throw new NotFoundException(`Link with ID ${id} not found`);
    }

    // Build update data
    const updateData: Prisma.LinkUpdateInput = {};
    if (input.linkType !== undefined) updateData.linkType = input.linkType;
    if (input.description !== undefined) updateData.description = input.description;

    // Update link
    const updated = await this.prisma.link.update({
      where: { id },
      data: updateData,
    });

    // Create audit entry
    await this.audit.log('link', id, 'UPDATE', user.id, updateData);

    return updated;
  }

  /**
   * Soft deletes a link, removing the relationship while preserving audit history.
   *
   * This method performs a soft deletion by setting the deletedAt timestamp, making the
   * link invisible to queries while preserving it in the database for audit purposes.
   * The link can be physically deleted later through database maintenance procedures.
   *
   * Access control is verified through the link's source entity to ensure the user has
   * permission to modify relationships in that campaign. Attempting to delete an already
   * deleted link will result in a NotFoundException.
   *
   * All deletions are automatically logged to the audit trail for compliance tracking.
   *
   * @param {string} id - Unique identifier of the link to delete
   * @param {AuthenticatedUser} user - Authenticated user context for access control and audit logging
   * @returns {Promise<PrismaLink>} The deleted link record with deletedAt timestamp set
   * @throws {NotFoundException} If the link doesn't exist or was already deleted
   * @throws {ForbiddenException} If the user lacks campaign access
   *
   * @example
   * ```typescript
   * // Remove a dependency link
   * const deleted = await linkService.delete('link-123', user);
   * console.log(`Link deleted at ${deleted.deletedAt}`);
   *
   * // Link is now invisible to queries
   * const notFound = await linkService.findById('link-123', user); // Returns null
   * ```
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaLink> {
    // Verify link exists and user has access
    const link = await this.findById(id, user);
    if (!link) {
      throw new NotFoundException(`Link with ID ${id} not found`);
    }

    const deletedAt = new Date();

    // Soft delete link
    const deleted = await this.prisma.link.update({
      where: { id },
      data: { deletedAt },
    });

    // Create audit entry
    await this.audit.log('link', id, 'DELETE', user.id, { deletedAt });

    return deleted;
  }

  /**
   * Verifies that the authenticated user has access to a specific entity through campaign membership.
   *
   * This private helper method performs entity existence validation and campaign-based access
   * control. It resolves the entity's campaign and checks if the user is either the campaign
   * owner or has an active membership.
   *
   * This method supports 'encounter' and 'event' entity types. Any other type will result
   * in an error. Only non-deleted entities are considered valid.
   *
   * @private
   * @param {string} entityType - Type of the entity ('encounter' or 'event')
   * @param {string} entityId - Unique identifier of the entity
   * @param {AuthenticatedUser} user - Authenticated user context for access verification
   * @returns {Promise<void>} Resolves if access is granted
   * @throws {NotFoundException} If the entity or its campaign doesn't exist or was deleted
   * @throws {ForbiddenException} If the user is neither the campaign owner nor a member
   * @throws {Error} If entityType is not 'encounter' or 'event'
   */
  private async checkEntityAccess(
    entityType: string,
    entityId: string,
    user: AuthenticatedUser
  ): Promise<void> {
    let campaignId: string | null = null;

    if (entityType === 'encounter') {
      const encounter = await this.prisma.encounter.findFirst({
        where: { id: entityId, deletedAt: null },
        select: { campaignId: true },
      });

      if (!encounter) {
        throw new NotFoundException(`Encounter with ID ${entityId} not found`);
      }

      campaignId = encounter.campaignId;
    } else if (entityType === 'event') {
      const event = await this.prisma.event.findFirst({
        where: { id: entityId, deletedAt: null },
        select: { campaignId: true },
      });

      if (!event) {
        throw new NotFoundException(`Event with ID ${entityId} not found`);
      }

      campaignId = event.campaignId;
    } else {
      throw new Error(`Unsupported entity type: ${entityType}`);
    }

    // Check campaign access
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, deletedAt: null },
      include: {
        memberships: {
          where: { userId: user.id },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign not found`);
    }

    // Check if user is owner or has membership
    if (campaign.ownerId !== user.id && campaign.memberships.length === 0) {
      throw new ForbiddenException('You do not have access to this campaign');
    }
  }

  /**
   * Verifies that two entities belong to the same campaign, preventing cross-campaign links.
   *
   * This private helper method resolves the campaign ID for both the source and target
   * entities, then compares them to ensure they match. Cross-campaign links are forbidden
   * to maintain data integrity and prevent unauthorized access to campaign data.
   *
   * This method supports 'encounter' and 'event' entity types for both source and target.
   * It assumes the entities have already been validated to exist through checkEntityAccess.
   *
   * @private
   * @param {string} sourceType - Type of the source entity ('encounter' or 'event')
   * @param {string} sourceId - Unique identifier of the source entity
   * @param {string} targetType - Type of the target entity ('encounter' or 'event')
   * @param {string} targetId - Unique identifier of the target entity
   * @returns {Promise<void>} Resolves if both entities belong to the same campaign
   * @throws {Error} If the entities belong to different campaigns
   * @throws {Error} If either entity cannot be found (should be caught by checkEntityAccess first)
   */
  private async verifySameCampaign(
    sourceType: string,
    sourceId: string,
    targetType: string,
    targetId: string
  ): Promise<void> {
    let sourceCampaignId: string | null = null;
    let targetCampaignId: string | null = null;

    // Get source campaign
    if (sourceType === 'encounter') {
      const encounter = await this.prisma.encounter.findUnique({
        where: { id: sourceId },
        select: { campaignId: true },
      });
      sourceCampaignId = encounter?.campaignId ?? null;
    } else if (sourceType === 'event') {
      const event = await this.prisma.event.findUnique({
        where: { id: sourceId },
        select: { campaignId: true },
      });
      sourceCampaignId = event?.campaignId ?? null;
    }

    // Get target campaign
    if (targetType === 'encounter') {
      const encounter = await this.prisma.encounter.findUnique({
        where: { id: targetId },
        select: { campaignId: true },
      });
      targetCampaignId = encounter?.campaignId ?? null;
    } else if (targetType === 'event') {
      const event = await this.prisma.event.findUnique({
        where: { id: targetId },
        select: { campaignId: true },
      });
      targetCampaignId = event?.campaignId ?? null;
    }

    if (sourceCampaignId !== targetCampaignId) {
      throw new Error('Cannot link entities from different campaigns');
    }
  }
}
