import { Injectable, ForbiddenException } from '@nestjs/common';
import { CampaignRole } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CampaignMembershipService {
  constructor(private prisma: PrismaService) {}

  /**
   * Add a user to a campaign with a specific role
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
   * Get user's role in a campaign
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
   * Get all campaigns a user belongs to
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
   * Get all members of a campaign
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
   * Update user's role in a campaign
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
   * Remove a user from a campaign
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
   * Check if user has one of the required roles in a campaign
   */
  async userHasRole(campaignId: string, userId: string, roles: CampaignRole[]): Promise<boolean> {
    const userRole = await this.getUserRole(campaignId, userId);
    return userRole ? roles.includes(userRole) : false;
  }

  /**
   * Ensure user has one of the required roles, throw error otherwise
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
   * Check if user can edit content in a campaign
   */
  async canEdit(campaignId: string, userId: string): Promise<boolean> {
    return this.userHasRole(campaignId, userId, [CampaignRole.OWNER, CampaignRole.GM]);
  }

  /**
   * Check if user can view content in a campaign
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
