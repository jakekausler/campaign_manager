/**
 * Version Service
 *
 * Provides business logic for version management and temporal queries in the campaign management system.
 * This service is responsible for creating, querying, and managing entity versions across branches,
 * enabling time-travel queries, version history tracking, and branch inheritance resolution.
 *
 * Key Features:
 * - Version creation with automatic compression and version numbering
 * - Time-travel queries to retrieve entity state at specific points in time
 * - Branch inheritance resolution (walks up branch ancestry chain)
 * - Version history tracking with chronological ordering
 * - Version diff calculation to compare entity states
 * - Version restoration to revert entities to previous states
 * - Payload compression/decompression for efficient storage
 * - Authorization checks for campaign owners and members
 *
 * Version Storage:
 * - Each version stores a complete entity snapshot in compressed format (gzip)
 * - Versions are ordered by version number and validFrom timestamp
 * - Version ranges are defined by validFrom (inclusive) and validTo (exclusive)
 * - Current versions have validTo = null, historical versions have a validTo date
 *
 * Branch Inheritance:
 * - When querying for a version, the service walks up the branch ancestry chain
 * - If a version is not found in the current branch, parent branches are checked
 * - This allows branches to inherit entity state from their ancestors
 * - Optimized to fetch the entire branch hierarchy once to avoid N+1 queries
 *
 * @see VersionResolver for GraphQL API
 * @see BranchService for branch management
 * @see AuditService for audit logging
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
 * Input data for creating a new version.
 *
 * @interface CreateVersionInput
 */
export interface CreateVersionInput {
  /** Type of the entity (e.g., 'settlement', 'structure', 'character') */
  entityType: string;

  /** Unique identifier of the entity */
  entityId: string;

  /** ID of the branch where this version exists */
  branchId: string;

  /** Timestamp when this version becomes valid (inclusive) */
  validFrom: Date;

  /** Timestamp when this version becomes invalid (exclusive), or null for current version */
  validTo: Date | null;

  /** Complete entity state snapshot to store in this version */
  payload: Record<string, unknown>;

  /** Optional comment describing the changes in this version */
  comment?: string;
}

/**
 * Service for managing entity versions and temporal queries.
 *
 * Handles version creation, retrieval, and management with support for branch inheritance,
 * time-travel queries, and version diffing. All entity state changes are stored as versioned
 * snapshots with compressed payloads for efficient storage.
 *
 * @class VersionService
 */
@Injectable()
export class VersionService {
  /**
   * Creates an instance of VersionService.
   *
   * @param prisma - Prisma database service for data access
   * @param audit - Audit service for logging version operations
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Creates a new version with compressed payload and automatic version numbering.
   *
   * This method performs comprehensive validation of input data, verifies branch existence,
   * checks user authorization (campaign owner or GM/OWNER role), calculates the next version
   * number, compresses the payload using gzip, creates the version record, and logs an audit entry.
   *
   * Version Numbering:
   * - Automatically calculates version number by finding the latest version + 1
   * - Version numbers are sequential within an entity/branch combination
   * - Each entity can have multiple versions across different branches
   *
   * Authorization:
   * - User must be campaign owner OR have GM/OWNER role in the campaign
   * - Verifies branch exists and belongs to an accessible campaign
   *
   * @param input - Version creation data including entity info, timestamps, and payload
   * @param user - Authenticated user creating the version
   * @returns The newly created version with compressed payload
   * @throws BadRequestException If input validation fails (empty fields, invalid dates, invalid payload)
   * @throws NotFoundException If the specified branch does not exist
   * @throws ForbiddenException If user lacks permission to create versions for this entity
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
   * Closes a version by setting its validTo timestamp.
   *
   * Marks a version as historical by setting the validTo date, which indicates
   * when this version stops being the current state. This is typically used when
   * creating a new version that supersedes an existing current version.
   *
   * Note: This method does not perform authorization checks. It should only be
   * called internally by other service methods that have already verified permissions.
   *
   * @param versionId - ID of the version to close
   * @param validTo - Timestamp when the version becomes invalid (exclusive boundary)
   * @returns The updated version with validTo set
   */
  async closeVersion(versionId: string, validTo: Date): Promise<Version> {
    return this.prisma.version.update({
      where: { id: versionId },
      data: { validTo },
    });
  }

