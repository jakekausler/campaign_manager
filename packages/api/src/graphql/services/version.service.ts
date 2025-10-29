/**
 * Version Service
 * Business logic for version management and temporal queries
 * Handles version creation, resolution, and branch inheritance
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import type { Version, Branch } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import {
  compressPayload,
  decompressPayload,
  calculateDiff,
  type VersionDiff,
} from '../utils/version.utils';

import { AuditService } from './audit.service';

/**
 * Input for creating a new version
 */
export interface CreateVersionInput {
  entityType: string;
  entityId: string;
  branchId: string;
  validFrom: Date;
  validTo: Date | null;
  payload: Record<string, unknown>;
  comment?: string;
}

@Injectable()
export class VersionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Creates a new version with compressed payload
   * @param input - Version creation data
   * @param user - Authenticated user creating the version
   * @returns The created version
   */
  async createVersion(input: CreateVersionInput, user: AuthenticatedUser): Promise<Version> {
    // Validate input parameters
    if (!input.entityType?.trim()) {
      throw new BadRequestException('entityType is required and cannot be empty');
    }
    if (!input.entityId?.trim()) {
      throw new BadRequestException('entityId is required and cannot be empty');
    }
    if (!input.branchId?.trim()) {
      throw new BadRequestException('branchId is required and cannot be empty');
    }
    if (!input.validFrom || isNaN(input.validFrom.getTime())) {
      throw new BadRequestException('validFrom must be a valid date');
    }
    if (input.validTo !== null && isNaN(input.validTo.getTime())) {
      throw new BadRequestException('validTo must be null or a valid date');
    }
    if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) {
      throw new BadRequestException('payload must be a non-null object');
    }

    // Verify branch exists and get campaignId for authorization
    const branch = await this.prisma.branch.findUnique({
      where: { id: input.branchId },
      include: { campaign: { select: { ownerId: true, memberships: true } } },
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID ${input.branchId} not found`);
    }

    // Check authorization: user must be campaign owner or have GM/OWNER role
    const isOwner = branch.campaign.ownerId === user.id;
    const hasRole = branch.campaign.memberships.some(
      (m) => m.userId === user.id && (m.role === 'GM' || m.role === 'OWNER')
    );

    if (!isOwner && !hasRole) {
      throw new ForbiddenException('You do not have permission to create versions for this entity');
    }

    // Calculate the correct version number (find latest version + 1)
    const latestVersion = await this.prisma.version.findFirst({
      where: {
        entityType: input.entityType,
        entityId: input.entityId,
        branchId: input.branchId,
      },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const nextVersionNumber = (latestVersion?.version ?? 0) + 1;

    // Compress the payload before storage
    const payloadGz = await compressPayload(input.payload);

    // Create the version record
    const version = await this.prisma.version.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        branchId: input.branchId,
        validFrom: input.validFrom,
        validTo: input.validTo,
        payloadGz,
        createdBy: user.id,
        comment: input.comment ?? null,
        version: nextVersionNumber,
      },
    });

    // Create audit entry
    await this.audit.log('version', version.id, 'CREATE', user.id, {
      entityType: input.entityType,
      entityId: input.entityId,
      branchId: input.branchId,
      validFrom: input.validFrom,
      version: nextVersionNumber,
    });

    return version;
  }

  /**
   * Closes a version by setting its validTo timestamp
   * @param versionId - ID of the version to close
   * @param validTo - Timestamp when the version becomes invalid
   * @returns The updated version
   */
  async closeVersion(versionId: string, validTo: Date): Promise<Version> {
    return this.prisma.version.update({
      where: { id: versionId },
      data: { validTo },
    });
  }

  /**
   * Retrieves version history for an entity in chronological order
   * @param entityType - Type of the entity
   * @param entityId - ID of the entity
   * @param branchId - ID of the branch
   * @param user - Authenticated user requesting the history
   * @returns Array of versions ordered by validFrom ascending
   */
  async findVersionHistory(
    entityType: string,
    entityId: string,
    branchId: string,
    user: AuthenticatedUser
  ): Promise<Version[]> {
    // Verify branch exists and check authorization
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: { campaign: { select: { ownerId: true, memberships: true } } },
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID ${branchId} not found`);
    }

    // Check authorization: user must be campaign owner or member
    const isOwner = branch.campaign.ownerId === user.id;
    const isMember = branch.campaign.memberships.some((m) => m.userId === user.id);

    if (!isOwner && !isMember) {
      throw new ForbiddenException('You do not have permission to view versions for this entity');
    }

    return this.prisma.version.findMany({
      where: {
        entityType,
        entityId,
        branchId,
      },
      orderBy: {
        validFrom: 'asc',
      },
    });
  }

  /**
   * Finds a version in a specific branch at a specific time
   * @param entityType - Type of the entity
   * @param entityId - ID of the entity
   * @param branchId - ID of the branch
   * @param asOf - Point-in-time to query
   * @returns Version or null if not found
   */
  async findVersionInBranch(
    entityType: string,
    entityId: string,
    branchId: string,
    asOf: Date
  ): Promise<Version | null> {
    return this.prisma.version.findFirst({
      where: {
        entityType,
        entityId,
        branchId,
        validFrom: { lte: asOf },
        OR: [
          { validTo: { gt: asOf } }, // Historical version
          { validTo: null }, // Current version
        ],
      },
      orderBy: { validFrom: 'desc' },
    });
  }

  /**
   * Resolves a version for an entity at a specific time with branch inheritance
   * If not found in the specified branch, walks up the branch ancestry chain
   * Optimized to avoid N+1 queries by fetching branch hierarchy once
   * @param entityType - Type of the entity
   * @param entityId - ID of the entity
   * @param branchId - ID of the branch to start search
   * @param asOf - Point-in-time to query
   * @returns Version or null if not found in entire branch hierarchy
   */
  async resolveVersion(
    entityType: string,
    entityId: string,
    branchId: string,
    asOf: Date
  ): Promise<Version | null> {
    // Fetch the starting branch to get campaignId
    const startingBranch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { campaignId: true },
    });

    if (!startingBranch) {
      throw new NotFoundException(`Branch with ID ${branchId} not found`);
    }

    // Fetch entire branch hierarchy for the campaign in one query
    const branches = await this.prisma.branch.findMany({
      where: { campaignId: startingBranch.campaignId, deletedAt: null },
      select: { id: true, parentId: true },
    });

    // Build branch map for O(1) lookups
    const branchMap = new Map(branches.map((b) => [b.id, b]));

    // Walk up hierarchy iteratively to avoid recursive database queries
    let currentBranchId: string | null = branchId;

    while (currentBranchId) {
      // Try to find version in current branch
      const version = await this.findVersionInBranch(entityType, entityId, currentBranchId, asOf);

      if (version) {
        return version;
      }

      // Move to parent branch
      const currentBranch = branchMap.get(currentBranchId);
      if (!currentBranch) {
        throw new NotFoundException(`Branch with ID ${currentBranchId} not found in hierarchy`);
      }

      currentBranchId = currentBranch.parentId;
    }

    // No version found in entire branch hierarchy
    return null;
  }

  /**
   * Calculates the diff between two versions
   * @param versionId1 - ID of the first (older) version
   * @param versionId2 - ID of the second (newer) version
   * @param user - Authenticated user requesting the diff
   * @returns VersionDiff showing added, modified, and removed fields
   */
  async getVersionDiff(
    versionId1: string,
    versionId2: string,
    user: AuthenticatedUser
  ): Promise<VersionDiff> {
    // Fetch both versions
    const version1 = await this.prisma.version.findFirst({
      where: { id: versionId1 },
    });

    if (!version1) {
      throw new NotFoundException(`Version with ID ${versionId1} not found`);
    }

    const version2 = await this.prisma.version.findFirst({
      where: { id: versionId2 },
    });

    if (!version2) {
      throw new NotFoundException(`Version with ID ${versionId2} not found`);
    }

    // Verify both versions belong to the same branch and check authorization
    if (version1.branchId !== version2.branchId) {
      throw new BadRequestException('Cannot compare versions from different branches');
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: version1.branchId },
      include: { campaign: { select: { ownerId: true, memberships: true } } },
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID ${version1.branchId} not found`);
    }

    // Check authorization: user must be campaign owner or member
    const isOwner = branch.campaign.ownerId === user.id;
    const isMember = branch.campaign.memberships.some((m) => m.userId === user.id);

    if (!isOwner && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to view version diffs for this entity'
      );
    }

    // Decompress both payloads in parallel for better performance
    const [payload1, payload2] = await Promise.all([
      decompressPayload(Buffer.from(version1.payloadGz)),
      decompressPayload(Buffer.from(version2.payloadGz)),
    ]);

    // Calculate and return diff
    return calculateDiff(payload1, payload2);
  }

  /**
   * Restores an entity to a previous version state
   * Creates a new version with the payload from the historical version
   * @param versionId - ID of the version to restore
   * @param branchId - Branch to restore the version in
   * @param user - Authenticated user performing the restore
   * @param validFrom - Timestamp for the new restored version (default: now)
   * @param comment - Optional comment for the restoration (default: "Restored from {versionId}")
   * @returns The newly created version
   */
  async restoreVersion(
    versionId: string,
    branchId: string,
    user: AuthenticatedUser,
    validFrom?: Date,
    comment?: string
  ): Promise<Version> {
    const worldTime = validFrom ?? new Date();

    // Validate validFrom
    if (!worldTime || isNaN(worldTime.getTime())) {
      throw new BadRequestException('validFrom must be a valid date');
    }

    // Fetch the historical version to restore
    const historicalVersion = await this.prisma.version.findFirst({
      where: { id: versionId },
    });

    if (!historicalVersion) {
      throw new NotFoundException(`Version with ID ${versionId} not found`);
    }

    // Verify branch exists and check authorization
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: { campaign: { select: { ownerId: true, memberships: true } } },
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID ${branchId} not found`);
    }

    // Check authorization: user must be campaign owner or have GM/OWNER role
    const isOwner = branch.campaign.ownerId === user.id;
    const hasRole = branch.campaign.memberships.some(
      (m) => m.userId === user.id && (m.role === 'GM' || m.role === 'OWNER')
    );

    if (!isOwner && !hasRole) {
      throw new ForbiddenException(
        'You do not have permission to restore versions for this entity'
      );
    }

    // Calculate the correct version number (find latest version + 1)
    const latestVersion = await this.prisma.version.findFirst({
      where: {
        entityType: historicalVersion.entityType,
        entityId: historicalVersion.entityId,
        branchId,
      },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const nextVersionNumber = (latestVersion?.version ?? 0) + 1;

    // Reuse the compressed payload - no need to decompress and recompress
    const payloadGz = Buffer.from(historicalVersion.payloadGz);

    // Create new version with historical payload
    const restoredVersion = await this.prisma.version.create({
      data: {
        entityType: historicalVersion.entityType,
        entityId: historicalVersion.entityId,
        branchId,
        validFrom: worldTime,
        validTo: null,
        payloadGz,
        createdBy: user.id,
        comment: comment ?? `Restored from ${versionId}`,
        version: nextVersionNumber,
      },
    });

    // Create audit entry
    await this.audit.log('version', restoredVersion.id, 'RESTORE', user.id, {
      restoredFrom: versionId,
      entityType: historicalVersion.entityType,
      entityId: historicalVersion.entityId,
      version: nextVersionNumber,
    });

    return restoredVersion;
  }

  /**
   * Get branch by ID
   * Helper method for branch service and resolution algorithm
   */
  async getBranchById(branchId: string): Promise<Branch | null> {
    return this.prisma.branch.findFirst({
      where: {
        id: branchId,
        deletedAt: null,
      },
      include: {
        parent: true,
        campaign: true,
      },
    });
  }

  /**
   * Decompresses a version's payload
   * Utility method for accessing version data
   * @param version - The version to decompress
   * @returns The decompressed payload
   */
  async decompressVersion(version: Version): Promise<Record<string, unknown>> {
    // Convert Uint8Array to Buffer for decompression
    return decompressPayload(Buffer.from(version.payloadGz));
  }
}
