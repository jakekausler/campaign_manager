/**
 * Party Resolver
 * GraphQL resolvers for Party queries and mutations
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { CreatePartyInput, UpdatePartyInput } from '../inputs/party.input';
import { PartyService } from '../services/party.service';
import { Party } from '../types/party.type';

@Resolver(() => Party)
export class PartyResolver {
  constructor(private readonly partyService: PartyService) {}

  @Query(() => Party, { nullable: true, description: 'Get party by ID' })
  @UseGuards(JwtAuthGuard)
  async party(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party | null> {
    return this.partyService.findById(id, user) as Promise<Party | null>;
  }

  @Query(() => [Party], { description: 'Get all parties for a campaign' })
  @UseGuards(JwtAuthGuard)
  async partiesByCampaign(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party[]> {
    return this.partyService.findByCampaign(campaignId, user) as Promise<Party[]>;
  }

  @Mutation(() => Party, { description: 'Create a new party' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createParty(
    @Args('input') input: CreatePartyInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party> {
    return this.partyService.create(input, user) as Promise<Party>;
  }

  @Mutation(() => Party, { description: 'Update a party' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateParty(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePartyInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party> {
    return this.partyService.update(id, input, user) as Promise<Party>;
  }

  @Mutation(() => Party, { description: 'Delete a party (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteParty(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party> {
    return this.partyService.delete(id, user) as Promise<Party>;
  }

  @Mutation(() => Party, { description: 'Archive a party' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveParty(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party> {
    return this.partyService.archive(id, user) as Promise<Party>;
  }

  @Mutation(() => Party, { description: 'Restore an archived party' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreParty(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party> {
    return this.partyService.restore(id, user) as Promise<Party>;
  }
}