  /**
   * Retrieves version history for an entity in chronological order.
   *
   * Returns all versions for a specific entity within a single branch, ordered by
   * validFrom timestamp in ascending order (oldest to newest). This provides a complete
   * audit trail of entity state changes over time.
   *
   * Authorization:
   * - User must be campaign owner OR a campaign member (any role)
   * - More permissive than mutation operations (read-only access)
   *
   * Note: This method only searches the specified branch, not parent branches.
   * For inheritance-aware queries, use resolveVersion() instead.
   *
   * @param entityType - Type of the entity (e.g., 'settlement', 'structure')
   * @param entityId - ID of the entity
   * @param branchId - ID of the branch
   * @param user - Authenticated user requesting the history
   * @returns Array of versions ordered by validFrom ascending (oldest first)
   * @throws NotFoundException If the specified branch does not exist
   * @throws ForbiddenException If user lacks permission to view versions for this entity
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
   * Finds a version in a specific branch at a specific time (point-in-time query).
   *
   * Performs a time-travel query to retrieve the version of an entity that was valid
   * at the specified timestamp within a single branch. The query uses the validFrom
   * and validTo timestamps to determine which version was active at the given time.
   *
   * Query Logic:
   * - validFrom <= asOf (version was created before or at the query time)
   * - validTo > asOf OR validTo IS NULL (version was still valid at the query time)
   * - Returns the most recent version if multiple versions match (ordered by validFrom DESC)
   *
   * Note: This method only searches the specified branch. For inheritance-aware queries
   * that walk up the branch ancestry chain, use resolveVersion() instead.
   *
   * @param entityType - Type of the entity (e.g., 'settlement', 'structure')
   * @param entityId - ID of the entity
   * @param branchId - ID of the branch
   * @param asOf - Point-in-time to query (world time)
   * @returns Version that was valid at the specified time, or null if not found
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
   * Gets all versions for a specific entity type in a branch at a given world time.
   *
   * Retrieves all entity versions of a specific type that were valid at the specified
   * world time within a single branch. This is primarily used by merge operations to
   * identify all entities that exist in a branch at a specific point in time.
   *
   * Query Logic:
   * - Filters by branchId and entityType
   * - validFrom <= worldTime (version was created before or at the query time)
   * - validTo > worldTime OR validTo IS NULL (version was still valid at the query time)
   * - Returns all matching versions (one per entityId)
   *
   * Use Cases:
   * - Merge operations: Identify all entities to merge from source branch
   * - Branch comparison: Compare entity states between branches
   * - Bulk version queries: Get multiple entity versions in a single query
   *
   * @param branchId - ID of the branch
   * @param entityType - Type of entity (e.g., 'settlement', 'structure', 'character')
   * @param worldTime - World time at which to get versions
   * @returns Array of versions for the entity type, ordered by validFrom descending
   */
  async getVersionsForBranchAndType(
    branchId: string,
    entityType: string,
    worldTime: Date
  ): Promise<Version[]> {
    return this.prisma.version.findMany({
      where: {
        branchId,
        entityType,
        validFrom: { lte: worldTime },
        OR: [
          { validTo: { gt: worldTime } }, // Historical version
          { validTo: null }, // Current version
        ],
      },
      orderBy: { validFrom: 'desc' },
    });
  }

