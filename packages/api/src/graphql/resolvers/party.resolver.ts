/**
 * Party Resolver
 * GraphQL resolvers for Party queries and mutations
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';

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

@Resolver(() => Party)
export class PartyResolver {
  constructor(
    private readonly partyService: PartyService,
    private readonly variableSchemaService: VariableSchemaService
  ) {}

  @Query(() => Party, { nullable: true, description: 'Get party by ID' })
  @UseGuards(JwtAuthGuard)
  async party(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party | null> {
    return this.partyService.findById(id, user) as unknown as Party | null;
  }

  @Query(() => [Party], { description: 'Get all parties for a campaign' })
  @UseGuards(JwtAuthGuard)
  async partiesByCampaign(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party[]> {
    return this.partyService.findByCampaign(campaignId, user) as unknown as Party[];
  }

  @Mutation(() => Party, { description: 'Create a new party' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createParty(
    @Args('input') input: CreatePartyInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party> {
    return this.partyService.create(input, user) as unknown as Party;
  }

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

  @Mutation(() => Party, { description: 'Delete a party (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteParty(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party> {
    return this.partyService.delete(id, user) as unknown as Party;
  }

  @Mutation(() => Party, { description: 'Archive a party' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveParty(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party> {
    return this.partyService.archive(id, user) as unknown as Party;
  }

  @Mutation(() => Party, { description: 'Restore an archived party' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreParty(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party> {
    return this.partyService.restore(id, user) as unknown as Party;
  }

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

  @Mutation(() => Party, { description: 'Add a character to the party' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async addPartyMember(
    @Args('input') input: AddPartyMemberInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Party> {
    return this.partyService.addMember(input.partyId, input.characterId, user) as unknown as Party;
  }

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

  @Query(() => [Variable], { description: 'Get all variable values for a party' })
  @UseGuards(JwtAuthGuard)
  async partyVariables(
    @Args('partyId', { type: () => ID }) partyId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Variable[]> {
    const variables = await this.variableSchemaService.listVariables('party', partyId, user);
    return Object.entries(variables).map(([name, value]) => ({ name, value }));
  }

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
