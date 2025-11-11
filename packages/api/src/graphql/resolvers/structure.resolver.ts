/**
 * Structure Resolver
 *
 * GraphQL resolvers for Structure queries and mutations. Structures represent
 * buildings, facilities, or other constructed entities within settlements.
 * Supports level progression, custom variables, computed fields, and time-travel
 * queries for viewing historical states.
 */

import { Logger, UseGuards } from '@nestjs/common';
import {
  Args,
  Context,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';
import type { Structure as PrismaStructure } from '@prisma/client';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser, GraphQLContext } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CreateStructureInput, UpdateStructureInput } from '../inputs/structure.input';
import { DefineVariableSchemaInput, SetVariableInput } from '../inputs/variable.input';
import { StructureService } from '../services/structure.service';
import { VariableSchemaService } from '../services/variable-schema.service';
import { Settlement } from '../types/settlement.type';
import { Structure } from '../types/structure.type';
import { Variable, VariableSchemaType, VariableTypeEnum } from '../types/variable-schema.types';

@SkipThrottle()
@Resolver(() => Structure)
export class StructureResolver {
  private readonly logger = new Logger(StructureResolver.name);

  constructor(
    private readonly structureService: StructureService,
    private readonly variableSchemaService: VariableSchemaService
  ) {}

