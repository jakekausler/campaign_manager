/**
 * Structure Resolver
 * GraphQL resolvers for Structure queries and mutations
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
import type { Structure as PrismaStructure } from '@prisma/client';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser, GraphQLContext } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CreateStructureInput, UpdateStructureInput } from '../inputs/structure.input';
import { DefineVariableSchemaInput, SetVariableInput } from '../inputs/variable.input';
import { StructureService } from '../services/structure.service';
import { VariableSchemaService } from '../services/variable-schema.service';
import { Settlement } from '../types/settlement.type';
import { Structure } from '../types/structure.type';
import { Variable, VariableSchemaType, VariableTypeEnum } from '../types/variable-schema.types';

@Resolver(() => Structure)
export class StructureResolver {
  private readonly logger = new Logger(StructureResolver.name);

  constructor(
    private readonly structureService: StructureService,
    private readonly variableSchemaService: VariableSchemaService
  ) {}

  @Query(() => Structure, { nullable: true, description: 'Get structure by ID' })
  @UseGuards(JwtAuthGuard)
  async structure(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure | null> {
    return this.structureService.findById(id, user) as unknown as Structure | null;
  }

  @Query(() => [Structure], { description: 'Get all structures for a settlement' })
  @UseGuards(JwtAuthGuard)
  async structuresBySettlement(
    @Args('settlementId', { type: () => ID }) settlementId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure[]> {
    return this.structureService.findBySettlement(settlementId, user) as unknown as Structure[];
  }

  @Mutation(() => Structure, { description: 'Create a new structure' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createStructure(
    @Args('input') input: CreateStructureInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure> {
    return this.structureService.create(input, user) as unknown as Structure;
  }

  @Mutation(() => Structure, { description: 'Update a structure' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateStructure(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateStructureInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure> {
    const { branchId, expectedVersion, worldTime, ...data } = input;
    return this.structureService.update(
      id,
      data,
      user,
      expectedVersion,
      branchId,
      worldTime
    ) as unknown as Structure;
  }

  @Mutation(() => Structure, { description: 'Delete a structure (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteStructure(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure> {
    return this.structureService.delete(id, user) as unknown as Structure;
  }

  @Mutation(() => Structure, { description: 'Archive a structure' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveStructure(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure> {
    return this.structureService.archive(id, user) as unknown as Structure;
  }

  @Mutation(() => Structure, { description: 'Restore an archived structure' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreStructure(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure> {
    return this.structureService.restore(id, user) as unknown as Structure;
  }

  @Mutation(() => Structure, { description: 'Set structure level' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async setStructureLevel(
    @Args('id', { type: () => ID }) id: string,
    @Args('level', { type: () => Int }) level: number,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure> {
    return this.structureService.setLevel(id, level, user) as unknown as Structure;
  }

  @Mutation(() => VariableSchemaType, { description: 'Define a variable schema for a structure' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async defineStructureVariableSchema(
    @Args('structureId', { type: () => ID }) structureId: string,
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
      'structure',
      structureId,
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

  @Mutation(() => Variable, { description: 'Set a variable value for a structure' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async setStructureVariable(
    @Args('structureId', { type: () => ID }) structureId: string,
    @Args('input') input: SetVariableInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Variable> {
    const value = await this.variableSchemaService.setVariable(
      'structure',
      structureId,
      input.name,
      input.value,
      user
    );
    return { name: input.name, value };
  }

  @Mutation(() => Boolean, { description: 'Delete a variable schema for a structure' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteStructureVariableSchema(
    @Args('structureId', { type: () => ID }) structureId: string,
    @Args('name') name: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<boolean> {
    await this.variableSchemaService.deleteSchema('structure', structureId, name, user);
    return true;
  }

  @Query(() => Variable, { nullable: true, description: 'Get a variable value for a structure' })
  @UseGuards(JwtAuthGuard)
  async structureVariable(
    @Args('structureId', { type: () => ID }) structureId: string,
    @Args('name') name: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Variable | null> {
    try {
      const value = await this.variableSchemaService.getVariable(
        'structure',
        structureId,
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

  @Query(() => [Variable], { description: 'Get all variable values for a structure' })
  @UseGuards(JwtAuthGuard)
  async structureVariables(
    @Args('structureId', { type: () => ID }) structureId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Variable[]> {
    const variables = await this.variableSchemaService.listVariables(
      'structure',
      structureId,
      user
    );
    return Object.entries(variables).map(([name, value]) => ({ name, value }));
  }

  @Query(() => [VariableSchemaType], { description: 'Get all variable schemas for a structure' })
  @UseGuards(JwtAuthGuard)
  async structureVariableSchemas(
    @Args('structureId', { type: () => ID }) structureId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<VariableSchemaType[]> {
    const schemas = await this.variableSchemaService.listSchemas('structure', structureId, user);
    return schemas.map((schema) => ({
      name: schema.name,
      type: VariableTypeEnum[schema.type.toUpperCase() as keyof typeof VariableTypeEnum],
      enumValues: schema.enumValues,
      defaultValue: schema.defaultValue,
      description: schema.description,
    }));
  }

  @ResolveField(() => Settlement, {
    nullable: true,
    description: 'The settlement this structure belongs to',
  })
  async settlement(
    @Parent() structure: Structure,
    @Context() context: GraphQLContext
  ): Promise<Settlement | null> {
    // Use DataLoader to batch and cache settlement queries
    // The loader returns a Settlement with Location from Prisma
    // GraphQL will handle the null->undefined conversion for optional fields
    return context.dataloaders.settlementLoader.load(
      structure.settlementId
    ) as Promise<Settlement | null>;
  }

  @ResolveField(() => Object, {
    nullable: true,
    description: 'Computed fields from evaluated conditions',
  })
  async computedFields(
    @Parent() structure: Structure,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Record<string, unknown>> {
    try {
      return await this.structureService.getComputedFields(
        structure as unknown as PrismaStructure,
        user
      );
    } catch (error) {
      // Return empty object on error (graceful degradation)
      this.logger.error(
        `Failed to resolve computed fields for structure ${structure.id}`,
        error instanceof Error ? error.stack : undefined
      );
      return {};
    }
  }
}
