/**
 * Kingdom Resolver
 *
 * GraphQL resolvers for Kingdom queries and mutations. Kingdoms represent top-level
 * geographic and political entities within a campaign world, containing settlements,
 * regions, and tracking custom variables for kingdom-specific state.
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CreateKingdomInput, UpdateKingdomInput, UpdateKingdomData } from '../inputs/kingdom.input';
import { DefineVariableSchemaInput, SetVariableInput } from '../inputs/variable.input';
import { KingdomService } from '../services/kingdom.service';
import { VariableSchemaService } from '../services/variable-schema.service';
import { Kingdom } from '../types/kingdom.type';
import { Variable, VariableSchemaType, VariableTypeEnum } from '../types/variable-schema.types';

@Resolver(() => Kingdom)
export class KingdomResolver {
  constructor(
    private readonly kingdomService: KingdomService,
    private readonly variableSchemaService: VariableSchemaService
  ) {}

  /**
   * Retrieves a single kingdom by ID.
   *
   * Returns the kingdom with all its properties including geographic boundaries,
   * settlements, and associated metadata. Access controlled by campaign membership.
   *
   * @param id - Kingdom identifier
   * @param user - Authenticated user (required for access control)
   * @returns Kingdom if found and user has access, null otherwise
   *
   * @see {@link KingdomService.findById} for access control logic
   */
  @Query(() => Kingdom, { nullable: true, description: 'Get kingdom by ID' })
  @UseGuards(JwtAuthGuard)
  async kingdom(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom | null> {
    return this.kingdomService.findById(id, user) as unknown as Kingdom | null;
  }

  /**
   * Retrieves all kingdoms belonging to a specific campaign.
   *
   * Returns all non-deleted kingdoms associated with the campaign, including
   * geographic boundaries and settlement hierarchies. Useful for world map
   * visualization and campaign overview displays.
   *
   * @param campaignId - Campaign identifier
   * @param user - Authenticated user (required for access control)
   * @returns Array of kingdoms in the campaign
   *
   * @see {@link KingdomService.findByCampaign} for query implementation
   */
  @Query(() => [Kingdom], { description: 'Get all kingdoms for a campaign' })
  @UseGuards(JwtAuthGuard)
  async kingdomsByCampaign(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom[]> {
    return this.kingdomService.findByCampaign(campaignId, user) as unknown as Kingdom[];
  }

  /**
   * Creates a new kingdom definition.
   *
   * Establishes a new kingdom entity within a campaign, including name, description,
   * optional geographic boundaries (GeoJSON), and initial level. Kingdoms serve as
   * containers for settlements and regions in the geographic hierarchy.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry
   * - Kingdom starts in active (non-archived) state with level 1 by default
   * - Can contain settlements and define custom variables
   *
   * @param input - Kingdom creation data (name, description, campaignId, optional geometry and level)
   * @param user - Authenticated user creating the kingdom
   * @returns Newly created kingdom
   *
   * @see {@link KingdomService.create} for validation and creation logic
   */
  @Mutation(() => Kingdom, { description: 'Create a new kingdom' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createKingdom(
    @Args('input') input: CreateKingdomInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom> {
    return this.kingdomService.create(input, user) as unknown as Kingdom;
  }

  /**
   * Updates an existing kingdom's properties.
   *
   * Supports partial updates to kingdom name, description, geometry, and level.
   * Can optionally specify branch and world time for branching system integration,
   * and expectedVersion for optimistic concurrency control.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry with diff
   * - Updates updatedAt timestamp
   * - May trigger cache invalidation for related queries
   * - Supports branching: updates can be scoped to specific timeline branches
   *
   * @param id - Kingdom identifier
   * @param input - Fields to update (partial update supported, includes optional branch/version control)
   * @param user - Authenticated user performing the update
   * @returns Updated kingdom
   *
   * @see {@link KingdomService.update} for update logic and validation
   */
  @Mutation(() => Kingdom, { description: 'Update a kingdom' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateKingdom(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateKingdomInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom> {
    const { branchId, expectedVersion, worldTime, ...updateData } = input;
    const kingdomData: UpdateKingdomData = updateData;
    return this.kingdomService.update(
      id,
      kingdomData,
      user,
      expectedVersion,
      branchId,
      worldTime
    ) as unknown as Kingdom;
  }

  /**
   * Soft deletes a kingdom by setting deletedAt timestamp.
   *
   * Removes kingdom from normal queries while preserving all data including
   * settlements, regions, and variable definitions. Associated entities remain
   * accessible but the kingdom hierarchy is hidden.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets deletedAt to current timestamp
   * - Kingdom excluded from normal queries but data preserved
   * - Child settlements remain accessible (not cascaded)
   * - Variable definitions preserved
   * - Creates audit log entry
   *
   * @param id - Kingdom identifier
   * @param user - Authenticated user performing the deletion
   * @returns Deleted kingdom with deletedAt set
   *
   * @see {@link KingdomService.delete} for soft delete implementation
   */
  @Mutation(() => Kingdom, { description: 'Delete a kingdom (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteKingdom(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom> {
    return this.kingdomService.delete(id, user) as unknown as Kingdom;
  }

  /**
   * Archives a kingdom by setting archivedAt timestamp.
   *
   * Archiving is distinct from deletion - archived kingdoms are intentionally
   * preserved for historical reference but hidden from active campaign use.
   * Useful for completed story arcs or fallen kingdoms that should remain
   * in campaign history.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets archivedAt to current timestamp
   * - Kingdom excluded from normal queries
   * - Can be restored with restoreKingdom mutation
   * - Child settlements and variables remain accessible
   * - Creates audit log entry
   *
   * @param id - Kingdom identifier
   * @param user - Authenticated user performing the archive
   * @returns Archived kingdom with archivedAt set
   *
   * @see {@link KingdomService.archive} for archive implementation
   */
  @Mutation(() => Kingdom, { description: 'Archive a kingdom' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveKingdom(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom> {
    return this.kingdomService.archive(id, user) as unknown as Kingdom;
  }

  /**
   * Restores an archived kingdom to active status.
   *
   * Clears the archivedAt timestamp, making the kingdom visible in normal queries
   * again. Useful for bringing back historical kingdoms into active play or
   * recovering from accidental archiving.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Clears archivedAt timestamp
   * - Kingdom becomes visible in normal queries
   * - Child settlements and variables remain unchanged
   * - Creates audit log entry
   *
   * @param id - Kingdom identifier
   * @param user - Authenticated user performing the restore
   * @returns Restored kingdom with archivedAt cleared
   *
   * @see {@link KingdomService.restore} for restore implementation
   */
  @Mutation(() => Kingdom, { description: 'Restore an archived kingdom' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreKingdom(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom> {
    return this.kingdomService.restore(id, user) as unknown as Kingdom;
  }

  /**
   * Sets the kingdom's level value.
   *
   * Updates the kingdom's progression level, which can represent development stage,
   * power level, or other campaign-specific metrics. Level changes may affect
   * available features, resources, or story progression in the campaign.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Updates kingdom level field
   * - Updates updatedAt timestamp
   * - Creates audit log entry
   * - May trigger dependent calculations or condition evaluations
   *
   * @param id - Kingdom identifier
   * @param level - New level value (positive integer)
   * @param user - Authenticated user performing the level change
   * @returns Updated kingdom with new level
   *
   * @see {@link KingdomService.setLevel} for level update logic
   */
  @Mutation(() => Kingdom, { description: 'Set kingdom level' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async setKingdomLevel(
    @Args('id', { type: () => ID }) id: string,
    @Args('level', { type: () => Int }) level: number,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom> {
    return this.kingdomService.setLevel(id, level, user) as unknown as Kingdom;
  }

  /**
   * Defines a new variable schema for kingdom-specific custom variables.
   *
   * Creates a typed variable definition that can store kingdom-specific state
   * like "stability", "treasury", "military_strength", or custom campaign mechanics.
   * Variables can be used in conditions and effects throughout the system.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates variable schema definition in database
   * - Initializes variable with default value if provided
   * - Variable becomes available for conditions and effects
   * - Creates audit log entry
   *
   * @param kingdomId - Kingdom identifier to attach variable schema to
   * @param input - Variable schema definition (name, type, optional enum values, default, description)
   * @param user - Authenticated user defining the schema
   * @returns Created variable schema definition
   *
   * @see {@link VariableSchemaService.defineSchema} for schema validation and creation
   */
  @Mutation(() => VariableSchemaType, { description: 'Define a variable schema for a kingdom' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async defineKingdomVariableSchema(
    @Args('kingdomId', { type: () => ID }) kingdomId: string,
    @Args('input') input: DefineVariableSchemaInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<VariableSchemaType> {
    const schema = {
      name: input.name,
      type: input.type as 'string' | 'number' | 'boolean' | 'enum',
      enumValues: input.enumValues,
      defaultValue: input.defaultValue,
      description: input.description,
    };
    const result = await this.variableSchemaService.defineSchema(
      'kingdom',
      kingdomId,
      schema,
      user
    );
    return {
      name: result.name,
      type: input.type,
      enumValues: result.enumValues,
      defaultValue: result.defaultValue,
      description: result.description,
    };
  }

  /**
   * Sets the value of a kingdom variable.
   *
   * Updates or creates a variable value for a previously defined variable schema.
   * Variable must have a schema defined via defineKingdomVariableSchema first.
   * The value will be validated against the schema's type constraints.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates or updates variable value in database
   * - Value validated against schema type (string/number/boolean/enum)
   * - May trigger condition re-evaluation for dependent entities
   * - May trigger effects that reference this variable
   * - Creates audit log entry
   *
   * @param kingdomId - Kingdom identifier
   * @param input - Variable name and new value (must match schema type)
   * @param user - Authenticated user setting the variable
   * @returns Variable with updated value
   *
   * @see {@link VariableSchemaService.setVariable} for validation and storage logic
   */
  @Mutation(() => Variable, { description: 'Set a variable value for a kingdom' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async setKingdomVariable(
    @Args('kingdomId', { type: () => ID }) kingdomId: string,
    @Args('input') input: SetVariableInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Variable> {
    const value = await this.variableSchemaService.setVariable(
      'kingdom',
      kingdomId,
      input.name,
      input.value,
      user
    );
    return { name: input.name, value };
  }

  /**
   * Deletes a variable schema definition from a kingdom.
   *
   * Removes both the schema definition and any stored value for this variable.
   * This also removes the variable from conditions and effects that reference it,
   * potentially affecting dependent calculations.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Deletes variable schema and value from database
   * - Variable no longer available in conditions/effects
   * - May break existing conditions that reference this variable
   * - Creates audit log entry
   *
   * @param kingdomId - Kingdom identifier
   * @param name - Variable name to delete
   * @param user - Authenticated user deleting the schema
   * @returns True if deletion succeeded
   *
   * @see {@link VariableSchemaService.deleteSchema} for deletion logic
   */
  @Mutation(() => Boolean, { description: 'Delete a variable schema for a kingdom' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteKingdomVariableSchema(
    @Args('kingdomId', { type: () => ID }) kingdomId: string,
    @Args('name') name: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<boolean> {
    await this.variableSchemaService.deleteSchema('kingdom', kingdomId, name, user);
    return true;
  }

  /**
   * Retrieves a single variable value by name for a kingdom.
   *
   * Returns the current value of a variable if defined, or null if the variable
   * schema doesn't exist or has no value set. Gracefully handles missing variables
   * without throwing errors.
   *
   * @param kingdomId - Kingdom identifier
   * @param name - Variable name to retrieve
   * @param user - Authenticated user (required for access control)
   * @returns Variable with name and value if found, null otherwise
   *
   * @see {@link VariableSchemaService.getVariable} for retrieval logic
   */
  @Query(() => Variable, { nullable: true, description: 'Get a variable value for a kingdom' })
  @UseGuards(JwtAuthGuard)
  async kingdomVariable(
    @Args('kingdomId', { type: () => ID }) kingdomId: string,
    @Args('name') name: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Variable | null> {
    try {
      const value = await this.variableSchemaService.getVariable('kingdom', kingdomId, name, user);
      if (value === undefined) {
        return null;
      }
      return { name, value };
    } catch (error) {
      // If variable schema doesn't exist, return null instead of throwing
      if (error instanceof Error && error.message.includes('not defined')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Retrieves all variable values for a kingdom.
   *
   * Returns all defined variables and their current values for the kingdom.
   * Includes all variables that have schemas defined, with their current values
   * or default values if no value has been explicitly set.
   *
   * @param kingdomId - Kingdom identifier
   * @param user - Authenticated user (required for access control)
   * @returns Array of all variables with names and values
   *
   * @see {@link VariableSchemaService.listVariables} for retrieval logic
   */
  @Query(() => [Variable], { description: 'Get all variable values for a kingdom' })
  @UseGuards(JwtAuthGuard)
  async kingdomVariables(
    @Args('kingdomId', { type: () => ID }) kingdomId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Variable[]> {
    const variables = await this.variableSchemaService.listVariables('kingdom', kingdomId, user);
    return Object.entries(variables).map(([name, value]) => ({ name, value }));
  }

  /**
   * Retrieves all variable schema definitions for a kingdom.
   *
   * Returns metadata about all variable schemas defined for the kingdom, including
   * names, types, enum constraints, default values, and descriptions. Useful for
   * building UI forms or validating variable operations.
   *
   * @param kingdomId - Kingdom identifier
   * @param user - Authenticated user (required for access control)
   * @returns Array of all variable schemas with type definitions
   *
   * @see {@link VariableSchemaService.listSchemas} for schema retrieval
   */
  @Query(() => [VariableSchemaType], { description: 'Get all variable schemas for a kingdom' })
  @UseGuards(JwtAuthGuard)
  async kingdomVariableSchemas(
    @Args('kingdomId', { type: () => ID }) kingdomId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<VariableSchemaType[]> {
    const schemas = await this.variableSchemaService.listSchemas('kingdom', kingdomId, user);
    return schemas.map((schema) => ({
      name: schema.name,
      type: VariableTypeEnum[schema.type.toUpperCase() as keyof typeof VariableTypeEnum],
      enumValues: schema.enumValues,
      defaultValue: schema.defaultValue,
      description: schema.description,
    }));
  }
}
