/**
 * Party Resolver
 *
 * GraphQL resolver providing queries and mutations for managing adventuring parties.
 * Parties represent groups of characters within a campaign, tracking their membership,
 * level progression, and custom variable state. Supports member management, level
 * tracking (manual or computed), and flexible variable schemas for party-specific data.
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CreatePartyInput, UpdatePartyInput, UpdatePartyData } from '../inputs/party.input';
import {
  DefineVariableSchemaInput,
  SetVariableInput,
  AddPartyMemberInput,
  RemovePartyMemberInput,
} from '../inputs/variable.input';
import { PartyService } from '../services/party.service';
import { VariableSchemaService } from '../services/variable-schema.service';
import { Party } from '../types/party.type';
import { VariableSchemaType, Variable, VariableTypeEnum } from '../types/variable-schema.types';

@SkipThrottle()
@Resolver(() => Party)
export class PartyResolver {
  constructor(
    private readonly partyService: PartyService,
    private readonly variableSchemaService: VariableSchemaService
  ) {}

  /**
   * Retrieves a single party by ID.
   *
   * **Authorization:** Authenticated user with campaign access
   *
   * @param id - Party ID to retrieve
   * @param user - Authenticated user making the request
   * @returns Party if found and user has access, null otherwise
   *
   * @see {@link PartyService.findById} for authorization and loading logic
   */
  @Query(() => Party, { nullable: true, description: 'Get party by ID' })
  @UseGuards(JwtAuthGuard)
  async party(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party | null> {
    return this.partyService.findById(id, user) as unknown as Party | null;
  }

  /**
   * Retrieves all parties for a campaign.
   *
   * **Authorization:** Authenticated user with campaign access
   *
   * @param campaignId - Campaign ID to list parties for
   * @param user - Authenticated user making the request
   * @returns Array of parties (empty if none exist or no access)
   *
   * @see {@link PartyService.findByCampaign} for authorization and loading logic
   */
  @Query(() => [Party], { description: 'Get all parties for a campaign' })
  @UseGuards(JwtAuthGuard)
  async partiesByCampaign(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party[]> {
    return this.partyService.findByCampaign(campaignId, user) as unknown as Party[];
  }

  /**
   * Creates a new party within a campaign.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry for party creation
   * - Party starts in active (non-archived) state
   * - Initializes empty member list unless specified
   * - Sets initial level (defaults to 1 unless specified)
   *
   * @param input - Party creation data (name, campaign, initial members, etc.)
   * @param user - Authenticated user creating the party
   * @returns Newly created party
   *
   * @see {@link PartyService.create} for validation and creation logic
   */
  @Mutation(() => Party, { description: 'Create a new party' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createParty(
    @Args('input') input: CreatePartyInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party> {
    return this.partyService.create(input, user) as unknown as Party;
  }

  /**
   * Updates party properties.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry for party update
   * - Increments entity version
   * - Invalidates cached party data
   * - Supports optimistic concurrency via expectedVersion
   * - Supports branching via branchId and worldTime
   *
   * @param id - Party ID to update
   * @param input - Update data (name, description, level, etc.) plus optional versioning/branching
   * @param user - Authenticated user making the update
   * @returns Updated party
   *
   * @see {@link PartyService.update} for validation and versioning logic
   */
  @Mutation(() => Party, { description: 'Update a party' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateParty(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePartyInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party> {
    const { branchId, expectedVersion, worldTime, ...updateData } = input;
    const partyData: UpdatePartyData = updateData;
    return this.partyService.update(
      id,
      partyData,
      user,
      expectedVersion,
      branchId,
      worldTime
    ) as unknown as Party;
  }

  /**
   * Soft-deletes a party.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry for party deletion
   * - Sets deletedAt timestamp (soft delete)
   * - Entity remains in database but is excluded from queries
   * - Can be restored via restoreParty mutation
   *
   * @param id - Party ID to delete
   * @param user - Authenticated user performing the deletion
   * @returns Deleted party (with deletedAt timestamp)
   *
   * @see {@link PartyService.delete} for deletion logic
   */
  @Mutation(() => Party, { description: 'Delete a party (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteParty(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party> {
    return this.partyService.delete(id, user) as unknown as Party;
  }

  /**
   * Archives a party, hiding it from standard queries.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry for party archival
   * - Sets archivedAt timestamp
   * - Party excluded from standard campaign queries
   * - Different from soft delete - archived parties can be queried explicitly
   * - Can be restored via restoreParty mutation
   *
   * @param id - Party ID to archive
   * @param user - Authenticated user performing the archival
   * @returns Archived party (with archivedAt timestamp)
   *
   * @see {@link PartyService.archive} for archival logic
   */
  @Mutation(() => Party, { description: 'Archive a party' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveParty(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party> {
    return this.partyService.archive(id, user) as unknown as Party;
  }

  /**
   * Restores an archived party to active status.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry for party restoration
   * - Clears archivedAt timestamp
   * - Party becomes visible in standard campaign queries again
   *
   * @param id - Party ID to restore
   * @param user - Authenticated user performing the restoration
   * @returns Restored party (archivedAt now null)
   *
   * @see {@link PartyService.restore} for restoration logic
   */
  @Mutation(() => Party, { description: 'Restore an archived party' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreParty(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party> {
    return this.partyService.restore(id, user) as unknown as Party;
  }

  /**
   * Manually sets the party's level, overriding computed level.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry for level change
   * - Sets levelOverride field to specified value
   * - Party level becomes fixed at this value until override is cleared
   * - Computed level from member averages is ignored while override is set
   *
   * @param id - Party ID to set level for
   * @param level - Level value to set (typically 1-20 in most systems)
   * @param user - Authenticated user making the change
   * @returns Updated party with new level override
   *
   * @see {@link PartyService.setLevel} for validation and update logic
   */
  @Mutation(() => Party, { description: 'Set party level (manual override)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async setPartyLevel(
    @Args('id', { type: () => ID }) id: string,
    @Args('level', { type: () => Int }) level: number,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party> {
    return this.partyService.setLevel(id, level, user) as unknown as Party;
  }

  /**
   * Adds a character to the party's member list.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry for member addition
   * - Updates party's character membership
   * - May trigger recomputation of party level if no level override set
   * - Character must belong to same campaign as party
   *
   * @param input - Party ID and character ID to add
   * @param user - Authenticated user making the change
   * @returns Updated party with new member included
   *
   * @see {@link PartyService.addMember} for validation and membership logic
   */
  @Mutation(() => Party, { description: 'Add a character to the party' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async addPartyMember(
    @Args('input') input: AddPartyMemberInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party> {
    return this.partyService.addMember(input.partyId, input.characterId, user) as unknown as Party;
  }

  /**
   * Removes a character from the party's member list.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry for member removal
   * - Updates party's character membership
   * - May trigger recomputation of party level if no level override set
   * - Character remains in campaign but is no longer a party member
   *
   * @param input - Party ID and character ID to remove
   * @param user - Authenticated user making the change
   * @returns Updated party with member removed
   *
   * @see {@link PartyService.removeMember} for validation and membership logic
   */
  @Mutation(() => Party, { description: 'Remove a character from the party' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async removePartyMember(
    @Args('input') input: RemovePartyMemberInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party> {
    return this.partyService.removeMember(
      input.partyId,
      input.characterId,
      user
    ) as unknown as Party;
  }

  /**
   * Defines a custom variable schema for the party.
   *
   * Variable schemas allow flexible, typed custom data fields for parties
   * (e.g., reputation scores, group resources, shared inventory flags).
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry for schema definition
   * - Defines new variable schema in variable_schemas table
   * - Schema applies only to this party
   * - Variables can be queried via conditions and used in rules
   *
   * @param partyId - Party ID to define variable for
   * @param input - Schema definition (name, type, default value, enum values, description)
   * @param user - Authenticated user defining the schema
   * @returns Created variable schema definition
   *
   * @see {@link VariableSchemaService.defineSchema} for validation and schema creation
   */
  @Mutation(() => VariableSchemaType, { description: 'Define a variable schema for a party' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async definePartyVariableSchema(
    @Args('partyId', { type: () => ID }) partyId: string,
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
    const result = await this.variableSchemaService.defineSchema('party', partyId, schema, user);
    return {
      name: result.name,
      type: input.type,
      enumValues: result.enumValues,
      defaultValue: result.defaultValue,
      description: result.description,
    };
  }

  /**
   * Sets a variable value for the party.
   *
   * Variable must have a schema defined via definePartyVariableSchema first.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry for variable change
   * - Stores value in entity_variables table
   * - Value must match schema type (validated)
   * - Triggers condition re-evaluation for rules using this variable
   *
   * @param partyId - Party ID to set variable for
   * @param input - Variable name and value to set
   * @param user - Authenticated user setting the variable
   * @returns Variable name and value
   *
   * @see {@link VariableSchemaService.setVariable} for validation and storage
   */
  @Mutation(() => Variable, { description: 'Set a variable value for a party' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async setPartyVariable(
    @Args('partyId', { type: () => ID }) partyId: string,
    @Args('input') input: SetVariableInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Variable> {
    const value = await this.variableSchemaService.setVariable(
      'party',
      partyId,
      input.name,
      input.value,
      user
    );
    return { name: input.name, value };
  }

  /**
   * Deletes a variable schema for the party.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry for schema deletion
   * - Removes schema from variable_schemas table
   * - Deletes all variable values using this schema
   * - Affects conditions/rules referencing this variable
   *
   * @param partyId - Party ID to delete schema from
   * @param name - Variable schema name to delete
   * @param user - Authenticated user deleting the schema
   * @returns True if successful
   *
   * @see {@link VariableSchemaService.deleteSchema} for deletion logic
   */
  @Mutation(() => Boolean, { description: 'Delete a variable schema for a party' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deletePartyVariableSchema(
    @Args('partyId', { type: () => ID }) partyId: string,
    @Args('name') name: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<boolean> {
    await this.variableSchemaService.deleteSchema('party', partyId, name, user);
    return true;
  }

  /**
   * Retrieves a single variable value for the party.
   *
   * **Authorization:** Authenticated user with campaign access
   *
   * Returns null if variable schema doesn't exist or variable has no value set.
   *
   * @param partyId - Party ID to get variable for
   * @param name - Variable name to retrieve
   * @param user - Authenticated user making the request
   * @returns Variable with name and value, or null if not found/undefined
   *
   * @see {@link VariableSchemaService.getVariable} for retrieval logic
   */
  @Query(() => Variable, { nullable: true, description: 'Get a variable value for a party' })
  @UseGuards(JwtAuthGuard)
  async partyVariable(
    @Args('partyId', { type: () => ID }) partyId: string,
    @Args('name') name: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Variable | null> {
    try {
      const value = await this.variableSchemaService.getVariable('party', partyId, name, user);
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
   * Retrieves all variable values for the party.
   *
   * **Authorization:** Authenticated user with campaign access
   *
   * Returns all variables that have schemas defined, showing current values
   * (defaults to schema defaultValue if no value explicitly set).
   *
   * @param partyId - Party ID to get variables for
   * @param user - Authenticated user making the request
   * @returns Array of variables with names and values (empty array if none defined)
   *
   * @see {@link VariableSchemaService.listVariables} for retrieval logic
   */
  @Query(() => [Variable], { description: 'Get all variable values for a party' })
  @UseGuards(JwtAuthGuard)
  async partyVariables(
    @Args('partyId', { type: () => ID }) partyId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Variable[]> {
    const variables = await this.variableSchemaService.listVariables('party', partyId, user);
    return Object.entries(variables).map(([name, value]) => ({ name, value }));
  }

  /**
   * Retrieves all variable schema definitions for the party.
   *
   * **Authorization:** Authenticated user with campaign access
   *
   * Returns metadata about all variable schemas defined for this party,
   * including types, defaults, enum values, and descriptions. Used to
   * understand what variables are available and their constraints.
   *
   * @param partyId - Party ID to get schemas for
   * @param user - Authenticated user making the request
   * @returns Array of schema definitions (empty array if none defined)
   *
   * @see {@link VariableSchemaService.listSchemas} for schema retrieval
   */
  @Query(() => [VariableSchemaType], { description: 'Get all variable schemas for a party' })
  @UseGuards(JwtAuthGuard)
  async partyVariableSchemas(
    @Args('partyId', { type: () => ID }) partyId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<VariableSchemaType[]> {
    const schemas = await this.variableSchemaService.listSchemas('party', partyId, user);
    return schemas.map((schema) => ({
      name: schema.name,
      type: VariableTypeEnum[schema.type.toUpperCase() as keyof typeof VariableTypeEnum],
      enumValues: schema.enumValues,
      defaultValue: schema.defaultValue,
      description: schema.description,
    }));
  }
}
