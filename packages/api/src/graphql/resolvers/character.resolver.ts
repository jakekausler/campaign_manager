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

  @Query(() => Character, { nullable: true, description: 'Get character by ID' })
  @UseGuards(JwtAuthGuard)
  async character(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Character | null> {
    return this.characterService.findById(id, user) as Promise<Character | null>;
  }

  @Query(() => [Character], { description: 'Get all characters for a campaign' })
  @UseGuards(JwtAuthGuard)
  async charactersByCampaign(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Character[]> {
    return this.characterService.findByCampaign(campaignId, user) as Promise<Character[]>;
  }

  @Query(() => [Character], { description: 'Get all characters in a party' })
  @UseGuards(JwtAuthGuard)
  async charactersByParty(
    @Args('partyId', { type: () => ID }) partyId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Character[]> {
    return this.characterService.findByPartyId(partyId, user) as Promise<Character[]>;
  }

  @Mutation(() => Character, { description: 'Create a new character' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createCharacter(
    @Args('input') input: CreateCharacterInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Character> {
    return this.characterService.create(input, user) as Promise<Character>;
  }

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

  @Mutation(() => Character, { description: 'Delete a character (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteCharacter(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Character> {
    return this.characterService.delete(id, user) as Promise<Character>;
  }

  @Mutation(() => Character, { description: 'Archive a character' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveCharacter(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Character> {
    return this.characterService.archive(id, user) as Promise<Character>;
  }

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
