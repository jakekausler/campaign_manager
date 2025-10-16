/**
 * Location Service
 * Handles CRUD operations for Locations with hierarchical cascade delete
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import type { Location as PrismaLocation, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import type { CreateLocationInput, UpdateLocationInput } from '../inputs/location.input';

import { AuditService } from './audit.service';

@Injectable()
export class LocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Find location by ID
   * Locations are world-scoped (no campaign-specific access control for now)
   */
  async findById(id: string): Promise<PrismaLocation | null> {
    const location = await this.prisma.location.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    return location;
  }

  /**
   * Find all locations in a world (non-deleted, non-archived)
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
   * Find child locations for a parent location
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
   * Create a new location
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

    return location;
  }

  /**
   * Update a location
   */
  async update(
    id: string,
    input: UpdateLocationInput,
    user: AuthenticatedUser
  ): Promise<PrismaLocation> {
    // Verify location exists
    const location = await this.findById(id);
    if (!location) {
      throw new NotFoundException(`Location with ID ${id} not found`);
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

    // Build update data
    const updateData: Prisma.LocationUpdateInput = {};
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

    // Update location
    const updated = await this.prisma.location.update({
      where: { id },
      data: updateData,
    });

    // Create audit entry
    await this.audit.log('location', id, 'UPDATE', user.id, updateData);

    return updated;
  }

  /**
   * Soft delete a location
   * Cascades soft delete to all child locations (recursively)
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

    return deleted;
  }

  /**
   * Archive a location
   * Does not cascade to children
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
   * Restore an archived location
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
   * Recursively cascade delete to all child locations
   * Private helper method
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
   * Check if setting a parent would create a circular reference
   * Private helper method
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
}
