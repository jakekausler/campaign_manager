/**
 * @fileoverview Campaign Membership Service
 *
 * Manages campaign membership, role assignments, and access control for users within campaigns.
 * Provides methods for adding/removing members, checking permissions, and enforcing role-based
 * access control across the campaign management system.
 *
 * Key responsibilities:
 * - Member lifecycle management (add, remove, update role)
 * - Role-based permission checking (owner, GM, player, viewer)
 * - Access control enforcement for edit and view operations
 * - Campaign membership queries and validation
 *
 * Role hierarchy:
 * - OWNER: Full control including member management
 * - GM: Can edit campaign content
 * - PLAYER: Can view and interact with campaign
 * - VIEWER: Read-only access to campaign
 */

import { Injectable, ForbiddenException } from '@nestjs/common';
import { CampaignRole } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

/**
 * Service for managing campaign memberships and role-based access control.
 *
 * Handles all operations related to user participation in campaigns, including
 * membership CRUD operations, role assignments, and permission validation.
 * Enforces access control policies based on campaign roles.
 */
@Injectable()
export class CampaignMembershipService {
  constructor(private prisma: PrismaService) {}

  /**
   * Adds a user to a campaign with a specified role and permissions.
   *
   * Creates a new campaign membership record, establishing the user's role and
   * permission set within the campaign. This operation does not perform authorization
   * checks - callers must ensure the requesting user has permission to add members.
   *
   * @param campaignId - The ID of the campaign to add the member to
   * @param userId - The ID of the user being added as a member
   * @param role - The campaign role to assign (OWNER, GM, PLAYER, or VIEWER)
   * @param permissions - Optional array of specific permission strings for fine-grained access control
   * @returns Promise resolving to the created campaign membership record
   * @throws {Prisma.PrismaClientKnownRequestError} If the membership already exists (unique constraint violation)
   *
   * @example
   * ```typescript
   * const membership = await membershipService.addMember(
   *   'campaign-123',
   *   'user-456',
   *   CampaignRole.PLAYER,
   *   ['view:npcs', 'view:locations']
   * );
   * ```
   */
  async addMember(
    campaignId: string,
    userId: string,
    role: CampaignRole,
    permissions: string[] = []
  ) {
    return this.prisma.campaignMembership.create({
      data: {
        campaignId,
        userId,
        role,
        permissions,
      },
    });
  }

  /**
   * Retrieves a user's role in a specific campaign.
   *
   * Queries the campaign membership to determine what role, if any, a user has
   * within a campaign. Returns null if the user is not a member of the campaign.
   *
   * @param campaignId - The ID of the campaign to check membership in
   * @param userId - The ID of the user whose role to retrieve
   * @returns Promise resolving to the user's CampaignRole or null if not a member
   *
   * @example
   * ```typescript
   * const role = await membershipService.getUserRole('campaign-123', 'user-456');
   * if (role === CampaignRole.OWNER) {
   *   // User has owner privileges
   * }
   * ```
   */
  async getUserRole(campaignId: string, userId: string): Promise<CampaignRole | null> {
    const membership = await this.prisma.campaignMembership.findUnique({
      where: {
        userId_campaignId: {
          userId,
          campaignId,
        },
      },
    });

    return membership ? membership.role : null;
  }

  /**
   * Retrieves all campaigns a user is a member of.
   *
   * Returns all campaign memberships for a user, including full campaign details.
   * Useful for displaying a user's campaign list and determining which campaigns
   * they have access to.
   *
   * @param userId - The ID of the user whose campaigns to retrieve
   * @returns Promise resolving to array of membership records with campaign details included
   *
   * @example
   * ```typescript
   * const memberships = await membershipService.getUserCampaigns('user-456');
   * memberships.forEach(membership => {
   *   console.log(`${membership.campaign.name} - Role: ${membership.role}`);
   * });
   * ```
   */
  async getUserCampaigns(userId: string) {
    return this.prisma.campaignMembership.findMany({
      where: { userId },
      include: {
        campaign: true,
      },
    });
  }

