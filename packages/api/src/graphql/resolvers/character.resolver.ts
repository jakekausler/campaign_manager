/**
 * Character Resolver
 * GraphQL resolvers for Character queries and mutations
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CreateCharacterInput, UpdateCharacterInput } from '../inputs/character.input';
import { CharacterService } from '../services/character.service';
import { Character } from '../types/character.type';

@Resolver(() => Character)
export class CharacterResolver {
  constructor(private readonly characterService: CharacterService) {}

  /**
   * Retrieves a single character by ID.
   *
   * @param id - Character identifier
   * @param user - Authenticated user (required for access control)
   * @returns Character if found, null otherwise
   */
  @Query(() => Character, { nullable: true, description: 'Get character by ID' })
  @UseGuards(JwtAuthGuard)
  async character(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Character | null> {
    return this.characterService.findById(id, user) as Promise<Character | null>;
  }

  /**
   * Retrieves all characters associated with a specific campaign.
   *
   * Returns non-deleted characters belonging to the campaign. Characters
   * may be in different parties or no party at all within the campaign.
   *
   * @param campaignId - Campaign identifier
   * @param user - Authenticated user (required for access control)
   * @returns Array of characters in the campaign
   */
  @Query(() => [Character], { description: 'Get all characters for a campaign' })
  @UseGuards(JwtAuthGuard)
  async charactersByCampaign(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Character[]> {
    return this.characterService.findByCampaign(campaignId, user) as Promise<Character[]>;
  }

  /**
   * Retrieves all characters that are members of a specific party.
   *
   * Filters characters by their party membership. Useful for displaying
   * party rosters and managing group compositions.
   *
   * @param partyId - Party identifier
   * @param user - Authenticated user (required for access control)
   * @returns Array of characters in the party
   */
  @Query(() => [Character], { description: 'Get all characters in a party' })
  @UseGuards(JwtAuthGuard)
  async charactersByParty(
    @Args('partyId', { type: () => ID }) partyId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Character[]> {
    return this.characterService.findByPartyId(partyId, user) as Promise<Character[]>;
  }

  /**
   * Creates a new character in a campaign.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry
   * - Initializes character state with default values
   * - Character starts in active (non-archived) state
   * - Can optionally assign to a party at creation
   *
   * @param input - Character creation data (name, campaignId, optional partyId, stats, variables)
   * @param user - Authenticated user creating the character
   * @returns Newly created character
   *
   * @see {@link CharacterService.create} for validation and creation logic
   */
  @Mutation(() => Character, { description: 'Create a new character' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createCharacter(
    @Args('input') input: CreateCharacterInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Character> {
    return this.characterService.create(input, user) as Promise<Character>;
  }

  /**
   * Updates an existing character's properties.
   *
   * Supports updating character stats, variables, party membership, and other
   * attributes. Can track changes across branches and world time for time-travel
   * features.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry with diff
   * - Updates updatedAt timestamp
   * - Invalidates cached character state
   * - Triggers dependency graph updates if variables change
   * - Supports optimistic concurrency control via expectedVersion
   *
   * @param id - Character identifier
   * @param input - Fields to update (partial update supported, includes optional branchId, expectedVersion, worldTime)
   * @param user - Authenticated user performing the update
   * @returns Updated character
   *
   * @see {@link CharacterService.update} for update logic and validation
   */
  @Mutation(() => Character, { description: 'Update a character' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateCharacter(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateCharacterInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Character> {
    const { branchId, expectedVersion, worldTime, ...data } = input;
    return this.characterService.update(
      id,
      data,
      user,
      expectedVersion,
      branchId,
      worldTime
    ) as Promise<Character>;
  }

  /**
   * Soft deletes a character by setting deletedAt timestamp.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets deletedAt to current timestamp
   * - Character excluded from normal queries but data preserved
   * - Party membership maintained but character not shown in active roster
   * - Can be restored but not archived (deleted state is terminal for archiving)
   * - Creates audit log entry
   *
   * @param id - Character identifier
   * @param user - Authenticated user performing the deletion
   * @returns Deleted character with deletedAt set
   *
   * @see {@link CharacterService.delete} for soft delete implementation
   */
  @Mutation(() => Character, { description: 'Delete a character (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteCharacter(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Character> {
    return this.characterService.delete(id, user) as Promise<Character>;
  }

  /**
   * Archives a character by setting archivedAt timestamp.
   *
   * Archiving is distinct from deletion - archived characters are intentionally
   * preserved for historical reference but hidden from active use. Useful for
   * retired characters, fallen party members, or NPCs no longer in the campaign.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets archivedAt to current timestamp
   * - Character excluded from normal queries
   * - Party membership maintained for historical accuracy
   * - Can be restored with restoreCharacter mutation
   * - Creates audit log entry
   *
   * @param id - Character identifier
   * @param user - Authenticated user performing the archive
   * @returns Archived character with archivedAt set
   *
   * @see {@link CharacterService.archive} for archive implementation
   */
  @Mutation(() => Character, { description: 'Archive a character' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveCharacter(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Character> {
    return this.characterService.archive(id, user) as Promise<Character>;
  }

  /**
   * Restores an archived character to active status.
   *
   * Clears the archivedAt timestamp, making the character visible in normal
   * queries again. Character rejoins their party roster and resumes normal
   * campaign activities.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Clears archivedAt timestamp
   * - Character becomes visible in normal queries
   * - Party membership restored to active roster
   * - Creates audit log entry
   *
   * @param id - Character identifier
   * @param user - Authenticated user performing the restore
   * @returns Restored character with archivedAt cleared
   *
   * @see {@link CharacterService.restore} for restore implementation
   */
  @Mutation(() => Character, { description: 'Restore an archived character' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreCharacter(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Character> {
    return this.characterService.restore(id, user) as Promise<Character>;
  }
}
