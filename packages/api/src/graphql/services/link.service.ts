/**
 * Link Service
 * Handles creating and querying links between Encounters and Events
 */

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Link as PrismaLink, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import type { CreateLinkInput, UpdateLinkInput } from '../inputs/link.input';

import { AuditService } from './audit.service';

@Injectable()
export class LinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Find link by ID
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
   * Find all links for an entity (as source or target)
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
   * Find all links where an entity is the source
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
   * Find all links where an entity is the target
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
   * Create a new link between entities
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
   * Update a link
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
   * Soft delete a link
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
   * Check if user has access to an entity
   * Private helper method
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
   * Verify that both entities belong to the same campaign
   * Private helper method
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
