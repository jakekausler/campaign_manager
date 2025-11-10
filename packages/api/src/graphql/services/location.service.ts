/**
 * Location Service
 *
 * Provides comprehensive CRUD operations for geographic location entities with advanced features:
 * - PostGIS geometry management (Point, Polygon, MultiPolygon)
 * - Parent-child hierarchical relationships with circular reference prevention
 * - Cascade delete operations for location hierarchies
 * - Optimistic locking with version control
 * - Temporal versioning for time-travel queries
 * - GeoJSON geometry validation and EWKB conversion
 * - Spatial cache and tile cache invalidation
 * - Real-time entity modification events via Redis PubSub
 * - Audit trail logging for all operations
 *
 * Key Features:
 * - Geometry Storage: PostGIS geometry fields stored as EWKB with configurable SRID
 * - Hierarchical Structure: Parent-child relationships with cascade delete and cycle detection
 * - Version Control: Atomic updates with optimistic locking and temporal snapshots
 * - Spatial Operations: GeoJSON validation, SRID transformation, spatial query support
 * - Cache Invalidation: Automatic invalidation of tile cache and spatial query caches
 * - Real-time Updates: WebSocket notifications for concurrent edit detection
 *
 * Database Schema:
 * - Location table with PostGIS geometry column (Unsupported type in Prisma)
 * - Raw SQL queries required for geometry read/write operations
 * - ST_AsBinary/ST_GeomFromEWKB for geometry serialization
 *
 * @class
 * @injectable
 */

import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import type { Location as PrismaLocation, Prisma } from '@prisma/client';
import type { RedisPubSub } from 'graphql-redis-subscriptions';

import type { GeoJSONGeometry } from '@campaign/shared';

import { CacheService } from '../../common/cache/cache.service';
import { SpatialService } from '../../common/services/spatial.service';
import { TileCacheService } from '../../common/services/tile-cache.service';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions';
import type { CreateLocationInput, UpdateLocationData } from '../inputs/location.input';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';

import { AuditService } from './audit.service';
import { VersionService, type CreateVersionInput } from './version.service';

/**
 * Location type with geom field included
 * Prisma excludes Unsupported fields from generated types, so we extend the type manually
 */