  /**
   * Retrieves a single structure by ID.
   *
   * @param id - Structure identifier
   * @param user - Authenticated user (required for access control)
   * @returns Structure if found, null otherwise
   */
  @Query(() => Structure, { nullable: true, description: 'Get structure by ID' })
  @UseGuards(JwtAuthGuard)
  async structure(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure | null> {
    return this.structureService.findById(id, user) as unknown as Structure | null;
  }

  /**
   * Retrieves all structures belonging to a specific settlement.
   *
   * Returns only non-deleted and non-archived structures for the given settlement.
   *
   * @param settlementId - Settlement identifier to filter structures by
   * @param user - Authenticated user (required for access control)
   * @returns Array of structures in the settlement
   *
   * @see {@link StructureService.findBySettlement} for filtering logic
   */
  @Query(() => [Structure], { description: 'Get all structures for a settlement' })
  @UseGuards(JwtAuthGuard)
  async structuresBySettlement(
    @Args('settlementId', { type: () => ID }) settlementId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure[]> {
    return this.structureService.findBySettlement(settlementId, user) as unknown as Structure[];
  }

  /**
   * Retrieves structure state at a specific point in world time (time-travel query).
   *
   * Reconstructs the structure's state by replaying effects up to the specified
   * world time within a given branch. Useful for viewing historical states or
   * exploring alternate timeline branches.
   *
   * @param id - Structure identifier
   * @param branchId - Branch identifier to query within
   * @param asOf - World time to reconstruct state at
   * @param user - Authenticated user (required for access control)
   * @returns Structure state at the specified time, null if not found
   *
   * @see {@link StructureService.getStructureAsOf} for state reconstruction logic
   */
  @Query(() => Structure, {
    nullable: true,
    description: 'Get structure state as of a specific world time in a branch (time-travel query)',
  })
  @UseGuards(JwtAuthGuard)
  async structureAsOf(
    @Args('id', { type: () => ID }) id: string,
    @Args('branchId', { type: () => ID }) branchId: string,
    @Args('asOf', { type: () => Date }) asOf: Date,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure | null> {
    return this.structureService.getStructureAsOf(
      id,
      branchId,
      asOf,
      user
    ) as unknown as Structure | null;
  }

  /**
   * Creates a new structure within a settlement.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry
   * - Structure starts in active (non-archived) state
   * - Initial level set to 1 unless specified
   * - Creates dependency graph node for the structure
   *
   * @param input - Structure creation data (name, type, settlementId, location, etc.)
   * @param user - Authenticated user creating the structure
   * @returns Newly created structure
   *
   * @see {@link StructureService.create} for validation and creation logic
   */
  @Mutation(() => Structure, { description: 'Create a new structure' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createStructure(
    @Args('input') input: CreateStructureInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure> {
    return this.structureService.create(input, user) as unknown as Structure;
  }

  /**
   * Updates an existing structure's properties.
   *
   * Supports optimistic concurrency control via expectedVersion and branching
   * via branchId/worldTime for creating alternate timeline modifications.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry with diff
   * - Updates updatedAt timestamp
   * - Increments version number
   * - Creates effect entry if branchId/worldTime provided
   * - Invalidates cache entries for the structure
   *
   * @param id - Structure identifier
   * @param input - Fields to update (partial update supported)
   * @param user - Authenticated user performing the update
   * @returns Updated structure
   *
   * @see {@link StructureService.update} for update logic and validation
   */
  @Mutation(() => Structure, { description: 'Update a structure' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateStructure(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateStructureInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure> {
    const { branchId, expectedVersion, worldTime, ...data } = input;
    return this.structureService.update(
      id,
      data,
      user,
      expectedVersion,
      branchId,
      worldTime
    ) as unknown as Structure;
  }

  /**
   * Soft deletes a structure by setting deletedAt timestamp.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets deletedAt to current timestamp
   * - Structure excluded from normal queries but data preserved
   * - Can be recovered via database restoration
   * - Creates audit log entry
   * - Invalidates cache entries for the structure
   *
   * @param id - Structure identifier
   * @param user - Authenticated user performing the deletion
   * @returns Deleted structure with deletedAt set
   *
   * @see {@link StructureService.delete} for soft delete implementation
   */
  @Mutation(() => Structure, { description: 'Delete a structure (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteStructure(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure> {
    return this.structureService.delete(id, user) as unknown as Structure;
  }

  /**
   * Archives a structure by setting archivedAt timestamp.
   *
   * Archiving is distinct from deletion - archived structures are intentionally
   * preserved for historical reference but hidden from active use. Useful for
   * structures that have been destroyed, replaced, or are no longer relevant
   * to current gameplay.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets archivedAt to current timestamp
   * - Structure excluded from normal queries
   * - Can be restored with restoreStructure mutation
   * - Creates audit log entry
   * - Invalidates cache entries for the structure
   *
   * @param id - Structure identifier
   * @param user - Authenticated user performing the archive
   * @returns Archived structure with archivedAt set
   *
   * @see {@link StructureService.archive} for archive implementation
   */
  @Mutation(() => Structure, { description: 'Archive a structure' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveStructure(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure> {
    return this.structureService.archive(id, user) as unknown as Structure;
  }

  /**
   * Restores an archived structure by clearing archivedAt timestamp.
   *
   * Returns the structure to active status, making it visible in normal queries
   * again. The structure retains all its properties and relationships.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Clears archivedAt timestamp
   * - Structure included in normal queries again
   * - Creates audit log entry
   * - Invalidates cache entries for the structure
   *
   * @param id - Structure identifier
   * @param user - Authenticated user performing the restore
   * @returns Restored structure with archivedAt cleared
   *
   * @see {@link StructureService.restore} for restore implementation
   */
  @Mutation(() => Structure, { description: 'Restore an archived structure' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreStructure(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure> {
    return this.structureService.restore(id, user) as unknown as Structure;
  }

  /**
   * Sets the level/tier of a structure.
   *
   * Structure levels typically represent progression, upgrades, or development
   * stages (e.g., a Level 1 Inn vs Level 3 Grand Hotel). Level changes may
   * affect computed fields and trigger condition evaluations.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Updates level field
   * - Updates updatedAt timestamp
   * - Increments version number
   * - Creates audit log entry
   * - May trigger condition re-evaluation
   * - Invalidates cache entries for the structure
   *
   * @param id - Structure identifier
   * @param level - New level value (positive integer)
   * @param user - Authenticated user performing the level change
   * @returns Updated structure with new level
   *
   * @see {@link StructureService.setLevel} for level update logic
   */
  @Mutation(() => Structure, { description: 'Set structure level' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async setStructureLevel(
    @Args('id', { type: () => ID }) id: string,
    @Args('level', { type: () => Int }) level: number,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure> {
    return this.structureService.setLevel(id, level, user) as unknown as Structure;
  }

  /**
   * Defines a custom variable schema for a structure.
   *
   * Variable schemas allow extending structures with custom typed fields beyond
   * the base schema. Common uses include tracking custom resources (e.g., "morale",
   * "defense_rating"), state flags, or campaign-specific properties.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates or updates variable schema definition
   * - Applies default value if specified
   * - Validates type constraints (enum values for enum type)
   * - Creates audit log entry
   *
   * @param structureId - Structure identifier to define variable schema for
   * @param input - Variable schema definition (name, type, default, enum values)
   * @param user - Authenticated user defining the schema
   * @returns Created variable schema definition
   *
   * @see {@link VariableSchemaService.defineSchema} for schema validation logic
   */
  @Mutation(() => VariableSchemaType, { description: 'Define a variable schema for a structure' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async defineStructureVariableSchema(
    @Args('structureId', { type: () => ID }) structureId: string,
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
      'structure',
      structureId,
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
   * Sets the value of a custom variable for a structure.
   *
   * The variable schema must be defined first via defineStructureVariableSchema.
   * Value is validated against the schema's type constraints.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Updates or creates variable value
   * - Validates value against schema type
   * - Creates audit log entry
   * - May trigger condition re-evaluation if variable is used in conditions
   * - Invalidates cache entries for the structure
   *
   * @param structureId - Structure identifier
   * @param input - Variable name and new value
   * @param user - Authenticated user setting the variable
   * @returns Variable with updated value
   *
   * @see {@link VariableSchemaService.setVariable} for validation and update logic
   */
  @Mutation(() => Variable, { description: 'Set a variable value for a structure' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async setStructureVariable(
    @Args('structureId', { type: () => ID }) structureId: string,
    @Args('input') input: SetVariableInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Variable> {
    const value = await this.variableSchemaService.setVariable(
      'structure',
      structureId,
      input.name,
      input.value,
      user
    );
    return { name: input.name, value };
  }

  /**
   * Deletes a custom variable schema from a structure.
   *
   * Removes both the schema definition and any stored values for this variable.
   * This operation cannot be undone.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Deletes variable schema definition
   * - Deletes all stored values for this variable
   * - Creates audit log entry
   * - May affect conditions that reference this variable
   * - Invalidates cache entries for the structure
   *
   * @param structureId - Structure identifier
   * @param name - Variable name to delete
   * @param user - Authenticated user deleting the schema
   * @returns true on success
   *
   * @see {@link VariableSchemaService.deleteSchema} for deletion logic
   */
  @Mutation(() => Boolean, { description: 'Delete a variable schema for a structure' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteStructureVariableSchema(
    @Args('structureId', { type: () => ID }) structureId: string,
    @Args('name') name: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<boolean> {
    await this.variableSchemaService.deleteSchema('structure', structureId, name, user);
    return true;
  }

  /**
   * Retrieves a single custom variable value for a structure.
   *
   * Returns null if the variable schema is not defined or no value has been set.
   * Does not throw errors for missing variables (graceful degradation).
   *
   * @param structureId - Structure identifier
   * @param name - Variable name to retrieve
   * @param user - Authenticated user (required for access control)
   * @returns Variable with name and value, null if not found or not defined
   *
   * @see {@link VariableSchemaService.getVariable} for retrieval logic
   */
  @Query(() => Variable, { nullable: true, description: 'Get a variable value for a structure' })
  @UseGuards(JwtAuthGuard)
  async structureVariable(
    @Args('structureId', { type: () => ID }) structureId: string,
    @Args('name') name: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Variable | null> {
    try {
      const value = await this.variableSchemaService.getVariable(
        'structure',
        structureId,
        name,
        user
      );
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
   * Retrieves all custom variable values for a structure.
   *
   * Returns only variables that have been explicitly set. Variables with only
   * schema definitions but no values are excluded.
   *
   * @param structureId - Structure identifier
   * @param user - Authenticated user (required for access control)
   * @returns Array of variables with names and values
   *
   * @see {@link VariableSchemaService.listVariables} for retrieval logic
   */
  @Query(() => [Variable], { description: 'Get all variable values for a structure' })
  @UseGuards(JwtAuthGuard)
  async structureVariables(
    @Args('structureId', { type: () => ID }) structureId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Variable[]> {
    const variables = await this.variableSchemaService.listVariables(
      'structure',
      structureId,
      user
    );
    return Object.entries(variables).map(([name, value]) => ({ name, value }));
  }

  /**
   * Retrieves all custom variable schema definitions for a structure.
   *
   * Returns the schema metadata for all defined variables, including type
   * information, default values, and descriptions. Does not include current
   * variable values (use structureVariables for that).
   *
   * @param structureId - Structure identifier
   * @param user - Authenticated user (required for access control)
   * @returns Array of variable schema definitions
   *
   * @see {@link VariableSchemaService.listSchemas} for schema retrieval logic
   */
  @Query(() => [VariableSchemaType], { description: 'Get all variable schemas for a structure' })
  @UseGuards(JwtAuthGuard)
  async structureVariableSchemas(
    @Args('structureId', { type: () => ID }) structureId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<VariableSchemaType[]> {
    const schemas = await this.variableSchemaService.listSchemas('structure', structureId, user);
    return schemas.map((schema) => ({
      name: schema.name,
      type: VariableTypeEnum[schema.type.toUpperCase() as keyof typeof VariableTypeEnum],
      enumValues: schema.enumValues,
      defaultValue: schema.defaultValue,
      description: schema.description,
    }));
  }

  /**
   * Resolves the parent settlement for a structure.
   *
   * Uses DataLoader for efficient batching and caching of settlement queries
   * when resolving multiple structures. Automatically invoked when the
   * settlement field is requested on a Structure.
   *
   * @param structure - Parent structure object being resolved
   * @param context - GraphQL context with DataLoaders
   * @returns Settlement that this structure belongs to, null if not found
   */
  @ResolveField(() => Settlement, {
    nullable: true,
    description: 'The settlement this structure belongs to',
  })
  async settlement(
    @Parent() structure: Structure,
    @Context() context: GraphQLContext
  ): Promise<Settlement | null> {
    // Use DataLoader to batch and cache settlement queries
    // The loader returns a Settlement with Location from Prisma
    // GraphQL will handle the null->undefined conversion for optional fields
    return context.dataloaders.settlementLoader.load(
      structure.settlementId
    ) as Promise<Settlement | null>;
  }

  /**
   * Resolves dynamic computed fields from condition evaluations.
   *
   * Computed fields are defined via JSONLogic expressions and evaluated by the
   * rules engine. Examples include derived stats, dynamic descriptions, or
   * conditional flags. Gracefully degrades to empty object on evaluation errors.
   *
   * @param structure - Parent structure object being resolved
   * @param user - Authenticated user (required for context in condition evaluation)
   * @returns Object with computed field names as keys and evaluated values
   *
   * @see {@link StructureService.getComputedFields} for evaluation logic
   */
  @ResolveField(() => Object, {
    nullable: true,
    description: 'Computed fields from evaluated conditions',
  })
  async computedFields(
    @Parent() structure: Structure,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Record<string, unknown>> {
    try {
      return await this.structureService.getComputedFields(
        structure as unknown as PrismaStructure,
        user
      );
    } catch (error) {
      // Return empty object on error (graceful degradation)
      this.logger.error(
        `Failed to resolve computed fields for structure ${structure.id}`,
        error instanceof Error ? error.stack : undefined
      );
      return {};
    }
  }
}
