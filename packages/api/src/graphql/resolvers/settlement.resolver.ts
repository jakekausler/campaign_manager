/**
 * Settlement Resolver
 * GraphQL resolvers for Settlement queries and mutations
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
import type { Settlement as PrismaSettlement } from '@prisma/client';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser, GraphQLContext } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import type {
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

@Resolver(() => Settlement)
export class SettlementResolver {
  private readonly logger = new Logger(SettlementResolver.name);

  constructor(
    private readonly settlementService: SettlementService,
    private readonly variableSchemaService: VariableSchemaService
  ) {}

  @Query(() => Settlement, { nullable: true, description: 'Get settlement by ID' })
  @UseGuards(JwtAuthGuard)
  async settlement(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement | null> {
    return this.settlementService.findById(id, user) as unknown as Settlement | null;
  }

  @Query(() => [Settlement], { description: 'Get all settlements for a kingdom' })
  @UseGuards(JwtAuthGuard)
  async settlementsByKingdom(
    @Args('kingdomId', { type: () => ID }) kingdomId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement[]> {
    return this.settlementService.findByKingdom(kingdomId, user) as unknown as Settlement[];
  }

  @Mutation(() => Settlement, { description: 'Create a new settlement' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createSettlement(
    @Args('input') input: CreateSettlementInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement> {
    return this.settlementService.create(input, user) as unknown as Settlement;
  }

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

  @Mutation(() => Settlement, { description: 'Delete a settlement (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteSettlement(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement> {
    return this.settlementService.delete(id, user) as unknown as Settlement;
  }

  @Mutation(() => Settlement, { description: 'Archive a settlement' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveSettlement(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement> {
    return this.settlementService.archive(id, user) as unknown as Settlement;
  }

  @Mutation(() => Settlement, { description: 'Restore an archived settlement' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreSettlement(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement> {
    return this.settlementService.restore(id, user) as unknown as Settlement;
  }

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

  @ResolveField(() => [Structure], { description: 'Structures in this settlement' })
  async structures(
    @Parent() settlement: Settlement,
    @Context() context: GraphQLContext
  ): Promise<Structure[]> {
    // Use DataLoader to batch and cache structure queries
    return context.dataloaders.structureLoader.load(settlement.id) as unknown as Structure[];
  }

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
