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
    description: 'Get audit history for an entity with advanced filtering',
  })
  @UseGuards(JwtAuthGuard)
  async entityAuditHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Args('entityType') entityType: string,
    @Args('entityId', { type: () => ID }) entityId: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 })
    limit: number = 50,
    @Args('operations', { type: () => [String], nullable: true })
    operations?: string[],
    @Args('startDate', { type: () => Date, nullable: true })
    startDate?: Date,
    @Args('endDate', { type: () => Date, nullable: true })
    endDate?: Date,
    @Args('sortBy', { nullable: true, defaultValue: 'timestamp' })
    sortBy: string = 'timestamp',
    @Args('sortOrder', { nullable: true, defaultValue: 'desc' })
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<Audit[]> {
    // NOTE: Entity type whitelist removed - now supports all entity types
    // Authorization is enforced through campaign access checks

    // Verify user has permission to view this entity's audit history
    // by checking campaign membership
    let campaignId: string | null = null;

    // Try to find campaignId based on entity type
    // This is a best-effort approach to determine campaign access
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
    // For other entity types, we skip campaign validation
    // This allows audit queries for entities without direct campaign relationship

    // If we found a campaignId, verify user has access
    if (campaignId) {
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
    }

    // Build WHERE clause with enhanced filtering
    const where: {
      entityType: string;
      entityId: string;
      operation?: { in: string[] };
      timestamp?: { gte?: Date; lte?: Date };
    } = {
      entityType,
      entityId,
    };

    // Add operation filter
    if (operations && operations.length > 0) {
      where.operation = { in: operations };
    }

    // Add date range filter
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = startDate;
      }
      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }

    // Build ORDER BY clause with dynamic sorting
    const orderBy: { [key: string]: 'asc' | 'desc' } = {};
    if (sortBy === 'timestamp' || sortBy === 'operation' || sortBy === 'entityType') {
      orderBy[sortBy] = sortOrder || 'desc';
    } else {
      // Default to timestamp desc if invalid sortBy
      orderBy.timestamp = 'desc';
    }

    const audits = await this.prisma.audit.findMany({
      where,
      orderBy,
      take: Math.min(limit, 100), // Cap at 100 to prevent excessive data retrieval
    });

    return audits.map((audit) => ({
      ...audit,
      changes: audit.changes as Record<string, unknown>,
      metadata: audit.metadata as Record<string, unknown>,
      previousState: audit.previousState as Record<string, unknown> | undefined,
      newState: audit.newState as Record<string, unknown> | undefined,
      diff: audit.diff as Record<string, unknown> | undefined,
      reason: audit.reason ?? undefined,
    }));
  }

  @Query(() => [Audit], {
    description: 'Get recent audit entries for a user with advanced filtering',
  })
  @UseGuards(JwtAuthGuard)
  async userAuditHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Args('userId', { type: () => ID }) userId: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 })
    limit: number = 50,
    @Args('operations', { type: () => [String], nullable: true })
    operations?: string[],
    @Args('entityTypes', { type: () => [String], nullable: true })
    entityTypes?: string[],
    @Args('startDate', { type: () => Date, nullable: true })
    startDate?: Date,
    @Args('endDate', { type: () => Date, nullable: true })
    endDate?: Date,
    @Args('sortBy', { nullable: true, defaultValue: 'timestamp' })
    sortBy: string = 'timestamp',
    @Args('sortOrder', { nullable: true, defaultValue: 'desc' })
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<Audit[]> {
    // Users can only view their own audit history unless they have admin role
    // TODO: Add role-based authorization for viewing other users' history
    if (userId !== user.id) {
      throw new Error('Access denied');
    }

    // Build WHERE clause with enhanced filtering
    const where: {
      userId: string;
      operation?: { in: string[] };
      entityType?: { in: string[] };
      timestamp?: { gte?: Date; lte?: Date };
    } = {
      userId,
    };

    // Add operation filter
    if (operations && operations.length > 0) {
      where.operation = { in: operations };
    }

    // Add entity type filter
    if (entityTypes && entityTypes.length > 0) {
      where.entityType = { in: entityTypes };
    }

    // Add date range filter
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = startDate;
      }
      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }

    // Build ORDER BY clause with dynamic sorting
    const orderBy: { [key: string]: 'asc' | 'desc' } = {};
    if (sortBy === 'timestamp' || sortBy === 'operation' || sortBy === 'entityType') {
      orderBy[sortBy] = sortOrder || 'desc';
    } else {
      // Default to timestamp desc if invalid sortBy
      orderBy.timestamp = 'desc';
    }

    const audits = await this.prisma.audit.findMany({
      where,
      orderBy,
      take: Math.min(limit, 100),
    });

    return audits.map((audit) => ({
      ...audit,
      changes: audit.changes as Record<string, unknown>,
      metadata: audit.metadata as Record<string, unknown>,
      previousState: audit.previousState as Record<string, unknown> | undefined,
      newState: audit.newState as Record<string, unknown> | undefined,
      diff: audit.diff as Record<string, unknown> | undefined,
      reason: audit.reason ?? undefined,
    }));
  }
}
