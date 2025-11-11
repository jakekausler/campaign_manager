/**
 * Settlement Resolver
 *
 * GraphQL resolvers for Settlement queries and mutations. Settlements represent
 * populated locations within a kingdom (cities, towns, villages) with hierarchical
 * organization, level-based progression, structure management, and custom variables.
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
import type { Settlement as PrismaSettlement } from '@prisma/client';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser, GraphQLContext } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import {
  CreateSettlementInput,
  UpdateSettlementInput,
  UpdateSettlementData,
} from '../inputs/settlement.input';
import { DefineVariableSchemaInput, SetVariableInput } from '../inputs/variable.input';
import { SettlementService } from '../services/settlement.service';
import { VariableSchemaService } from '../services/variable-schema.service';
import { Location } from '../types/location.type';
import { Settlement } from '../types/settlement.type';
import { Structure } from '../types/structure.type';
import { Variable, VariableSchemaType, VariableTypeEnum } from '../types/variable-schema.types';

@SkipThrottle()
@Resolver(() => Settlement)
export class SettlementResolver {
  private readonly logger = new Logger(SettlementResolver.name);

  constructor(
    private readonly settlementService: SettlementService,
    private readonly variableSchemaService: VariableSchemaService
  ) {}

  /**
   * Retrieves a single settlement by ID.
   *
   * Returns settlement with all current properties including level, population,
   * kingdom relationship, and associated location.
   *
   * @param id - Settlement identifier
   * @param user - Authenticated user (required for access control)
   * @returns Settlement if found, null otherwise
   */
  @Query(() => Settlement, { nullable: true, description: 'Get settlement by ID' })
  @UseGuards(JwtAuthGuard)
  async settlement(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement | null> {
    return this.settlementService.findById(id, user) as unknown as Settlement | null;
  }

  /**
   * Retrieves all settlements within a specific kingdom.
   *
   * Returns settlements organized under the specified kingdom in the geographic
   * hierarchy. Useful for displaying kingdom composition and settlement distribution.
   *
   * @param kingdomId - Kingdom identifier
   * @param user - Authenticated user (required for access control)
   * @returns Array of settlements belonging to the kingdom
   */
  @Query(() => [Settlement], { description: 'Get all settlements for a kingdom' })
  @UseGuards(JwtAuthGuard)
  async settlementsByKingdom(
    @Args('kingdomId', { type: () => ID }) kingdomId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement[]> {
    return this.settlementService.findByKingdom(kingdomId, user) as unknown as Settlement[];
  }

  /**
   * Retrieves settlement state at a specific point in world time within a branch.
   *
   * Time-travel query that reconstructs settlement state as it existed at the
   * specified world time by applying historical state snapshots. Useful for viewing
   * past settlement configurations, tracking progression over time, and analyzing
   * historical scenarios.
   *
   * @param id - Settlement identifier
   * @param branchId - Branch identifier for timeline context
   * @param asOf - World time timestamp to query
   * @param user - Authenticated user (required for access control)
   * @returns Settlement state at specified time, or null if not found
   *
   * @see {@link SettlementService.getSettlementAsOf} for time-travel implementation
   */
  @Query(() => Settlement, {
    nullable: true,
    description: 'Get settlement state as of a specific world time in a branch (time-travel query)',
  })
  @UseGuards(JwtAuthGuard)
  async settlementAsOf(
    @Args('id', { type: () => ID }) id: string,
    @Args('branchId', { type: () => ID }) branchId: string,
    @Args('asOf', { type: () => Date }) asOf: Date,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement | null> {
    return this.settlementService.getSettlementAsOf(
      id,
      branchId,
      asOf,
      user
    ) as unknown as Settlement | null;
  }

  /**
   * Creates a new settlement within a kingdom.
   *
   * Establishes a new populated location with initial properties including name,
   * level, population, and geographic placement. Settlement is linked to parent
   * kingdom for hierarchical organization.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry
   * - Establishes kingdom-settlement relationship
   * - Creates associated location if geographic data provided
   * - Settlement starts in active (non-archived) state
   *
   * @param input - Settlement creation data (name, level, kingdomId, location, etc.)
   * @param user - Authenticated user creating the settlement
   * @returns Newly created settlement
   *
   * @see {@link SettlementService.create} for validation and creation logic
   */
  @Mutation(() => Settlement, { description: 'Create a new settlement' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createSettlement(
    @Args('input') input: CreateSettlementInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement> {
    return this.settlementService.create(input, user) as unknown as Settlement;
  }

  /**
   * Updates an existing settlement's properties.
   *
   * Supports partial updates with optimistic concurrency control via expectedVersion.
   * Can update name, level, population, kingdom relationship, and custom properties.
   * Includes branching system integration for timeline-aware updates.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry with diff
   * - Creates state snapshot if worldTime provided
   * - Updates updatedAt timestamp
   * - Invalidates cached computed fields
   * - May trigger dependency graph updates if relationships change
   *
   * @param id - Settlement identifier
   * @param input - Fields to update (partial update supported)
   * @param user - Authenticated user performing the update
   * @returns Updated settlement
   *
   * @see {@link SettlementService.update} for update logic and validation
   */
  @Mutation(() => Settlement, { description: 'Update a settlement' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateSettlement(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSettlementInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement> {
    const { branchId, expectedVersion, worldTime, ...updateData } = input;
    const settlementData: UpdateSettlementData = updateData;
    return this.settlementService.update(
      id,
      settlementData,
      user,
      expectedVersion,
      branchId,
      worldTime
    ) as unknown as Settlement;
  }

  /**
   * Soft deletes a settlement by setting deletedAt timestamp.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets deletedAt to current timestamp
   * - Settlement excluded from normal queries but data preserved
   * - Associated structures remain but are inaccessible
   * - Can be recovered by clearing deletedAt in database
   * - Creates audit log entry
   *
   * @param id - Settlement identifier
   * @param user - Authenticated user performing the deletion
   * @returns Deleted settlement with deletedAt set
   *
   * @see {@link SettlementService.delete} for soft delete implementation
   */
  @Mutation(() => Settlement, { description: 'Delete a settlement (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteSettlement(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement> {
    return this.settlementService.delete(id, user) as unknown as Settlement;
  }

  /**
   * Archives a settlement by setting archivedAt timestamp.
   *
   * Archiving is distinct from deletion - archived settlements are intentionally
   * preserved for historical reference but hidden from active campaign use. Useful
   * for settlements destroyed in-game or no longer relevant to current storylines.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets archivedAt to current timestamp
   * - Settlement excluded from normal queries
   * - Can be restored with restoreSettlement mutation
   * - Associated structures remain but are archived
   * - Creates audit log entry
   *
   * @param id - Settlement identifier
   * @param user - Authenticated user performing the archive
   * @returns Archived settlement with archivedAt set
   *
   * @see {@link SettlementService.archive} for archive implementation
   */
  @Mutation(() => Settlement, { description: 'Archive a settlement' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveSettlement(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement> {
    return this.settlementService.archive(id, user) as unknown as Settlement;
  }

  /**
   * Restores an archived settlement to active status.
   *
   * Clears the archivedAt timestamp, making the settlement visible in normal queries
   * again. Useful for bringing settlements back into active campaign use.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Clears archivedAt timestamp
   * - Settlement becomes visible in normal queries
   * - Associated structures become accessible again
   * - Creates audit log entry
   *
   * @param id - Settlement identifier
   * @param user - Authenticated user performing the restore
   * @returns Restored settlement with archivedAt cleared
   *
   * @see {@link SettlementService.restore} for restore implementation
   */
  @Mutation(() => Settlement, { description: 'Restore an archived settlement' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreSettlement(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement> {
    return this.settlementService.restore(id, user) as unknown as Settlement;
  }

  /**
   * Sets the settlement's level (size/importance tier).
   *
   * Settlement level typically represents size, influence, and available services
   * (e.g., 1=hamlet, 2=village, 3=town, 4=city, 5=metropolis). Level affects
   * available structures, services, and narrative importance. This is a dedicated
   * method for level changes to support level-based game mechanics.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Updates settlement level field
   * - May trigger computed field updates based on level
   * - May affect available structure types
   * - Creates audit log entry
   *
   * @param id - Settlement identifier
   * @param level - New level value (typically 1-5)
   * @param user - Authenticated user performing the update
   * @returns Updated settlement with new level
   *
   * @see {@link SettlementService.setLevel} for level validation and update logic
   */
  @Mutation(() => Settlement, { description: 'Set settlement level' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async setSettlementLevel(
    @Args('id', { type: () => ID }) id: string,
    @Args('level', { type: () => Int }) level: number,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement> {
    return this.settlementService.setLevel(id, level, user) as unknown as Settlement;
  }

  /**
   * Defines a custom variable schema for settlement-specific data.
   *
   * Creates a typed variable definition that can store custom settlement properties
   * like economy rating, defense level, prosperity, unrest, or any campaign-specific
   * attributes. Supports string, number, boolean, and enum types with optional
   * default values.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates variable schema in database
   * - Initializes variable with default value if provided
   * - Schema applies to specific settlement only
   * - Creates audit log entry
   *
   * @param settlementId - Settlement identifier
   * @param input - Variable schema definition (name, type, enumValues, defaultValue, description)
   * @param user - Authenticated user defining the schema
   * @returns Created variable schema definition
   *
   * @see {@link VariableSchemaService.defineSchema} for schema validation and creation
   */
  @Mutation(() => VariableSchemaType, { description: 'Define a variable schema for a settlement' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async defineSettlementVariableSchema(
    @Args('settlementId', { type: () => ID }) settlementId: string,
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
      'settlement',
      settlementId,
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
   * Sets a custom variable value for a settlement.
   *
   * Updates the value of a previously defined variable. The variable schema must
   * exist before setting values. Type validation is enforced based on the schema
   * (e.g., enum values must match defined options).
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Updates variable value in database
   * - Validates value against schema type and constraints
   * - May trigger computed field recalculation if variable used in conditions
   * - Creates audit log entry
   *
   * @param settlementId - Settlement identifier
   * @param input - Variable name and new value
   * @param user - Authenticated user setting the variable
   * @returns Variable with updated value
   *
   * @see {@link VariableSchemaService.setVariable} for validation and update logic
   */
  @Mutation(() => Variable, { description: 'Set a variable value for a settlement' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async setSettlementVariable(
    @Args('settlementId', { type: () => ID }) settlementId: string,
    @Args('input') input: SetVariableInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Variable> {
    const value = await this.variableSchemaService.setVariable(
      'settlement',
      settlementId,
      input.name,
      input.value,
      user
    );
    return { name: input.name, value };
  }

  /**
   * Deletes a custom variable schema and its value from a settlement.
   *
   * Removes both the schema definition and any stored value. This is a destructive
   * operation that cannot be undone. Consider archiving data before deletion if
   * historical records are needed.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Removes variable schema from database
   * - Deletes stored variable value
   * - May invalidate computed fields referencing this variable
   * - Creates audit log entry
   *
   * @param settlementId - Settlement identifier
   * @param name - Variable name to delete
   * @param user - Authenticated user performing the deletion
   * @returns True if deletion succeeded
   *
   * @see {@link VariableSchemaService.deleteSchema} for deletion implementation
   */
  @Mutation(() => Boolean, { description: 'Delete a variable schema for a settlement' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteSettlementVariableSchema(
    @Args('settlementId', { type: () => ID }) settlementId: string,
    @Args('name') name: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<boolean> {
    await this.variableSchemaService.deleteSchema('settlement', settlementId, name, user);
    return true;
  }

  /**
   * Retrieves a single custom variable value for a settlement.
   *
   * Returns the current value of a defined variable. If the variable schema exists
   * but no value has been set, returns the default value (if defined) or null.
   * If the schema doesn't exist, returns null instead of throwing an error for
   * graceful degradation.
   *
   * @param settlementId - Settlement identifier
   * @param name - Variable name to retrieve
   * @param user - Authenticated user (required for access control)
   * @returns Variable with current value, or null if not found
   */
  @Query(() => Variable, { nullable: true, description: 'Get a variable value for a settlement' })
  @UseGuards(JwtAuthGuard)
  async settlementVariable(
    @Args('settlementId', { type: () => ID }) settlementId: string,
    @Args('name') name: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Variable | null> {
    try {
      const value = await this.variableSchemaService.getVariable(
        'settlement',
        settlementId,
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
   * Retrieves all custom variable values for a settlement.
   *
   * Returns all defined variables with their current values. Variables with no
   * explicit value set will show their default values (if defined). Useful for
   * displaying complete settlement state including custom attributes.
   *
   * @param settlementId - Settlement identifier
   * @param user - Authenticated user (required for access control)
   * @returns Array of all variables with current values
   */
  @Query(() => [Variable], { description: 'Get all variable values for a settlement' })
  @UseGuards(JwtAuthGuard)
  async settlementVariables(
    @Args('settlementId', { type: () => ID }) settlementId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Variable[]> {
    const variables = await this.variableSchemaService.listVariables(
      'settlement',
      settlementId,
      user
    );
    return Object.entries(variables).map(([name, value]) => ({ name, value }));
  }

  /**
   * Retrieves all custom variable schema definitions for a settlement.
   *
   * Returns metadata about all defined variables including names, types,
   * enum options, default values, and descriptions. Useful for building
   * dynamic UIs for variable editing or displaying available custom fields.
   *
   * @param settlementId - Settlement identifier
   * @param user - Authenticated user (required for access control)
   * @returns Array of variable schema definitions
   */
  @Query(() => [VariableSchemaType], { description: 'Get all variable schemas for a settlement' })
  @UseGuards(JwtAuthGuard)
  async settlementVariableSchemas(
    @Args('settlementId', { type: () => ID }) settlementId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<VariableSchemaType[]> {
    const schemas = await this.variableSchemaService.listSchemas('settlement', settlementId, user);
    return schemas.map((schema) => ({
      name: schema.name,
      type: VariableTypeEnum[schema.type.toUpperCase() as keyof typeof VariableTypeEnum],
      enumValues: schema.enumValues,
      defaultValue: schema.defaultValue,
      description: schema.description,
    }));
  }

  /**
   * Resolves the location where this settlement is geographically placed.
   *
   * Uses DataLoader for efficient batching and caching of location queries,
   * preventing N+1 query problems when loading multiple settlements.
   *
   * @param settlement - Parent settlement object
   * @param context - GraphQL context with DataLoader instances
   * @returns Settlement's location with geographic coordinates, or null if no location
   */
  @ResolveField(() => Location, { description: 'The location where this settlement is placed' })
  async location(
    @Parent() settlement: Settlement,
    @Context() context: GraphQLContext
  ): Promise<Location | null> {
    // Use DataLoader to batch and cache location queries
    return context.dataloaders.locationLoader.load(
      settlement.locationId
    ) as unknown as Location | null;
  }

  /**
   * Resolves all structures within this settlement.
   *
   * Returns buildings, facilities, and other constructed features that exist
   * within the settlement. Uses DataLoader for efficient batching and caching
   * of structure queries, preventing N+1 query problems.
   *
   * @param settlement - Parent settlement object
   * @param context - GraphQL context with DataLoader instances
   * @returns Array of structures in this settlement
   */
  @ResolveField(() => [Structure], { description: 'Structures in this settlement' })
  async structures(
    @Parent() settlement: Settlement,
    @Context() context: GraphQLContext
  ): Promise<Structure[]> {
    // Use DataLoader to batch and cache structure queries
    return context.dataloaders.structureLoader.load(settlement.id) as unknown as Structure[];
  }

  /**
   * Resolves computed fields from evaluated JSONLogic conditions.
   *
   * Evaluates condition expressions defined on the settlement to calculate
   * dynamic derived values. These might include prosperity rating, threat level,
   * economic status, or any campaign-specific calculated attributes. Returns
   * empty object on error for graceful degradation.
   *
   * @param settlement - Parent settlement object
   * @param user - Authenticated user (required for access control)
   * @returns Object with computed field names and their evaluated values
   *
   * @see {@link SettlementService.getComputedFields} for condition evaluation logic
   */
  @ResolveField(() => Object, {
    nullable: true,
    description: 'Computed fields from evaluated conditions',
  })
  async computedFields(
    @Parent() settlement: Settlement,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Record<string, unknown>> {
    try {
      return await this.settlementService.getComputedFields(
        settlement as unknown as PrismaSettlement,
        user
      );
    } catch (error) {
      // Return empty object on error (graceful degradation)
      this.logger.error(
        `Failed to resolve computed fields for settlement ${settlement.id}`,
        error instanceof Error ? error.stack : undefined
      );
      return {};
    }
  }
}
