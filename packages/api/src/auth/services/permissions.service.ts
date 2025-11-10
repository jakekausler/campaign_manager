/**
 * @fileoverview Permissions service for managing role-based access control (RBAC)
 * within campaigns. Provides permission checking logic for all campaign entities
 * and operations.
 *
 * This service implements a hierarchical permission system:
 * - OWNER: Full access including deletion and member management
 * - GM: Read/write access to all campaign content
 * - PLAYER: Read access plus own character editing
 * - VIEWER: Read-only access to public content
 *
 * @module auth/services/permissions
 */

import { Injectable } from '@nestjs/common';
import { CampaignRole } from '@prisma/client';

import { CampaignMembershipService } from './campaign-membership.service';

/**
 * Enumeration of all available permissions in the system.
 * Permissions are scoped by resource type and operation (read/write/delete).
 *
 * @enum {string}
 */
export enum Permission {
  // Campaign permissions
  CAMPAIGN_READ = 'campaign:read',
  CAMPAIGN_WRITE = 'campaign:write',
  CAMPAIGN_DELETE = 'campaign:delete',
  CAMPAIGN_MANAGE_MEMBERS = 'campaign:manage_members',

  // Character permissions
  CHARACTER_READ = 'character:read',
  CHARACTER_WRITE = 'character:write',
  CHARACTER_DELETE = 'character:delete',

  // Event permissions
  EVENT_READ = 'event:read',
  EVENT_WRITE = 'event:write',
  EVENT_DELETE = 'event:delete',

  // Kingdom permissions
  KINGDOM_READ = 'kingdom:read',
  KINGDOM_WRITE = 'kingdom:write',
  KINGDOM_DELETE = 'kingdom:delete',

  // Encounter permissions
  ENCOUNTER_READ = 'encounter:read',
  ENCOUNTER_WRITE = 'encounter:write',
  ENCOUNTER_DELETE = 'encounter:delete',

  // Branch permissions
  BRANCH_READ = 'branch:read',
  BRANCH_CREATE = 'branch:create',
  BRANCH_WRITE = 'branch:write',
  BRANCH_DELETE = 'branch:delete',

  // Audit permissions
  AUDIT_READ = 'audit:read',
  AUDIT_EXPORT = 'audit:export',
}

/**
 * Maps campaign roles to their allowed permissions.
 * Defines the complete permission set for each role level.
 *
 * @const
 * @type {Record<CampaignRole, Permission[]>}
 */
const ROLE_PERMISSIONS: Record<CampaignRole, Permission[]> = {
  [CampaignRole.OWNER]: [
    // Full access to everything
    Permission.CAMPAIGN_READ,
    Permission.CAMPAIGN_WRITE,
    Permission.CAMPAIGN_DELETE,
    Permission.CAMPAIGN_MANAGE_MEMBERS,
    Permission.CHARACTER_READ,
    Permission.CHARACTER_WRITE,
    Permission.CHARACTER_DELETE,
    Permission.EVENT_READ,
    Permission.EVENT_WRITE,
    Permission.EVENT_DELETE,
    Permission.KINGDOM_READ,
    Permission.KINGDOM_WRITE,
    Permission.KINGDOM_DELETE,
    Permission.ENCOUNTER_READ,
    Permission.ENCOUNTER_WRITE,
    Permission.ENCOUNTER_DELETE,
    Permission.BRANCH_READ,
    Permission.BRANCH_CREATE,
    Permission.BRANCH_WRITE,
    Permission.BRANCH_DELETE,
    Permission.AUDIT_READ,
    Permission.AUDIT_EXPORT,
  ],
  [CampaignRole.GM]: [
    // Read/write access, but no delete or member management
    Permission.CAMPAIGN_READ,
    Permission.CAMPAIGN_WRITE,
    Permission.CHARACTER_READ,
    Permission.CHARACTER_WRITE,
    Permission.EVENT_READ,
    Permission.EVENT_WRITE,
    Permission.KINGDOM_READ,
    Permission.KINGDOM_WRITE,
    Permission.ENCOUNTER_READ,
    Permission.ENCOUNTER_WRITE,
    Permission.BRANCH_READ,
    Permission.BRANCH_CREATE,
    Permission.BRANCH_WRITE,
    Permission.AUDIT_READ,
    Permission.AUDIT_EXPORT,
  ],
  [CampaignRole.PLAYER]: [
    // Read access + own character edit
    Permission.CAMPAIGN_READ,
    Permission.CHARACTER_READ,
    Permission.EVENT_READ,
    Permission.KINGDOM_READ,
    Permission.ENCOUNTER_READ,
    Permission.BRANCH_READ,
  ],
  [CampaignRole.VIEWER]: [
    // Read-only access to public content
    Permission.CAMPAIGN_READ,
    Permission.CHARACTER_READ,
    Permission.EVENT_READ,
    Permission.BRANCH_READ,
  ],
};

/**
 * Service for managing role-based access control (RBAC) within campaigns.
 *
 * Provides methods to check user permissions based on their campaign role.
 * Supports both individual permission checks and bulk permission validation.
 * All permission checks are campaign-scoped and require valid membership.
 *
 * @class PermissionsService
 * @injectable
 */