export type LocationWithGeometry = PrismaLocation & {
  geom: Buffer | null;
};

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
    private readonly versionService: VersionService,
    private readonly spatialService: SpatialService,
    private readonly tileCacheService: TileCacheService,
    @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub
  ) {}

  /**
   * Find location by ID with geometry field.
   *
   * Retrieves a single location with its PostGIS geometry field using raw SQL.
   * Locations are world-scoped with no campaign-specific access control.
   * Only returns non-deleted locations.
   *
   * Uses raw SQL with ST_AsBinary to properly retrieve PostGIS geometry field
   * since Prisma doesn't support the Unsupported("geometry") type directly.
   *
   * @param id - The location ID to find
   * @returns Location with geometry as Buffer, or null if not found or deleted
   *
   * @see LocationWithGeometry type for structure with geom field
   * @see ST_AsBinary for PostGIS geometry serialization
   */
  async findById(id: string): Promise<LocationWithGeometry | null> {
    const locations = await this.prisma.$queryRaw<
      Array<Omit<LocationWithGeometry, 'geom'> & { geom: Buffer | null }>
    >`
      SELECT
        id,
        "worldId",
        type,
        name,
        description,
        "parentLocationId",
        version,
        "createdAt",
        "updatedAt",
        "deletedAt",
        "archivedAt",
        ST_AsBinary(geom) as geom
      FROM "Location"
      WHERE id = ${id}
        AND "deletedAt" IS NULL
      LIMIT 1
    `;

    if (!locations[0]) {
      return null;
    }

    // Ensure geom is a Buffer (Prisma might return it as a hex string or Uint8Array)
    const location = locations[0];
    if (location.geom && !Buffer.isBuffer(location.geom)) {
      // Convert to Buffer if it's not already
      location.geom = Buffer.from(location.geom as unknown as Uint8Array);
    }

    return location as LocationWithGeometry;
  }

  /**
   * Find all locations in a world.
   *
   * Retrieves all non-deleted, non-archived locations for a specific world,
   * sorted alphabetically by name. Does not include geometry field.
   *
   * @param worldId - The world ID to filter locations
   * @returns Array of locations (without geometry field)
   */
  async findByWorldId(worldId: string): Promise<PrismaLocation[]> {
    return this.prisma.location.findMany({
      where: {
        worldId,
        deletedAt: null,
        archivedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Find child locations for a parent location.
   *
   * Retrieves all direct child locations (one level deep) for a given parent,
   * sorted alphabetically by name. Only returns non-deleted, non-archived locations.
   *
   * @param parentLocationId - The parent location ID
   * @returns Array of child locations (without geometry field)
   */
  async findChildren(parentLocationId: string): Promise<PrismaLocation[]> {
    return this.prisma.location.findMany({
      where: {
        parentLocationId,
        deletedAt: null,
        archivedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Find locations by parent ID.
   *
   * Alias for findChildren() - retrieves all direct child locations for a parent.
   *
   * @param parentLocationId - The parent location ID
   * @returns Array of child locations (without geometry field)
   * @see findChildren
   */
  async findByParentId(parentLocationId: string): Promise<PrismaLocation[]> {
    return this.findChildren(parentLocationId);
  }

  /**
   * Batch load locations by IDs with geometry.
   *
   * Efficiently loads multiple locations in a single query with geometry fields.
   * Used by DataLoader to prevent N+1 query problems in GraphQL field resolvers.
   * Returns locations in the same order as input IDs, with null for missing locations.
   *
   * Uses raw SQL with ST_AsBinary to retrieve PostGIS geometry fields.
   *
   * @param locationIds - Array of location IDs to load
   * @returns Array of locations (or null) in same order as input IDs
   *
   * @see DataLoader pattern for batch loading
   * @see LocationWithGeometry for return type with geom field
   */
  async findByIds(locationIds: readonly string[]): Promise<(LocationWithGeometry | null)[]> {
    if (locationIds.length === 0) {
      return [];
    }

    // Query all locations with geometry in one query
    const locations = await this.prisma.$queryRaw<
      Array<Omit<LocationWithGeometry, 'geom'> & { geom: Buffer | null }>
    >`
      SELECT
        id,
        "worldId",
        type,
        name,
        description,
        "parentLocationId",
        version,
        "createdAt",
        "updatedAt",
        "deletedAt",
        "archivedAt",
        ST_AsBinary(geom) as geom
      FROM "Location"
      WHERE id = ANY(${[...locationIds]})
        AND "deletedAt" IS NULL
    `;

    // Convert to Buffer if needed
    locations.forEach((location) => {
      if (location.geom && !Buffer.isBuffer(location.geom)) {
        location.geom = Buffer.from(location.geom as unknown as Uint8Array);
      }
    });

    // Create a map for quick lookup
    const locationMap = new Map<string, LocationWithGeometry>();
    locations.forEach((loc) => {
      locationMap.set(loc.id, loc as LocationWithGeometry);
    });

    // Return in same order as input IDs, with null for missing locations
    return locationIds.map((id) => locationMap.get(id) || null);
  }

  /**
   * Create a new location.
   *
   * Creates a new geographic location entity with validation of world and parent location.
   * Automatically creates an audit log entry and invalidates tile cache for the world.
   *
   * Validation:
   * - Verifies world exists and is not deleted
   * - Verifies parent location exists and belongs to same world (if provided)
   * - Prevents cross-world parent-child relationships
   *
   * Side Effects:
   * - Creates audit log entry for CREATE action
   * - Invalidates tile cache for the world (new location appears on map)
   *
   * @param input - Location creation data (worldId, type, name, description, parentLocationId)
   * @param user - Authenticated user creating the location
   * @returns Newly created location (without geometry field)
   * @throws NotFoundException - If world or parent location not found
   * @throws Error - If parent location belongs to different world
   *
   * @see CreateLocationInput for input structure
   * @see AuditService.log for audit trail
   * @see TileCacheService.invalidateWorld for cache invalidation
   */
  async create(input: CreateLocationInput, user: AuthenticatedUser): Promise<PrismaLocation> {
    // Verify world exists
    const world = await this.prisma.world.findFirst({
      where: { id: input.worldId, deletedAt: null },
    });

    if (!world) {
      throw new NotFoundException(`World with ID ${input.worldId} not found`);
    }

    // Verify parent location exists and belongs to same world (if provided)
    if (input.parentLocationId) {
      const parent = await this.prisma.location.findFirst({
        where: { id: input.parentLocationId, deletedAt: null },
      });

      if (!parent) {
        throw new NotFoundException(`Parent location with ID ${input.parentLocationId} not found`);
      }

      if (parent.worldId !== input.worldId) {
        throw new Error('Parent location must belong to the same world');
      }
    }

    const location = await this.prisma.location.create({
      data: {
        worldId: input.worldId,
        type: input.type,
        name: input.name ?? null,
        description: input.description ?? null,
        parentLocationId: input.parentLocationId ?? null,
      },
    });

    // Create audit entry
    await this.audit.log('location', location.id, 'CREATE', user.id, {
      worldId: location.worldId,
      type: location.type,
      name: location.name,
      description: location.description,
      parentLocationId: location.parentLocationId,
    });

    // Invalidate tile cache for this world (new location should appear on map)
    this.tileCacheService.invalidateWorld(location.worldId);

    return location;
  }

  /**
   * Update a location with optimistic locking and versioning.
   *
   * Updates location metadata (type, name, description, parentLocationId) with atomic
   * optimistic locking to prevent concurrent update conflicts. Creates a version snapshot
   * for temporal queries. Does not update geometry (use updateLocationGeometry instead).
   *
   * Validation:
   * - Verifies location exists and is not deleted
   * - Verifies branch exists and belongs to campaign in location's world
   * - Checks optimistic lock (version matches expectedVersion)
   * - Validates parent location exists and belongs to same world (if changing)
   * - Prevents self-parenting (location cannot be its own parent)
   * - Detects circular references in parent-child hierarchy
   *
   * Transaction:
   * - Atomically updates location with incremented version
   * - Creates version snapshot for temporal queries
   *
   * Side Effects:
   * - Increments version number
   * - Creates version snapshot in Version table
   * - Creates audit log entry for UPDATE action
   * - Publishes entityModified event via Redis PubSub
   * - Invalidates tile cache for the world
   *
   * @param id - Location ID to update
   * @param input - Update data (type, name, description, parentLocationId)
   * @param user - Authenticated user making the update
   * @param expectedVersion - Expected version for optimistic locking
   * @param branchId - Branch ID for versioning
   * @param worldTime - World time for version snapshot (defaults to current time)
   * @returns Updated location with incremented version
   * @throws NotFoundException - If location, branch, or parent location not found
   * @throws OptimisticLockException - If version mismatch (concurrent update detected)
   * @throws BadRequestException - If branch doesn't belong to campaign in location's world
   * @throws Error - If parent location validation fails or circular reference detected
   *
   * @see OptimisticLockException for concurrent update handling
   * @see VersionService.createVersion for version snapshots
   * @see checkCircularReference for cycle detection
   */
  async update(
    id: string,
    input: UpdateLocationData,
    user: AuthenticatedUser,
    expectedVersion: number,
    branchId: string,
    worldTime: Date = new Date()
  ): Promise<PrismaLocation> {
    // Verify location exists
    const location = await this.findById(id);
    if (!location) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    // Verify branchId exists and belongs to a campaign in this world
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        deletedAt: null,
        campaign: {
          worldId: location.worldId,
          deletedAt: null,
        },
      },
    });

    if (!branch) {
      throw new BadRequestException(
        `Branch with ID ${branchId} not found or does not belong to a campaign in this location's world`
      );
    }

    // Optimistic locking check: verify version matches
    if (location.version !== expectedVersion) {
      throw new OptimisticLockException(
        `Location was modified by another user. Expected version ${expectedVersion}, but found ${location.version}. Please refresh and try again.`,
        expectedVersion,
        location.version
      );
    }

    // Verify parent location exists and belongs to same world (if changing parent)
    if (input.parentLocationId !== undefined) {
      if (input.parentLocationId === null) {
        // Allow removing parent
      } else if (input.parentLocationId === id) {
        throw new Error('Location cannot be its own parent');
      } else {
        const parent = await this.prisma.location.findFirst({
          where: { id: input.parentLocationId, deletedAt: null },
        });

        if (!parent) {
          throw new NotFoundException(
            `Parent location with ID ${input.parentLocationId} not found`
          );
        }

        if (parent.worldId !== location.worldId) {
          throw new Error('Parent location must belong to the same world');
        }

        // Check for circular reference
        const wouldCreateCycle = await this.checkCircularReference(id, input.parentLocationId);
        if (wouldCreateCycle) {
          throw new Error('Cannot set parent: would create circular reference');
        }
      }
    }

    // Build update data with incremented version
    const updateData: Prisma.LocationUpdateInput = {
      version: location.version + 1,
    };
    if (input.type !== undefined) updateData.type = input.type;
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.parentLocationId !== undefined) {
      if (input.parentLocationId === null) {
        updateData.parent = { disconnect: true };
      } else {
        updateData.parent = { connect: { id: input.parentLocationId } };
      }
    }

    // Create new version payload (all fields)
    const newPayload: Record<string, unknown> = {
      ...location,
      ...updateData,
      version: location.version + 1,
    };

    // Use transaction to atomically update entity and create version
    const updated = await this.prisma.$transaction(async (tx) => {
      // Update location with new version
      const updatedLocation = await tx.location.update({
        where: { id },
        data: updateData,
      });

      // Create version snapshot
      const versionInput: CreateVersionInput = {
        entityType: 'location',
        entityId: id,
        branchId,
        validFrom: worldTime,
        validTo: null,
        payload: newPayload,
      };
      await this.versionService.createVersion(versionInput, user);

      return updatedLocation;
    });

    // Create audit entry
    await this.audit.log('location', id, 'UPDATE', user.id, updateData);

    // Publish entityModified event for concurrent edit detection
    await this.pubSub.publish(`entity.modified.${id}`, {
      entityModified: {
        entityId: id,
        entityType: 'location',
        version: updated.version,
        modifiedBy: user.id,
        modifiedAt: updated.updatedAt,
      },
    });

    // Invalidate tile cache for this world (location metadata changed)
    this.tileCacheService.invalidateWorld(location.worldId);

    return updated;
  }

  /**
   * Soft delete a location with cascade.
   *
   * Marks a location and all its descendant locations as deleted (sets deletedAt timestamp).
   * Recursively cascades the delete operation down the entire location hierarchy tree.
   *
   * Delete Behavior:
   * - Sets deletedAt timestamp on target location
   * - Recursively deletes all child locations (and their children, etc.)
   * - Preserves data for potential recovery (soft delete)
   * - Does not affect parent location
   *
   * Side Effects:
   * - Creates audit log entry for DELETE action
   * - Invalidates tile cache for the world (location disappears from map)
   *
   * @param id - Location ID to delete
   * @param user - Authenticated user performing the deletion
   * @returns Deleted location with deletedAt timestamp set
   * @throws NotFoundException - If location not found or already deleted
   *
   * @see cascadeDeleteChildren for recursive deletion logic
   * @see archive for non-cascading soft delete alternative
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaLocation> {
    // Verify location exists
    const location = await this.findById(id);
    if (!location) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    const deletedAt = new Date();

    // Soft delete location
    const deleted = await this.prisma.location.update({
      where: { id },
      data: { deletedAt },
    });

    // Cascade delete to all children (recursively)
    await this.cascadeDeleteChildren(id, deletedAt);

    // Create audit entry
    await this.audit.log('location', id, 'DELETE', user.id, { deletedAt });

    // Invalidate tile cache for this world (location should disappear from map)
    this.tileCacheService.invalidateWorld(location.worldId);

    return deleted;
  }

  /**
   * Archive a location without cascade.
   *
   * Marks a location as archived (sets archivedAt timestamp) without affecting children.
   * Archived locations are excluded from normal queries but can be restored later.
   *
   * Archive Behavior:
   * - Sets archivedAt timestamp on target location only
   * - Does NOT cascade to child locations
   * - Location remains in database and can be restored
   * - Different from delete (which cascades to children)
   *
   * Side Effects:
   * - Creates audit log entry for ARCHIVE action
   *
   * @param id - Location ID to archive
   * @param user - Authenticated user performing the archival
   * @returns Archived location with archivedAt timestamp set
   * @throws NotFoundException - If location not found
   *
   * @see restore for un-archiving locations
   * @see delete for cascading soft delete alternative
   */
  async archive(id: string, user: AuthenticatedUser): Promise<PrismaLocation> {
    // Verify location exists
    const location = await this.findById(id);
    if (!location) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    const archivedAt = new Date();

    const archived = await this.prisma.location.update({
      where: { id },
      data: { archivedAt },
    });

    // Create audit entry
    await this.audit.log('location', id, 'ARCHIVE', user.id, { archivedAt });

    return archived;
  }

  /**
   * Restore an archived location.
   *
   * Removes the archivedAt timestamp to restore a previously archived location.
   * Allows locations to be temporarily removed from queries and later restored.
   *
   * Restore Behavior:
   * - Clears archivedAt timestamp (sets to null)
   * - Location becomes visible in normal queries again
   * - Works on archived locations only (not deleted locations)
   *
   * Side Effects:
   * - Creates audit log entry for RESTORE action
   *
   * @param id - Location ID to restore
   * @param user - Authenticated user performing the restoration
   * @returns Restored location with archivedAt set to null
   * @throws NotFoundException - If location not found
   *
   * @see archive for archiving locations
   */
  async restore(id: string, user: AuthenticatedUser): Promise<PrismaLocation> {
    const location = await this.prisma.location.findFirst({
      where: { id },
    });

    if (!location) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    const restored = await this.prisma.location.update({
      where: { id },
      data: { archivedAt: null },
    });

    // Create audit entry
    await this.audit.log('location', id, 'RESTORE', user.id, { archivedAt: null });

    return restored;
  }

  /**
   * Recursively cascade delete to all child locations.
   *
   * Private helper method that recursively soft-deletes all descendant locations
   * in the location hierarchy tree. Uses depth-first traversal to delete children
   * before parents at each level.
   *
   * Algorithm:
   * 1. Find all direct children of parentId
   * 2. For each child, recursively delete its children first (depth-first)
   * 3. Delete all direct children with updateMany
   *
   * @param parentId - Parent location ID whose children should be deleted
   * @param deletedAt - Timestamp to set for deletedAt field
   * @returns Promise that resolves when cascade is complete
   *
   * @private
   * @see delete for public interface
   */
  private async cascadeDeleteChildren(parentId: string, deletedAt: Date): Promise<void> {
    // Find all direct children
    const children = await this.prisma.location.findMany({
      where: {
        parentLocationId: parentId,
        deletedAt: null,
      },
      select: { id: true },
    });

    // Recursively delete each child's children first
    for (const child of children) {
      await this.cascadeDeleteChildren(child.id, deletedAt);
    }

    // Then delete the direct children
    await this.prisma.location.updateMany({
      where: {
        parentLocationId: parentId,
        deletedAt: null,
      },
      data: { deletedAt },
    });
  }

  /**
   * Check if setting a parent would create a circular reference.
   *
   * Private helper method that detects circular references in the location hierarchy
   * by traversing up the ancestor chain from newParentId to ensure locationId is not
   * in the chain. Prevents creating cycles like: A -> B -> C -> A.
   *
   * Algorithm:
   * 1. Start with newParentId and track visited locations
   * 2. Traverse up the parent chain (follow parentLocationId)
   * 3. If locationId is found in the chain, circular reference detected
   * 4. Stop when reaching a location with no parent (top of hierarchy)
   *
   * @param locationId - Location that would get a new parent
   * @param newParentId - Proposed new parent location ID
   * @returns True if circular reference would be created, false otherwise
   *
   * @private
   * @see update for usage in parent validation
   */
  private async checkCircularReference(locationId: string, newParentId: string): Promise<boolean> {
    let currentId: string | null = newParentId;
    const visited = new Set<string>([locationId]);

    while (currentId) {
      if (visited.has(currentId)) {
        return true; // Circular reference detected
      }

      visited.add(currentId);

      const parent: { parentLocationId: string | null } | null =
        await this.prisma.location.findFirst({
          where: { id: currentId, deletedAt: null },
          select: { parentLocationId: true },
        });

      currentId = parent?.parentLocationId ?? null;
    }

    return false;
  }

  /**
   * Get location state as it existed at a specific point in world-time.
   *
   * Retrieves the historical state of a location by resolving the version snapshot
   * that was valid at the specified world-time. Enables time-travel queries for
   * viewing how locations changed over campaign time.
   *
   * Time-Travel Query:
   * - Queries Version table for snapshot valid at worldTime
   * - Uses validFrom/validTo temporal range matching
   * - Returns decompressed historical payload
   * - Supports branching (alternate timelines)
   *
   * @param id - Location ID to query
   * @param branchId - Branch ID for version resolution
   * @param worldTime - Point in world-time to query (campaign time, not real time)
   * @returns Historical location state or null if no version found
   *
   * @see VersionService.resolveVersion for version resolution logic
   * @see VersionService.decompressVersion for payload decompression
   */
  async getLocationAsOf(
    id: string,
    branchId: string,
    worldTime: Date
  ): Promise<PrismaLocation | null> {
    // Verify location exists
    const location = await this.findById(id);
    if (!location) {
      return null;
    }

    // Resolve version at the specified time
    const version = await this.versionService.resolveVersion('location', id, branchId, worldTime);

    if (!version) {
      return null;
    }

    // Decompress and return the historical payload as a Location object
    const payload = await this.versionService.decompressVersion(version);

    return payload as PrismaLocation;
  }

  /**
   * Update location geometry with GeoJSON data.
   *
   * Updates the PostGIS geometry field for a location with atomic optimistic locking.
   * Validates GeoJSON, converts to EWKB format, and creates a version snapshot.
   * This is the primary method for setting/updating location spatial data on the map.
   *
   * Validation:
   * - Verifies location exists and is not deleted
   * - Verifies branch exists and belongs to campaign in location's world
   * - Validates GeoJSON geometry structure and coordinates
   * - Checks optimistic lock (version matches expectedVersion)
   *
   * Geometry Processing:
   * - Validates GeoJSON using SpatialService (topology, coordinate format)
   * - Determines SRID: provided > campaign default > Web Mercator (3857)
   * - Converts GeoJSON to EWKB (Extended Well-Known Binary with SRID)
   * - Uses PostGIS ST_GeomFromEWKB for database storage
   *
   * Transaction:
   * - Atomically updates geometry with raw SQL (Prisma doesn't support geometry type)
   * - Increments version in same UPDATE (optimistic lock check in WHERE clause)
   * - Fetches updated location with ST_AsBinary
   * - Creates version snapshot with geometry included
   *
   * Side Effects:
   * - Increments version number
   * - Creates version snapshot in Version table with geometry
   * - Creates audit log entry for UPDATE action
   * - Publishes entityModified event via Redis PubSub
   * - Invalidates tile cache for the world (map tiles need regeneration)
   * - Invalidates all spatial query caches for the branch (geometry affects queries)
   *
   * Cache Invalidation:
   * - Tile cache: All tiles for world regenerated with new geometry
   * - Spatial cache: Pattern match `spatial:*:{branchId}` to clear related queries
   *   (locations-near, locations-in-region, settlements-in-region)
   *
   * @param id - Location ID to update
   * @param geoJson - GeoJSON geometry (Point, Polygon, MultiPolygon)
   * @param user - Authenticated user making the change
   * @param expectedVersion - Expected version for optimistic locking
   * @param branchId - Branch ID for versioning
   * @param srid - Optional SRID (defaults to campaign's SRID or Web Mercator 3857)
   * @param worldTime - World time for version snapshot (defaults to current time)
   * @returns Updated location with new geometry as Buffer
   * @throws NotFoundException - If location or branch not found
   * @throws BadRequestException - If GeoJSON validation fails or branch doesn't belong to world
   * @throws OptimisticLockException - If version mismatch (concurrent update detected)
   *
   * @see SpatialService.validateGeometry for GeoJSON validation
   * @see SpatialService.geoJsonToEWKB for geometry conversion
   * @see OptimisticLockException for concurrent update handling
   * @see update for metadata updates (without geometry)
   */
  async updateLocationGeometry(
    id: string,
    geoJson: GeoJSONGeometry,
    user: AuthenticatedUser,
    expectedVersion: number,
    branchId: string,
    srid?: number,
    worldTime: Date = new Date()
  ): Promise<LocationWithGeometry> {
    // Verify location exists
    const location = await this.findById(id);
    if (!location) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    // Verify branchId exists and belongs to a campaign in this world
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        deletedAt: null,
        campaign: {
          worldId: location.worldId,
          deletedAt: null,
        },
      },
      include: {
        campaign: {
          select: { srid: true },
        },
      },
    });

    if (!branch) {
      throw new BadRequestException(
        `Branch with ID ${branchId} not found or does not belong to a campaign in this location's world`
      );
    }

    // Validate GeoJSON geometry
    const validation = await this.spatialService.validateGeometry(geoJson);
    if (!validation.valid) {
      throw new BadRequestException(`Invalid GeoJSON geometry: ${validation.errors.join(', ')}`);
    }

    // Determine SRID (use provided, campaign default, or Web Mercator)
    const effectiveSRID = srid ?? branch.campaign.srid ?? 3857;

    // Convert GeoJSON to EWKB with SRID
    const ewkb = this.spatialService.geoJsonToEWKB(geoJson, effectiveSRID);

    // Use transaction to atomically update location and create version
    const updated = await this.prisma.$transaction(async (tx) => {
      // Update location geometry using raw SQL with atomic optimistic locking
      // We need raw SQL because Prisma doesn't support PostGIS geometry type directly
      // The version check in WHERE clause ensures atomic concurrent update protection
      const updateResult = await tx.$executeRaw`
        UPDATE "Location"
        SET geom = ST_GeomFromEWKB(${ewkb}),
            version = version + 1,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${id}
          AND version = ${expectedVersion}
      `;

      // Check if update succeeded (row was found and updated)
      if (updateResult === 0) {
        // Version mismatch - another transaction updated this location
        throw new OptimisticLockException(
          `Location was modified by another user. Expected version ${expectedVersion}. Please refresh and try again.`,
          expectedVersion,
          location.version
        );
      }

      // Fetch updated location with geometry field using raw SQL with ST_AsBinary
      // Prisma's findUnique doesn't properly retrieve PostGIS Unsupported("geometry") fields
      const updatedLocations = await tx.$queryRaw<
        Array<Omit<LocationWithGeometry, 'geom'> & { geom: Buffer | null }>
      >`
        SELECT
          id,
          "worldId",
          type,
          name,
          description,
          "parentLocationId",
          version,
          "createdAt",
          "updatedAt",
          "deletedAt",
          "archivedAt",
          ST_AsBinary(geom) as geom
        FROM "Location"
        WHERE id = ${id}
        LIMIT 1
      `;

      const updatedLocation = updatedLocations[0];
      if (!updatedLocation) {
        throw new NotFoundException(`Location with ID ${id} not found after update`);
      }

      // Ensure geom is a Buffer (Prisma might return it as a hex string or Uint8Array)
      if (updatedLocation.geom && !Buffer.isBuffer(updatedLocation.geom)) {
        updatedLocation.geom = Buffer.from(updatedLocation.geom as unknown as Uint8Array);
      }

      // Create new version payload (all fields including new geometry)
      const newPayload: Record<string, unknown> = {
        ...location,
        geom: updatedLocation.geom,
        version: updatedLocation.version,
        updatedAt: updatedLocation.updatedAt,
      };

      // Create version snapshot
      const versionInput: CreateVersionInput = {
        entityType: 'location',
        entityId: id,
        branchId,
        validFrom: worldTime,
        validTo: null,
        payload: newPayload,
      };
      await this.versionService.createVersion(versionInput, user);

      return updatedLocation;
    });

    // Create audit entry
    await this.audit.log('location', id, 'UPDATE', user.id, {
      geometry: 'updated',
      srid: effectiveSRID,
    });

    // Publish entityModified event for concurrent edit detection
    await this.pubSub.publish(`entity.modified.${id}`, {
      entityModified: {
        entityId: id,
        entityType: 'location',
        version: updated.version,
        modifiedBy: user.id,
        modifiedAt: updated.updatedAt,
      },
    });

    // Invalidate tile cache for this location's world
    // All map tiles for this world need to be regenerated since geometry changed
    this.tileCacheService.invalidateWorld(location.worldId);

    // Invalidate all spatial query caches for this branch
    // Geometry changes affect all spatial queries (locations-near, locations-in-region, settlements-in-region)
    try {
      const spatialCachePattern = `spatial:*:${branchId}`;
      const result = await this.cache.delPattern(spatialCachePattern);
      this.logger.debug(
        `Invalidated ${result.keysDeleted} spatial cache entries: ${spatialCachePattern}`
      );
    } catch (error) {
      // Log cache error but don't throw - graceful degradation
      this.logger.warn(
        `Failed to invalidate spatial cache for branch ${branchId}`,
        error instanceof Error ? error.message : undefined
      );
    }

    return updated;
  }
}
