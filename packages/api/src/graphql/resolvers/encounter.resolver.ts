/**
 * Encounter Resolver
 * GraphQL resolvers for Encounter queries and mutations
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CreateEncounterInput, UpdateEncounterInput } from '../inputs/encounter.input';
import { EncounterService } from '../services/encounter.service';
import { Encounter, EncounterResolutionResult } from '../types/encounter.type';

@Resolver(() => Encounter)
export class EncounterResolver {
  constructor(private readonly encounterService: EncounterService) {}

  @Query(() => Encounter, { nullable: true, description: 'Get encounter by ID' })
  @UseGuards(JwtAuthGuard)
  async encounter(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Encounter | null> {
    return this.encounterService.findById(id, user) as Promise<Encounter | null>;
  }

  @Query(() => [Encounter], { description: 'Get all encounters for a campaign' })
  @UseGuards(JwtAuthGuard)
  async encountersByCampaign(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Encounter[]> {
    return this.encounterService.findByCampaignId(campaignId, user) as Promise<Encounter[]>;
  }

  @Query(() => [Encounter], { description: 'Get all encounters at a location' })
  @UseGuards(JwtAuthGuard)
  async encountersByLocation(
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Encounter[]> {
    return this.encounterService.findByLocationId(locationId, user) as Promise<Encounter[]>;
  }

  @Mutation(() => Encounter, { description: 'Create a new encounter' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createEncounter(
    @Args('input') input: CreateEncounterInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Encounter> {
    return this.encounterService.create(input, user) as Promise<Encounter>;
  }

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

  @Mutation(() => Encounter, { description: 'Delete an encounter (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteEncounter(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Encounter> {
    return this.encounterService.delete(id, user) as Promise<Encounter>;
  }

  @Mutation(() => Encounter, { description: 'Archive an encounter' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveEncounter(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Encounter> {
    return this.encounterService.archive(id, user) as Promise<Encounter>;
  }

  @Mutation(() => Encounter, { description: 'Restore an archived encounter' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreEncounter(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Encounter> {
    return this.encounterService.restore(id, user) as Promise<Encounter>;
  }

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
