/**
 * Audit Resolver
 * GraphQL resolvers for Audit queries
 */

import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Permission, PermissionsService } from '../../auth/services/permissions.service';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Audit } from '../types/audit.type';

@Resolver(() => Audit)
export class AuditResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService
  ) {}

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
    // Validate entityType against whitelist for security
    // Only entity types with proper campaign-based authorization are supported
    const ALLOWED_ENTITY_TYPES = ['Settlement', 'Structure', 'Character', 'Event', 'Encounter'];

    if (!ALLOWED_ENTITY_TYPES.includes(entityType)) {
      throw new Error(`Unsupported entity type: ${entityType}`);
    }

    // Verify user has permission to view this entity's audit history
    // by checking campaign membership
    let campaignId: string | null = null;

    // Find campaignId based on entity type
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
        throw new UnauthorizedException('Access denied: not a member of this campaign');
      }

      // Check if user has audit:read permission in this campaign
      const hasPermission = await this.permissionsService.hasPermission(
        campaignId,
        user.id,
        Permission.AUDIT_READ
      );

      if (!hasPermission) {
        throw new UnauthorizedException(
          'Access denied: insufficient permissions to view audit logs'
        );
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
    @Args('skip', { type: () => Int, nullable: true, defaultValue: 0 })
    skip: number = 0,
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
      throw new UnauthorizedException('Access denied: you can only view your own audit history');
    }

    // Check if user has audit:read permission in at least one campaign
    // Only OWNER and GM roles have audit:read permission, so check if user has either role
    // This optimizes performance by avoiding N+1 queries
    const hasAuditPermission = await this.prisma.campaign.findFirst({
      where: {
        OR: [
          // User is campaign owner (owners always have audit:read)
          { ownerId: user.id },
          // User is a GM in the campaign (GMs have audit:read)
          {
            memberships: {
              some: {
                userId: user.id,
                role: 'GM',
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    if (!hasAuditPermission) {
      throw new UnauthorizedException(
        'Access denied: you must be a campaign owner or GM to view audit logs'
      );
    }

    // Validate skip parameter to prevent abuse (max 100,000 records)
    // This prevents malicious users from scanning arbitrary portions of audit log
    if (skip < 0 || skip > 100000) {
      throw new Error('Invalid skip parameter: must be between 0 and 100,000');
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
      skip,
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
