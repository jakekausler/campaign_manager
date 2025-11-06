import { Injectable } from '@nestjs/common';
import { CampaignRole } from '@prisma/client';

import { CampaignMembershipService } from './campaign-membership.service';

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

// Define permissions for each role
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

@Injectable()
export class PermissionsService {
  constructor(private campaignMembershipService: CampaignMembershipService) {}

  /**
   * Get all permissions for a user in a campaign
   */
  async getUserPermissions(campaignId: string, userId: string): Promise<Permission[]> {
    const role = await this.campaignMembershipService.getUserRole(campaignId, userId);
    if (!role) {
      return [];
    }

    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Check if user has a specific permission in a campaign
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
   * Check if user has all of the specified permissions in a campaign
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
   * Check if user has any of the specified permissions in a campaign
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
   * Check if user can edit their own character
   */
  async canEditOwnCharacter(_characterId: string, _userId: string): Promise<boolean> {
    // This would need to check if the character belongs to the user
    // For now, we'll assume any player+ role can edit their own character
    // This should be implemented when we have the character module
    return true;
  }
}
