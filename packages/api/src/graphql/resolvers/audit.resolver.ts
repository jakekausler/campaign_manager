/**
 * Audit Resolver
 * GraphQL resolvers for Audit queries
 */

import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Permission, PermissionsService } from '../../auth/services/permissions.service';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Audit } from '../types/audit.type';

@SkipThrottle()
@Resolver(() => Audit)
export class AuditResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService
  ) {}

  /**
   * Retrieves audit log history for a specific entity.
   *
   * Returns chronological audit entries showing all operations performed on an entity,
   * including complete before/after state snapshots and field-level diffs. Supports
   * advanced filtering by operation type, date range, and custom sorting.
   *
   * **Authorization:**
   * - User must be a member of the campaign containing the entity
   * - User must have `audit:read` permission (OWNER or GM roles)
   *
   * **Supported Entity Types:** Settlement, Structure, Character, Event, Encounter
   *
   * **Performance Notes:**
   * - Results are limited to 100 records maximum (enforced cap)
   * - Date range filtering recommended for large audit histories
   * - Includes campaign membership verification query
   *
   * @param user - The authenticated user requesting audit history
   * @param entityType - Type of entity (must be in allowed whitelist)
   * @param entityId - Unique identifier of the entity
   * @param limit - Maximum number of records to return (default: 50, max: 100)
   * @param operations - Filter by operation types (e.g., ['create', 'update'])
   * @param startDate - Filter entries on or after this date
   * @param endDate - Filter entries on or before this date
   * @param sortBy - Field to sort by ('timestamp', 'operation', 'entityType')
   * @param sortOrder - Sort direction ('asc' or 'desc', default: 'desc')
   *
   * @returns Array of audit entries sorted by specified criteria
   *
   * @throws {Error} If entityType is not in the allowed whitelist
   * @throws {UnauthorizedException} If user is not a campaign member or lacks audit:read permission
   *
   * @see {@link PermissionsService.hasPermission} for permission checking logic
   * @see docs/features/audit-log.md for audit log system overview
   *
   * @example
   * ```graphql
   * query {
   *   entityAuditHistory(
   *     entityType: "Settlement"
   *     entityId: "settlement-123"
   *     limit: 20
   *     operations: ["update", "archive"]
   *     startDate: "2024-01-01T00:00:00Z"
   *     sortBy: "timestamp"
   *     sortOrder: "desc"
   *   ) {
   *     timestamp
   *     operation
   *     userId
   *     changes
   *     previousState
   *     newState
   *     diff
   *   }
   * }
   * ```
   */
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

  /**
   * Retrieves audit log history for a specific user's activities.
   *
   * Returns all operations performed by a user across all campaigns they have access to.
   * Useful for reviewing a user's activity timeline, compliance auditing, and
   * investigating changes. Supports pagination, filtering, and custom sorting.
   *
   * **Authorization:**
   * - Users can only view their own audit history (user.id === userId)
   * - User must have `audit:read` permission in at least one campaign (OWNER or GM role)
   *
   * **Performance Notes:**
   * - Supports cursor-based pagination with skip/limit
   * - Skip parameter limited to 100,000 to prevent abuse
   * - Results capped at 100 records per request
   *
   * **Security:**
   * - TODO: Add admin role support for viewing other users' histories
   * - Currently restricted to self-viewing only
   *
   * @param user - The authenticated user requesting audit history
   * @param userId - ID of user whose history to retrieve (must match authenticated user)
   * @param limit - Maximum number of records to return (default: 50, max: 100)
   * @param skip - Number of records to skip for pagination (default: 0, max: 100,000)
   * @param operations - Filter by operation types (e.g., ['create', 'delete'])
   * @param entityTypes - Filter by entity types (e.g., ['Settlement', 'Event'])
   * @param startDate - Filter entries on or after this date
   * @param endDate - Filter entries on or before this date
   * @param sortBy - Field to sort by ('timestamp', 'operation', 'entityType')
   * @param sortOrder - Sort direction ('asc' or 'desc', default: 'desc')
   *
   * @returns Array of audit entries for the user's activities
   *
   * @throws {UnauthorizedException} If userId doesn't match authenticated user
   * @throws {UnauthorizedException} If user lacks audit:read permission in any campaign
   * @throws {Error} If skip parameter is outside valid range (0-100,000)
   *
   * @see {@link PermissionsService} for permission checking details
   * @see docs/api/queries.md#audit-queries for usage examples
   *
   * @example
   * ```graphql
   * query {
   *   userAuditHistory(
   *     userId: "user-123"
   *     limit: 50
   *     skip: 0
   *     entityTypes: ["Settlement", "Event"]
   *     startDate: "2024-01-01T00:00:00Z"
   *     sortBy: "timestamp"
   *     sortOrder: "desc"
   *   ) {
   *     timestamp
   *     operation
   *     entityType
   *     entityId
   *     changes
   *   }
   * }
   * ```
   */
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
