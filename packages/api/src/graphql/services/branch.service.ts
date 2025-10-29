/**
 * Branch Service
 * Business logic for Branch operations (alternate timeline management)
 * Implements CRUD with hierarchy traversal and validation
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { Branch as PrismaBranch } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import type {
  CreateBranchInput,
  UpdateBranchInput,
  BranchWhereInput,
} from '../inputs/branch.input';

import { AuditService } from './audit.service';

/**
 * Branch node for hierarchy tree structure
 */
export interface BranchNode {
  branch: PrismaBranch;
  children: BranchNode[];
}

@Injectable()
export class BranchService {
  private static readonly MAX_ANCESTRY_DEPTH = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Find branch by ID
   * Includes parent and children relations
   */
  async findById(id: string): Promise<PrismaBranch | null> {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        parent: true,
        children: {
          where: { deletedAt: null },
        },
        campaign: true,
      },
    });

    return branch;
  }

  /**
   * Find all branches for a campaign
   * Returns flat list ordered by name
   */
  async findByCampaign(campaignId: string): Promise<PrismaBranch[]> {
    return this.prisma.branch.findMany({
      where: {
        campaignId,
        deletedAt: null,
      },
      include: {
        parent: true,
        children: {
          where: { deletedAt: null },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Find branches matching filter criteria
   */
  async find(where: BranchWhereInput): Promise<PrismaBranch[]> {
    return this.prisma.branch.findMany({
      where: {
        ...where,
        deletedAt: null,
      },
      include: {
        parent: true,
        children: {
          where: { deletedAt: null },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Create a new branch
   * Validates campaign exists, user has access, and parentId if provided
   */
  async create(input: CreateBranchInput, user: AuthenticatedUser): Promise<PrismaBranch> {
    // Verify campaign exists
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: input.campaignId, deletedAt: null },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${input.campaignId} not found`);
    }

    // Verify user has access to the campaign
    await this.checkCampaignAccess(input.campaignId, user);

    // If parentId provided, verify it exists and belongs to same campaign
    if (input.parentId) {
      const parent = await this.prisma.branch.findFirst({
        where: {
          id: input.parentId,
          campaignId: input.campaignId,
          deletedAt: null,
        },
      });

      if (!parent) {
        throw new BadRequestException(
          `Parent branch with ID ${input.parentId} not found or does not belong to this campaign`
        );
      }

      // Check for circular reference: parent cannot be a descendant of this branch
      // Since this is a new branch, we only need to check if parent exists
      // The circular check is more important during updates
    }

    // Create branch
    const branch = await this.prisma.branch.create({
      data: {
        campaignId: input.campaignId,
        name: input.name,
        description: input.description,
        parentId: input.parentId,
        divergedAt: input.divergedAt,
      },
      include: {
        parent: true,
        children: true,
      },
    });

    // Create audit entry
    await this.audit.log('branch', branch.id, 'CREATE', user.id, {
      name: branch.name,
      description: branch.description,
      parentId: branch.parentId,
      divergedAt: branch.divergedAt,
    });

    return branch;
  }

  /**
   * Update a branch (name and description only)
   * Cannot change parent or campaign after creation
   */
  async update(
    id: string,
    input: UpdateBranchInput,
    user: AuthenticatedUser
  ): Promise<PrismaBranch> {
    // Verify branch exists
    const branch = await this.findById(id);
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }

    // Verify user has access to the campaign
    await this.checkCampaignAccess(branch.campaignId, user);

    // Update branch (only name and description allowed)
    const updated = await this.prisma.branch.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
      },
      include: {
        parent: true,
        children: {
          where: { deletedAt: null },
        },
      },
    });

    // Create audit entry
    await this.audit.log('branch', id, 'UPDATE', user.id, input as Record<string, unknown>);

    return updated;
  }

  /**
   * Soft delete a branch
   * Validates branch has no children before deletion
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaBranch> {
    // Verify branch exists
    const branch = await this.findById(id);
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }

    // Verify user has access to the campaign
    await this.checkCampaignAccess(branch.campaignId, user);

    // Validate branch has no children
    const childCount = await this.prisma.branch.count({
      where: {
        parentId: id,
        deletedAt: null,
      },
    });

    if (childCount > 0) {
      throw new BadRequestException(
        `Cannot delete branch with ${childCount} child branch(es). Delete children first.`
      );
    }

    const deletedAt = new Date();

    // Soft delete branch
    const deleted = await this.prisma.branch.update({
      where: { id },
      data: { deletedAt },
    });

    // Create audit entry
    await this.audit.log('branch', id, 'DELETE', user.id, { deletedAt });

    return deleted;
  }

  /**
   * Get branch hierarchy for a campaign as a tree structure
   * Returns array of root branches with nested children
   */
  async getHierarchy(campaignId: string): Promise<BranchNode[]> {
    // Get all branches for the campaign
    const branches = await this.prisma.branch.findMany({
      where: {
        campaignId,
        deletedAt: null,
      },
      include: {
        parent: true,
        children: {
          where: { deletedAt: null },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Build tree structure
    const branchMap = new Map<string, BranchNode>();
    const rootNodes: BranchNode[] = [];

    // First pass: create nodes
    for (const branch of branches) {
      branchMap.set(branch.id, {
        branch,
        children: [],
      });
    }

    // Second pass: build tree
    for (const branch of branches) {
      const node = branchMap.get(branch.id)!;

      if (branch.parentId) {
        const parent = branchMap.get(branch.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          // Parent not found (deleted or doesn't exist), treat as root
          rootNodes.push(node);
        }
      } else {
        // No parent, this is a root branch
        rootNodes.push(node);
      }
    }

    return rootNodes;
  }

  /**
   * Get ancestry chain for a branch
   * Returns array of branches from root to the specified branch
   * [root, parent, grandparent, ..., branch]
   */
  async getAncestry(branchId: string): Promise<PrismaBranch[]> {
    const ancestry: PrismaBranch[] = [];
    let currentId: string | null = branchId;

    // Walk up the parent chain
    while (currentId) {
      const branch: PrismaBranch | null = await this.prisma.branch.findFirst({
        where: {
          id: currentId,
          deletedAt: null,
        },
        include: {
          parent: true,
        },
      });

      if (!branch) {
        break;
      }

      ancestry.unshift(branch); // Add to beginning of array
      currentId = branch.parentId;

      // Safety check: prevent infinite loops from circular references
      if (ancestry.length > BranchService.MAX_ANCESTRY_DEPTH) {
        throw new Error(
          `Branch ancestry chain exceeds maximum depth (${BranchService.MAX_ANCESTRY_DEPTH}). Possible circular reference detected.`
        );
      }
    }

    return ancestry;
  }

  /**
   * Check if user has access to a campaign
   * Used by create, update, and delete operations
   */
  private async checkCampaignAccess(campaignId: string, user: AuthenticatedUser): Promise<void> {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        deletedAt: null,
        OR: [
          { ownerId: user.id },
          {
            memberships: {
              some: {
                userId: user.id,
              },
            },
          },
        ],
      },
    });

    if (!campaign) {
      throw new ForbiddenException('You do not have access to this campaign');
    }
  }
}