  /**
   * Retrieves all members of a specific campaign.
   *
   * Returns all membership records for a campaign, including basic user information
   * (id, email, name). Excludes sensitive user data like password hashes. Useful for
   * displaying campaign member lists and managing access control.
   *
   * @param campaignId - The ID of the campaign whose members to retrieve
   * @returns Promise resolving to array of membership records with user details included
   *
   * @example
   * ```typescript
   * const members = await membershipService.getCampaignMembers('campaign-123');
   * members.forEach(membership => {
   *   console.log(`${membership.user.name} - ${membership.role}`);
   * });
   * ```
   */
  async getCampaignMembers(campaignId: string) {
    return this.prisma.campaignMembership.findMany({
      where: { campaignId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Updates a user's role in a campaign.
   *
   * Changes the role assigned to a campaign member. Enforces authorization by
   * requiring the requesting user to be the campaign owner. This prevents
   * non-owners from escalating privileges or demoting other members.
   *
   * @param campaignId - The ID of the campaign containing the membership
   * @param userId - The ID of the user whose role to update
   * @param role - The new campaign role to assign
   * @param requestingUserId - The ID of the user making the role change request
   * @returns Promise resolving to the updated campaign membership record
   * @throws {ForbiddenException} If the requesting user is not the campaign owner
   * @throws {Prisma.PrismaClientKnownRequestError} If the membership does not exist
   *
   * @example
   * ```typescript
   * await membershipService.updateMemberRole(
   *   'campaign-123',
   *   'user-456',
   *   CampaignRole.GM,
   *   'owner-789'
   * );
   * ```
   */
  async updateMemberRole(
    campaignId: string,
    userId: string,
    role: CampaignRole,
    requestingUserId: string
  ) {
    // Check if requesting user is owner
    await this.ensureUserHasRole(campaignId, requestingUserId, [CampaignRole.OWNER]);

    return this.prisma.campaignMembership.update({
      where: {
        userId_campaignId: {
          userId,
          campaignId,
        },
      },
      data: { role },
    });
  }

  /**
   * Removes a user from a campaign.
   *
   * Deletes a campaign membership, revoking the user's access to the campaign.
   * Enforces authorization by requiring the requesting user to be the campaign owner.
   * Prevents the owner from removing themselves to maintain campaign ownership integrity.
   *
   * @param campaignId - The ID of the campaign to remove the member from
   * @param userId - The ID of the user to remove
   * @param requestingUserId - The ID of the user making the removal request
   * @returns Promise resolving to the deleted campaign membership record
   * @throws {ForbiddenException} If the requesting user is not the campaign owner
   * @throws {ForbiddenException} If the owner attempts to remove themselves
   * @throws {Prisma.PrismaClientKnownRequestError} If the membership does not exist
   *
   * @example
   * ```typescript
   * await membershipService.removeMember(
   *   'campaign-123',
   *   'user-456',
   *   'owner-789'
   * );
   * ```
   */
  async removeMember(campaignId: string, userId: string, requestingUserId: string) {
    // Check if requesting user is owner
    await this.ensureUserHasRole(campaignId, requestingUserId, [CampaignRole.OWNER]);

    // Don't allow owner to remove themselves
    if (userId === requestingUserId) {
      throw new ForbiddenException('Campaign owner cannot remove themselves');
    }

    return this.prisma.campaignMembership.delete({
      where: {
        userId_campaignId: {
          userId,
          campaignId,
        },
      },
    });
  }

  /**
   * Checks if a user has one of the specified roles in a campaign.
   *
   * Permission checking method that verifies if a user's role matches any of the
   * allowed roles. Returns false if the user is not a member of the campaign.
   * This is a non-throwing check suitable for conditional logic.
   *
   * @param campaignId - The ID of the campaign to check membership in
   * @param userId - The ID of the user whose role to check
   * @param roles - Array of acceptable roles for the check
   * @returns Promise resolving to true if user has one of the specified roles, false otherwise
   *
   * @example
   * ```typescript
   * const canModify = await membershipService.userHasRole(
   *   'campaign-123',
   *   'user-456',
   *   [CampaignRole.OWNER, CampaignRole.GM]
   * );
   * if (canModify) {
   *   // Allow modification
   * }
   * ```
   */
  async userHasRole(campaignId: string, userId: string, roles: CampaignRole[]): Promise<boolean> {
    const userRole = await this.getUserRole(campaignId, userId);
    return userRole ? roles.includes(userRole) : false;
  }

  /**
   * Ensures a user has one of the required roles, throwing an exception if not.
   *
   * Authorization enforcement method that verifies a user's role and throws a
   * ForbiddenException if the user doesn't have one of the acceptable roles.
   * Use this method to guard protected operations that require specific roles.
   *
   * @param campaignId - The ID of the campaign to check membership in
   * @param userId - The ID of the user whose role to verify
   * @param roles - Array of acceptable roles for authorization
   * @returns Promise resolving to void if authorization succeeds
   * @throws {ForbiddenException} If user does not have one of the required roles or is not a member
   *
   * @example
   * ```typescript
   * // Guard an operation that requires owner or GM role
   * await membershipService.ensureUserHasRole(
   *   'campaign-123',
   *   'user-456',
   *   [CampaignRole.OWNER, CampaignRole.GM]
   * );
   * // Operation only proceeds if user has required role
   * ```
   */
  async ensureUserHasRole(
    campaignId: string,
    userId: string,
    roles: CampaignRole[]
  ): Promise<void> {
    const hasRole = await this.userHasRole(campaignId, userId, roles);
    if (!hasRole) {
      throw new ForbiddenException(`User does not have required role in this campaign`);
    }
  }

  /**
   * Checks if a user has edit permissions for a campaign.
   *
   * Convenience method that checks if a user has a role that grants edit access.
   * Edit permissions are granted to OWNER and GM roles, allowing them to modify
   * campaign content, entities, and settings.
   *
   * @param campaignId - The ID of the campaign to check edit permissions for
   * @param userId - The ID of the user whose edit permissions to check
   * @returns Promise resolving to true if user can edit the campaign, false otherwise
   *
   * @example
   * ```typescript
   * if (await membershipService.canEdit('campaign-123', 'user-456')) {
   *   // Allow campaign modifications
   * } else {
   *   // Show read-only view
   * }
   * ```
   */
  async canEdit(campaignId: string, userId: string): Promise<boolean> {
    return this.userHasRole(campaignId, userId, [CampaignRole.OWNER, CampaignRole.GM]);
  }

  /**
   * Checks if a user has view permissions for a campaign.
   *
   * Convenience method that checks if a user has any role that grants view access.
   * View permissions are granted to all campaign roles (OWNER, GM, PLAYER, VIEWER),
   * allowing them to read campaign content. This is the minimum permission check
   * for accessing campaign data.
   *
   * @param campaignId - The ID of the campaign to check view permissions for
   * @param userId - The ID of the user whose view permissions to check
   * @returns Promise resolving to true if user can view the campaign, false otherwise
   *
   * @example
   * ```typescript
   * if (await membershipService.canView('campaign-123', 'user-456')) {
   *   // Allow access to campaign data
   * } else {
   *   throw new ForbiddenException('No access to this campaign');
   * }
   * ```
   */
  async canView(campaignId: string, userId: string): Promise<boolean> {
    return this.userHasRole(campaignId, userId, [
      CampaignRole.OWNER,
      CampaignRole.GM,
      CampaignRole.PLAYER,
      CampaignRole.VIEWER,
    ]);
  }
}
