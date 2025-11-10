/**
 * @fileoverview World Service - Business logic for World operations
 *
 * Provides CRUD operations for world entities with soft delete, archive, and cascade delete support.
 * Worlds are the top-level container for campaigns, locations, and other world-specific entities.
 *
 * Key features:
 * - Soft delete with cascade to campaigns and locations
 * - Archive/restore functionality (without cascade)
 * - Audit logging for all mutations
 * - Global access model (no user-specific access control in MVP)
 * - JSON-based storage for calendars and settings
 *
 * Access control:
 * - findById/findAll: Public (any authenticated user)
 * - create: Any authenticated user can create worlds
 * - update/delete/archive/restore: TODO - Add permission checks for owner/admin only
 *
 * Related entities:
 * - Campaign: child entity, cascades on world delete
 * - Location: child entity, cascades on world delete
 *
 * @see {@link CreateWorldInput} for creation input structure
 * @see {@link UpdateWorldInput} for update input structure
 * @see {@link AuditService} for audit logging implementation
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import type { World as PrismaWorld, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import type { CreateWorldInput, UpdateWorldInput } from '../inputs/world.input';

import { AuditService } from './audit.service';

/**
 * Service providing business logic for World entity operations.
 *
 * Implements CRUD operations with soft delete, archive/restore, and cascade delete patterns.
 * All mutations are logged via the AuditService for audit trail purposes.
 *
 * @remarks
 * Worlds use a global access model where any authenticated user can query worlds.
 * Future enhancement: Add role-based access control for mutations.
 *
 * @example
 * ```typescript
 * // Create a new world
 * const world = await worldService.create(
 *   { name: 'Forgotten Realms', calendars: [...], settings: {...} },
 *   user
 * );
 *
 * // Soft delete with cascade
 * await worldService.delete(world.id, user);
 * // Cascades deletedAt to all campaigns and locations in this world
 * ```
 */
@Injectable()
export class WorldService {
  /**
   * Creates a new WorldService instance.
   *
   * @param prisma - Prisma database service for data access
   * @param audit - Audit service for logging mutations
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Finds a world by its unique identifier.
   *
   * Only returns non-deleted worlds (deletedAt = null).
   * Worlds are globally accessible without user-specific access control in MVP.
   *
   * @param id - The unique identifier of the world
   * @returns The world entity if found and not deleted, null otherwise
   *
   * @example
   * ```typescript
   * const world = await worldService.findById('world-uuid-123');
   * if (!world) {
   *   throw new NotFoundException('World not found');
   * }
   * ```
   */
  async findById(id: string): Promise<PrismaWorld | null> {
    const world = await this.prisma.world.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    return world;
  }

