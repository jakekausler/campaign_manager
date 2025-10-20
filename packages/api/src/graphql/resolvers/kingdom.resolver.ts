/**
 * Kingdom Resolver
 * GraphQL resolvers for Kingdom queries and mutations
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

  @Query(() => Kingdom, { nullable: true, description: 'Get kingdom by ID' })
  @UseGuards(JwtAuthGuard)
  async kingdom(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom | null> {
    return this.kingdomService.findById(id, user) as unknown as Kingdom | null;
  }

  @Query(() => [Kingdom], { description: 'Get all kingdoms for a campaign' })
  @UseGuards(JwtAuthGuard)
  async kingdomsByCampaign(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom[]> {
    return this.kingdomService.findByCampaign(campaignId, user) as unknown as Kingdom[];
  }

  @Mutation(() => Kingdom, { description: 'Create a new kingdom' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createKingdom(
    @Args('input') input: CreateKingdomInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom> {
    return this.kingdomService.create(input, user) as unknown as Kingdom;
  }

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

  @Mutation(() => Kingdom, { description: 'Delete a kingdom (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteKingdom(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom> {
    return this.kingdomService.delete(id, user) as unknown as Kingdom;
  }

  @Mutation(() => Kingdom, { description: 'Archive a kingdom' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveKingdom(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom> {
    return this.kingdomService.archive(id, user) as unknown as Kingdom;
  }

  @Mutation(() => Kingdom, { description: 'Restore an archived kingdom' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreKingdom(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom> {
    return this.kingdomService.restore(id, user) as unknown as Kingdom;
  }

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

  @Query(() => [Variable], { description: 'Get all variable values for a kingdom' })
  @UseGuards(JwtAuthGuard)
  async kingdomVariables(
    @Args('kingdomId', { type: () => ID }) kingdomId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Variable[]> {
    const variables = await this.variableSchemaService.listVariables('kingdom', kingdomId, user);
    return Object.entries(variables).map(([name, value]) => ({ name, value }));
  }

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