  /**
   * Resolves a version for an entity at a specific time with branch inheritance.
   *
   * This is the primary method for time-travel queries with branch inheritance support.
   * If a version is not found in the specified branch, the method walks up the branch
   * ancestry chain (parent, grandparent, etc.) until a version is found or the root
   * branch is reached.
   *
   * Branch Inheritance:
   * - Searches current branch first
   * - If not found, walks up to parent branch
   * - Continues recursively until version is found or root branch is reached
   * - Allows branches to inherit entity state from ancestor branches
   *
   * Performance Optimization:
   * - Fetches entire branch hierarchy for the campaign in a single query
   * - Builds an in-memory map for O(1) branch lookups
   * - Avoids N+1 queries when walking up the branch ancestry chain
   * - Iterative implementation (not recursive) to avoid stack overflow
   *
   * @param entityType - Type of the entity (e.g., 'settlement', 'structure')
   * @param entityId - ID of the entity
   * @param branchId - ID of the branch to start search
   * @param asOf - Point-in-time to query (world time)
   * @returns Version found in branch hierarchy, or null if not found anywhere
   * @throws NotFoundException If the starting branch does not exist
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
   * Calculates the diff between two versions of the same entity.
   *
   * Compares the payloads of two versions to identify added, modified, and removed fields.
   * This is useful for understanding what changed between two points in time or for
   * reviewing changes before merging branches.
   *
   * Process:
   * 1. Fetches both versions from the database
   * 2. Validates that both versions exist and belong to the same branch
   * 3. Checks user authorization to view the versions
   * 4. Decompresses both version payloads in parallel for better performance
   * 5. Calculates diff using deep object comparison
   *
   * Authorization:
   * - User must be campaign owner OR a campaign member (any role)
   * - Same permission level as read-only operations
   *
   * @param versionId1 - ID of the first (typically older) version
   * @param versionId2 - ID of the second (typically newer) version
   * @param user - Authenticated user requesting the diff
   * @returns VersionDiff object showing added, modified, and removed fields
   * @throws NotFoundException If either version does not exist
   * @throws BadRequestException If versions belong to different branches
   * @throws ForbiddenException If user lacks permission to view version diffs
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
   * Restores an entity to a previous version state.
   *
   * Creates a new version with the payload from a historical version, effectively
   * reverting the entity to its previous state. This is a non-destructive operation
   * that creates a new version record rather than modifying the existing version history.
   *
   * Process:
   * 1. Fetches the historical version to restore
   * 2. Verifies branch exists and checks user authorization
   * 3. Calculates the next version number for the new version
   * 4. Reuses the compressed payload from the historical version (no decompression/recompression)
   * 5. Creates a new version record with the historical payload
   * 6. Logs an audit entry for the restoration operation
   *
   * Authorization:
   * - User must be campaign owner OR have GM/OWNER role in the campaign
   * - Same permission level as version creation
   *
   * Performance Optimization:
   * - Reuses the compressed payload from the historical version
   * - Avoids unnecessary decompression and recompression operations
   *
   * @param versionId - ID of the historical version to restore
   * @param branchId - Branch where the restored version will be created
   * @param user - Authenticated user performing the restore
   * @param validFrom - Timestamp for the new restored version (defaults to current time)
   * @param comment - Optional comment for the restoration (defaults to "Restored from {versionId}")
   * @returns The newly created version with historical payload
   * @throws BadRequestException If validFrom is invalid
   * @throws NotFoundException If the historical version or branch does not exist
   * @throws ForbiddenException If user lacks permission to restore versions
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
   * Gets a branch by its ID with related data.
   *
   * Helper method for branch service and resolution algorithm. Fetches a branch
   * with its parent branch and campaign information, excluding soft-deleted branches.
   *
   * Includes:
   * - Parent branch (for branch inheritance)
   * - Campaign (for authorization checks)
   *
   * Note: This method does not perform authorization checks. It should only be
   * called internally by other service methods that have already verified permissions.
   *
   * @param branchId - ID of the branch to retrieve
   * @returns Branch with parent and campaign, or null if not found or deleted
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
   * Decompresses a version's payload.
   *
   * Utility method for accessing the entity state stored in a version. Converts the
   * compressed payload (Uint8Array) to a Buffer and decompresses it using gzip.
   *
   * Note: This method does not perform authorization checks. It should only be
   * called internally by other service methods that have already verified permissions.
   *
   * @param version - The version containing the compressed payload
   * @returns The decompressed payload as a plain object
   */
  async decompressVersion(version: Version): Promise<Record<string, unknown>> {
    // Convert Uint8Array to Buffer for decompression
    return decompressPayload(Buffer.from(version.payloadGz));
  }
}
