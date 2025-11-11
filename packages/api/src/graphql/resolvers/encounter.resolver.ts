/**
 * Encounter Resolver
 * GraphQL resolvers for Encounter queries and mutations.
 *
 * Handles encounter management including combat and exploration tracking,
 * party interactions, location-based queries, and the resolution workflow
 * with 3-phase effect execution (PRE, ON_RESOLVE, POST).
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CreateEncounterInput, UpdateEncounterInput } from '../inputs/encounter.input';
import { EncounterService } from '../services/encounter.service';
import { Encounter, EncounterResolutionResult } from '../types/encounter.type';

@SkipThrottle()
@Resolver(() => Encounter)
export class EncounterResolver {
  constructor(private readonly encounterService: EncounterService) {}

  /**
   * Retrieves a single encounter by ID.
   *
   * @param id - Encounter identifier
   * @param user - Authenticated user (required for campaign access control)
   * @returns Encounter if found and user has access, null otherwise
   *
   * @see {@link EncounterService.findById} for access control logic
   */
  @Query(() => Encounter, { nullable: true, description: 'Get encounter by ID' })
  @UseGuards(JwtAuthGuard)
  async encounter(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Encounter | null> {
    return this.encounterService.findById(id, user) as Promise<Encounter | null>;
  }

  /**
   * Retrieves all encounters for a specific campaign.
   *
   * Returns both pending and resolved encounters. Use for campaign-wide
   * encounter lists, timeline views, or encounter history tracking.
   *
   * @param campaignId - Campaign identifier
   * @param user - Authenticated user (must be campaign member)
   * @returns Array of encounters in the campaign
   *
   * @see {@link EncounterService.findByCampaignId} for filtering logic
   */
  @Query(() => [Encounter], { description: 'Get all encounters for a campaign' })
  @UseGuards(JwtAuthGuard)
  async encountersByCampaign(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Encounter[]> {
    return this.encounterService.findByCampaignId(campaignId, user) as Promise<Encounter[]>;
  }

  /**
   * Retrieves all encounters at a specific location.
   *
   * Useful for displaying encounters on map views or showing location-specific
   * encounter lists. Includes both active and completed encounters at the location.
   *
   * @param locationId - Location identifier
   * @param user - Authenticated user (must be campaign member)
   * @returns Array of encounters at the location
   *
   * @see {@link EncounterService.findByLocationId} for location-based filtering
   */
  @Query(() => [Encounter], { description: 'Get all encounters at a location' })
  @UseGuards(JwtAuthGuard)
  async encountersByLocation(
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Encounter[]> {
    return this.encounterService.findByLocationId(locationId, user) as Promise<Encounter[]>;
  }

  /**
   * Creates a new encounter for combat, exploration, or social interactions.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry
   * - Encounter starts in pending (unresolved) state
   * - Can be linked to location, parties, and scheduled time
   * - Effects are registered but not executed until resolution
   *
   * @param input - Encounter creation data (name, type, participants, effects, etc.)
   * @param user - Authenticated user creating the encounter
   * @returns Newly created encounter
   *
   * @see {@link EncounterService.create} for validation and creation logic
   */
  @Mutation(() => Encounter, { description: 'Create a new encounter' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createEncounter(
    @Args('input') input: CreateEncounterInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Encounter> {
    return this.encounterService.create(input, user) as Promise<Encounter>;
  }

  /**
   * Updates an existing encounter's properties.
   *
   * Supports optimistic concurrency control via expectedVersion and
   * branch-aware updates for timeline scenarios. Can update encounter
   * details, participants, effects, or scheduled time.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry with diff
   * - Updates updatedAt timestamp
   * - Increments version for optimistic locking
   * - Branch-aware: updates apply to specified branch
   * - Cache invalidation for affected queries
   *
   * @param id - Encounter identifier
   * @param input - Fields to update (partial update supported, includes version/branch control)
   * @param user - Authenticated user performing the update
   * @returns Updated encounter
   *
   * @see {@link EncounterService.update} for update logic and validation
   */
  @Mutation(() => Encounter, { description: 'Update an encounter' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateEncounter(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateEncounterInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Encounter> {
    const { branchId, expectedVersion, worldTime, ...data } = input;
    return this.encounterService.update(
      id,
      data,
      user,
      expectedVersion,
      branchId,
      worldTime
    ) as Promise<Encounter>;
  }

  /**
   * Soft deletes an encounter by setting deletedAt timestamp.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets deletedAt to current timestamp
   * - Encounter excluded from normal queries but data preserved
   * - Can be restored via database if needed (no restore mutation provided)
   * - Creates audit log entry
   * - Cache invalidation for affected queries
   *
   * @param id - Encounter identifier
   * @param user - Authenticated user performing the deletion
   * @returns Deleted encounter with deletedAt set
   *
   * @see {@link EncounterService.delete} for soft delete implementation
   */
  @Mutation(() => Encounter, { description: 'Delete an encounter (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteEncounter(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Encounter> {
    return this.encounterService.delete(id, user) as Promise<Encounter>;
  }

  /**
   * Archives an encounter by setting archivedAt timestamp.
   *
   * Archiving is distinct from deletion - archived encounters are intentionally
   * preserved for historical reference but hidden from active encounter lists.
   * Useful for completed encounters you want to keep but reduce UI clutter.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets archivedAt to current timestamp
   * - Encounter excluded from normal queries
   * - Can be restored with restoreEncounter mutation
   * - Creates audit log entry
   * - Cache invalidation for affected queries
   *
   * @param id - Encounter identifier
   * @param user - Authenticated user performing the archive
   * @returns Archived encounter with archivedAt set
   *
   * @see {@link EncounterService.archive} for archive implementation
   */
  @Mutation(() => Encounter, { description: 'Archive an encounter' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveEncounter(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Encounter> {
    return this.encounterService.archive(id, user) as Promise<Encounter>;
  }

  /**
   * Restores an archived encounter to active status.
   *
   * Clears the archivedAt timestamp, making the encounter visible in normal
   * queries again. Use this to bring back archived encounters that are still
   * relevant or were archived prematurely.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Clears archivedAt timestamp
   * - Encounter becomes visible in normal queries
   * - Creates audit log entry
   * - Cache invalidation for affected queries
   *
   * @param id - Encounter identifier
   * @param user - Authenticated user performing the restore
   * @returns Restored encounter with archivedAt cleared
   *
   * @see {@link EncounterService.restore} for restore implementation
   */
  @Mutation(() => Encounter, { description: 'Restore an archived encounter' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreEncounter(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Encounter> {
    return this.encounterService.restore(id, user) as Promise<Encounter>;
  }

  /**
   * Resolves an encounter with 3-phase effect execution workflow.
   *
   * This is the core encounter resolution mutation that executes all registered
   * effects in a specific order (PRE -> ON_RESOLVE -> POST) and marks the
   * encounter as complete. Used for combat victories, successful explorations,
   * completed social interactions, etc.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Marks encounter as resolved (resolvedAt timestamp set)
   * - Executes PRE phase effects (pre-resolution setup)
   * - Executes ON_RESOLVE phase effects (main resolution logic)
   * - Executes POST phase effects (cleanup and consequences)
   * - Updates world state via JSON Patch operations
   * - Creates detailed audit log with effect summary
   * - Cache invalidation for affected entities and queries
   * - May trigger dependency graph updates
   * - May schedule follow-up events via scheduler
   *
   * **Effect Phases:**
   * - **PRE:** Setup effects before resolution (e.g., buff application)
   * - **ON_RESOLVE:** Main resolution effects (e.g., loot distribution, XP)
   * - **POST:** Cleanup and consequence effects (e.g., spawn follow-up events)
   *
   * @param id - Encounter identifier
   * @param user - Authenticated user performing the resolution
   * @returns Resolution result with updated encounter and effect summaries per phase
   *
   * @see {@link EncounterService.resolve} for resolution workflow implementation
   * @see {@link EffectService} for effect execution details
   */
  @Mutation(() => EncounterResolutionResult, {
    description: 'Resolve an encounter with 3-phase effect execution (PRE, ON_RESOLVE, POST)',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async resolveEncounter(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<EncounterResolutionResult> {
    const result = await this.encounterService.resolve(id, user);
    return {
      encounter: result.encounter as Encounter,
      pre: result.effectSummary.pre,
      onResolve: result.effectSummary.onResolve,
      post: result.effectSummary.post,
    };
  }
}