@Injectable()
export class PermissionsService {
  /**
   * Creates an instance of PermissionsService.
   *
   * @param {CampaignMembershipService} campaignMembershipService - Service for retrieving user roles in campaigns
   */
  constructor(private campaignMembershipService: CampaignMembershipService) {}

  /**
   * Retrieves all permissions granted to a user within a specific campaign.
   *
   * Returns the complete set of permissions based on the user's role in the campaign.
   * If the user is not a member of the campaign, returns an empty array.
   *
   * @param {string} campaignId - UUID of the campaign
   * @param {string} userId - UUID of the user
   * @returns {Promise<Permission[]>} Array of permissions granted to the user
   *
   * @example
   * ```typescript
   * const permissions = await permissionsService.getUserPermissions(
   *   'campaign-123',
   *   'user-456'
   * );
   * console.log(permissions); // [Permission.CAMPAIGN_READ, Permission.CHARACTER_READ, ...]
   * ```
   */
  async getUserPermissions(campaignId: string, userId: string): Promise<Permission[]> {
    const role = await this.campaignMembershipService.getUserRole(campaignId, userId);
    if (!role) {
      return [];
    }

    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Checks if a user has a specific permission within a campaign.
   *
   * Verifies that the user's role grants them the requested permission.
   * Returns false if the user is not a member or lacks the permission.
   *
   * @param {string} campaignId - UUID of the campaign
   * @param {string} userId - UUID of the user
   * @param {Permission} permission - The permission to check
   * @returns {Promise<boolean>} True if user has the permission, false otherwise
   *
   * @example
   * ```typescript
   * const canWrite = await permissionsService.hasPermission(
   *   'campaign-123',
   *   'user-456',
   *   Permission.CAMPAIGN_WRITE
   * );
   * if (!canWrite) {
   *   throw new ForbiddenException('Cannot modify campaign');
   * }
   * ```
   */
  async hasPermission(
    campaignId: string,
    userId: string,
    permission: Permission
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(campaignId, userId);
    return permissions.includes(permission);
  }

  /**
   * Checks if a user has all of the specified permissions within a campaign.
   *
   * Validates that the user's role grants every permission in the provided array.
   * Useful for operations that require multiple permissions simultaneously.
   *
   * @param {string} campaignId - UUID of the campaign
   * @param {string} userId - UUID of the user
   * @param {Permission[]} permissions - Array of permissions to check
   * @returns {Promise<boolean>} True if user has all permissions, false if missing any
   *
   * @example
   * ```typescript
   * const canManageCampaign = await permissionsService.hasAllPermissions(
   *   'campaign-123',
   *   'user-456',
   *   [Permission.CAMPAIGN_WRITE, Permission.CAMPAIGN_MANAGE_MEMBERS]
   * );
   * ```
   */
  async hasAllPermissions(
    campaignId: string,
    userId: string,
    permissions: Permission[]
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(campaignId, userId);
    return permissions.every((permission) => userPermissions.includes(permission));
  }

  /**
   * Checks if a user has at least one of the specified permissions within a campaign.
   *
   * Returns true if the user's role grants any permission in the provided array.
   * Useful for operations that can be performed with alternative permissions.
   *
   * @param {string} campaignId - UUID of the campaign
   * @param {string} userId - UUID of the user
   * @param {Permission[]} permissions - Array of permissions to check
   * @returns {Promise<boolean>} True if user has any of the permissions, false if none
   *
   * @example
   * ```typescript
   * const canViewContent = await permissionsService.hasAnyPermission(
   *   'campaign-123',
   *   'user-456',
   *   [Permission.CAMPAIGN_READ, Permission.EVENT_READ]
   * );
   * ```
   */
  async hasAnyPermission(
    campaignId: string,
    userId: string,
    permissions: Permission[]
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(campaignId, userId);
    return permissions.some((permission) => userPermissions.includes(permission));
  }

  /**
   * Checks if a user can edit their own character.
   *
   * **NOTE:** This is a placeholder implementation that always returns true.
   * Full implementation requires character ownership validation and will be
   * completed when the character module is implemented.
   *
   * The final implementation should:
   * 1. Verify the character exists and belongs to the user
   * 2. Check if the user has CHARACTER_WRITE permission in the campaign
   * 3. Validate the campaign membership is active
   *
   * @param {string} _characterId - UUID of the character (unused in placeholder)
   * @param {string} _userId - UUID of the user (unused in placeholder)
   * @returns {Promise<boolean>} Always returns true (placeholder behavior)
   *
   * @todo Implement full character ownership check when character module is available
   *
   * @example
   * ```typescript
   * const canEdit = await permissionsService.canEditOwnCharacter(
   *   'character-123',
   *   'user-456'
   * );
   * // Currently always returns true
   * ```
   */
  async canEditOwnCharacter(_characterId: string, _userId: string): Promise<boolean> {
    // This would need to check if the character belongs to the user
    // For now, we'll assume any player+ role can edit their own character
    // This should be implemented when we have the character module
    return true;
  }
}