  /**
   * Retrieves all active worlds.
   *
   * Returns only non-deleted and non-archived worlds, ordered alphabetically by name.
   * Suitable for listing available worlds in UI dropdowns or selection lists.
   *
   * @returns Array of active world entities, sorted by name ascending
   *
   * @example
   * ```typescript
   * const worlds = await worldService.findAll();
   * // Returns: [{ name: 'Eberron', ... }, { name: 'Forgotten Realms', ... }]
   * ```
   */
  async findAll(): Promise<PrismaWorld[]> {
    return this.prisma.world.findMany({
      where: {
        deletedAt: null,
        archivedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Creates a new world entity.
   *
   * In MVP, any authenticated user can create worlds. The world is created with the provided
   * name, calendars, and settings. If settings are not provided, an empty object is used.
   * An audit log entry is automatically created for the creation event.
   *
   * @param input - The world creation input containing name, calendars, and optional settings
   * @param user - The authenticated user creating the world
   * @returns The newly created world entity
   *
   * @remarks
   * TODO: Add role-based permissions to restrict world creation to admins/GMs only.
   *
   * @example
   * ```typescript
   * const world = await worldService.create(
   *   {
   *     name: 'Forgotten Realms',
   *     calendars: [
   *       { name: 'Harptos', monthsPerYear: 12, daysPerMonth: 30 }
   *     ],
   *     settings: { timezone: 'UTC', theme: 'fantasy' }
   *   },
   *   user
   * );
   * ```
   */
  async create(input: CreateWorldInput, user: AuthenticatedUser): Promise<PrismaWorld> {
    const world = await this.prisma.world.create({
      data: {
        name: input.name,
        calendars: input.calendars as Prisma.InputJsonValue,
        settings: (input.settings ?? {}) as Prisma.InputJsonValue,
      },
    });

    // Create audit entry
    await this.audit.log('world', world.id, 'CREATE', user.id, {
      name: world.name,
      calendars: world.calendars,
      settings: world.settings,
    });

    return world;
  }

  /**
   * Updates an existing world entity.
   *
   * Performs a partial update of world properties. Only provided fields are updated;
   * undefined fields are left unchanged. Verifies the world exists and is not deleted
   * before updating. An audit log entry is created with the updated fields.
   *
   * @param id - The unique identifier of the world to update
   * @param input - Partial update input containing fields to modify
   * @param user - The authenticated user performing the update
   * @returns The updated world entity
   * @throws {NotFoundException} If the world does not exist or has been deleted
   *
   * @remarks
   * TODO: Add permission checks to ensure only owner or admin can update.
   *
   * @example
   * ```typescript
   * const updated = await worldService.update(
   *   'world-uuid-123',
   *   { name: 'Updated Name', settings: { newSetting: true } },
   *   user
   * );
   * // Only name and settings are updated; calendars remain unchanged
   * ```
   */
  async update(id: string, input: UpdateWorldInput, user: AuthenticatedUser): Promise<PrismaWorld> {
    // Verify world exists
    const world = await this.findById(id);
    if (!world) {
      throw new NotFoundException(`World with ID ${id} not found`);
    }

    // Build update data
    const updateData: Prisma.WorldUpdateInput = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.calendars !== undefined)
      updateData.calendars = input.calendars as Prisma.InputJsonValue;
    if (input.settings !== undefined) updateData.settings = input.settings as Prisma.InputJsonValue;

    // Update world
    const updated = await this.prisma.world.update({
      where: { id },
      data: updateData,
    });

    // Create audit entry
    await this.audit.log('world', id, 'UPDATE', user.id, updateData);

    return updated;
  }

  /**
   * Soft deletes a world entity with cascade to child entities.
   *
   * Sets the deletedAt timestamp on the world and automatically cascades the soft delete
   * to all campaigns and locations belonging to this world. This preserves data integrity
   * while marking the world and its children as deleted. The deletion is logged in the audit trail.
   *
   * @param id - The unique identifier of the world to delete
   * @param user - The authenticated user performing the deletion
   * @returns The soft-deleted world entity with deletedAt timestamp set
   * @throws {NotFoundException} If the world does not exist or has already been deleted
   *
   * @remarks
   * Cascade behavior:
   * - All campaigns with worldId matching this world are soft deleted
   * - All locations with worldId matching this world are soft deleted
   * - Only entities that are not already deleted (deletedAt = null) are updated
   *
   * @example
   * ```typescript
   * await worldService.delete('world-uuid-123', user);
   * // World, all its campaigns, and all its locations now have deletedAt set
   * ```
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaWorld> {
    // Verify world exists
    const world = await this.findById(id);
    if (!world) {
      throw new NotFoundException(`World with ID ${id} not found`);
    }

    const deletedAt = new Date();

    // Soft delete world
    const deleted = await this.prisma.world.update({
      where: { id },
      data: { deletedAt },
    });

    // Cascade delete to Campaigns
    await this.prisma.campaign.updateMany({
      where: { worldId: id, deletedAt: null },
      data: { deletedAt },
    });

    // Cascade delete to Locations
    await this.prisma.location.updateMany({
      where: { worldId: id, deletedAt: null },
      data: { deletedAt },
    });

    // Create audit entry
    await this.audit.log('world', id, 'DELETE', user.id, { deletedAt });

    return deleted;
  }

  /**
   * Archives a world entity without cascading to child entities.
   *
   * Sets the archivedAt timestamp on the world to mark it as archived. Unlike delete,
   * archiving does not cascade to campaigns or locations, allowing child entities to
   * remain active. Archived worlds are excluded from findAll() queries but can still
   * be retrieved by findById().
   *
   * @param id - The unique identifier of the world to archive
   * @param user - The authenticated user performing the archive operation
   * @returns The archived world entity with archivedAt timestamp set
   * @throws {NotFoundException} If the world does not exist or has been deleted
   *
   * @remarks
   * Use archive instead of delete when you want to hide the world from active lists
   * but keep its campaigns and locations accessible. Archive can be reversed using restore().
   *
   * @example
   * ```typescript
   * await worldService.archive('world-uuid-123', user);
   * // World is archived but campaigns/locations remain active
   *
   * const worlds = await worldService.findAll();
   * // Archived world is excluded from results
   * ```
   */
  async archive(id: string, user: AuthenticatedUser): Promise<PrismaWorld> {
    // Verify world exists
    const world = await this.findById(id);
    if (!world) {
      throw new NotFoundException(`World with ID ${id} not found`);
    }

    const archivedAt = new Date();

    const archived = await this.prisma.world.update({
      where: { id },
      data: { archivedAt },
    });

    // Create audit entry
    await this.audit.log('world', id, 'ARCHIVE', user.id, { archivedAt });

    return archived;
  }

  /**
   * Restores an archived world entity.
   *
   * Clears the archivedAt timestamp to restore the world to active status. The world
   * will once again appear in findAll() results. This operation only affects the world
   * entity itself and does not modify any child entities.
   *
   * @param id - The unique identifier of the world to restore
   * @param user - The authenticated user performing the restore operation
   * @returns The restored world entity with archivedAt set to null
   * @throws {NotFoundException} If the world does not exist (including deleted worlds)
   *
   * @remarks
   * Note: This method queries for the world without checking deletedAt, so it can find
   * archived worlds. However, it only clears archivedAt; it does not restore deleted worlds.
   * To restore a deleted world, use a separate undelete operation.
   *
   * @example
   * ```typescript
   * await worldService.restore('world-uuid-123', user);
   * // World is now active again and appears in findAll()
   * ```
   */
  async restore(id: string, user: AuthenticatedUser): Promise<PrismaWorld> {
    const world = await this.prisma.world.findFirst({
      where: { id },
    });

    if (!world) {
      throw new NotFoundException(`World with ID ${id} not found`);
    }

    const restored = await this.prisma.world.update({
      where: { id },
      data: { archivedAt: null },
    });

    // Create audit entry
    await this.audit.log('world', id, 'RESTORE', user.id, { archivedAt: null });

    return restored;
  }
}
