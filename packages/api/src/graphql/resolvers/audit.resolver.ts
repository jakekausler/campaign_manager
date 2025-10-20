/**
 * Audit Resolver
 * GraphQL resolvers for Audit queries
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Audit } from '../types/audit.type';

@Resolver(() => Audit)
export class AuditResolver {
  constructor(private readonly prisma: PrismaService) {}

  @Query(() => [Audit], {
    description: 'Get audit history for an entity',
  })
  @UseGuards(JwtAuthGuard)
  async entityAuditHistory(
    @Args('entityType') entityType: string,
    @Args('entityId', { type: () => ID }) entityId: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 })
    limit: number,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Audit[]> {
    // Validate entityType against whitelist
    const ALLOWED_ENTITY_TYPES = ['Settlement', 'Structure', 'Character', 'Event', 'Encounter'];
    if (!ALLOWED_ENTITY_TYPES.includes(entityType)) {
      throw new Error(`Invalid entity type: ${entityType}`);
    }

    // Verify user has permission to view this entity's audit history
    // by checking campaign membership
    let campaignId: string | null = null;

    if (entityType === 'Settlement') {
      const settlement = await this.prisma.settlement.findUnique({
        where: { id: entityId },
        select: { kingdom: { select: { campaignId: true } } },
      });
      campaignId = settlement?.kingdom.campaignId ?? null;
    } else if (entityType === 'Structure') {
      const structure = await this.prisma.structure.findUnique({
        where: { id: entityId },
        select: { settlement: { select: { kingdom: { select: { campaignId: true } } } } },
      });
      campaignId = structure?.settlement.kingdom.campaignId ?? null;
    } else if (entityType === 'Character') {
      const character = await this.prisma.character.findUnique({
        where: { id: entityId },
        select: { campaignId: true },
      });
      campaignId = character?.campaignId ?? null;
    } else if (entityType === 'Event') {
      const event = await this.prisma.event.findUnique({
        where: { id: entityId },
        select: { campaignId: true },
      });
      campaignId = event?.campaignId ?? null;
    } else if (entityType === 'Encounter') {
      const encounter = await this.prisma.encounter.findUnique({
        where: { id: entityId },
        select: { campaignId: true },
      });
      campaignId = encounter?.campaignId ?? null;
    }

    if (!campaignId) {
      throw new Error('Entity not found');
    }

    // Verify user has access to the campaign (owner or member)
    const hasAccess = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        OR: [
          { ownerId: user.id },
          {
            memberships: {
              some: { userId: user.id },
            },
          },
        ],
      },
    });

    if (!hasAccess) {
      throw new Error('Access denied');
    }

    const audits = await this.prisma.audit.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: Math.min(limit, 100), // Cap at 100 to prevent excessive data retrieval
    });

    return audits.map((audit) => ({
      ...audit,
      changes: audit.changes as Record<string, unknown>,
      metadata: audit.metadata as Record<string, unknown>,
    }));
  }

  @Query(() => [Audit], {
    description: 'Get recent audit entries for a user',
  })
  @UseGuards(JwtAuthGuard)
  async userAuditHistory(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 })
    limit: number,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Audit[]> {
    // Users can only view their own audit history unless they have admin role
    // TODO: Add role-based authorization for viewing other users' history
    if (userId !== user.id) {
      throw new Error('Access denied');
    }

    const audits = await this.prisma.audit.findMany({
      where: {
        userId,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: Math.min(limit, 100),
    });

    return audits.map((audit) => ({
      ...audit,
      changes: audit.changes as Record<string, unknown>,
      metadata: audit.metadata as Record<string, unknown>,
    }));
  }
}
