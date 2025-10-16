/**
 * World Service
 * Business logic for World operations
 * Implements CRUD with soft delete, archive, and cascade delete to Campaigns and Locations
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import type { World as PrismaWorld, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import type { CreateWorldInput, UpdateWorldInput } from '../inputs/world.input';

import { AuditService } from './audit.service';

@Injectable()
export class WorldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Find world by ID
   * Worlds are globally accessible (no user-specific access control)
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
   * Find all worlds (non-deleted)
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
   * Create a new world
   * Note: In MVP, any authenticated user can create worlds
   * TODO: Add role-based permissions if needed
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
   * Update a world
   * TODO: Add permission checks (only owner or admin should update)
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
   * Soft delete a world
   * Cascades soft delete to all Campaigns and Locations belonging to this world
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
   * Archive a world
   * Does not cascade to campaigns/locations
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
   * Restore an archived world
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
