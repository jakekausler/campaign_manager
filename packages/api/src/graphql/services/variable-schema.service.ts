/**
 * VariableSchemaService
 * Centralized service for managing typed variable schemas across all entity types
 * Supports string, number, boolean, and enum types with validation
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import type { VariableSchema, EntityType } from '../types/variable-schema.types';

import { AuditService } from './audit.service';

@Injectable()
export class VariableSchemaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Validate a variable value against its schema
   * Throws BadRequestException if validation fails
   */
  validateVariableValue(schema: VariableSchema, value: unknown): void {
    switch (schema.type) {
      case 'string':
        if (typeof value !== 'string') {
          throw new BadRequestException(
            `Variable "${schema.name}" must be a string, but received ${typeof value}`
          );
        }
        break;

      case 'number':
        if (typeof value !== 'number' || Number.isNaN(value)) {
          throw new BadRequestException(
            `Variable "${schema.name}" must be a number, but received ${typeof value}`
          );
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new BadRequestException(
            `Variable "${schema.name}" must be a boolean, but received ${typeof value}`
          );
        }
        break;

      case 'enum':
        if (!schema.enumValues || schema.enumValues.length === 0) {
          throw new BadRequestException(
            `Variable "${schema.name}" is of type enum but has no enumValues defined`
          );
        }
        if (typeof value !== 'string' || !schema.enumValues.includes(value)) {
          throw new BadRequestException(
            `Variable "${schema.name}" must be one of [${schema.enumValues.join(', ')}], but received "${value}"`
          );
        }
        break;

      default:
        throw new BadRequestException(`Unknown variable type: ${schema.type}`);
    }
  }

  /**
   * Define or update a variable schema for an entity
   * Replaces existing schema with the same name
   */
  async defineSchema(
    entityType: EntityType,
    entityId: string,
    schema: VariableSchema,
    user: AuthenticatedUser
  ): Promise<VariableSchema> {
    // Fetch entity and verify permissions
    const entity = await this.getEntityWithPermissionCheck(entityType, entityId, user);

    if (!entity) {
      throw new NotFoundException(`${entityType} with ID ${entityId} not found`);
    }

    // Get existing schemas
    const existingSchemas = (entity.variableSchemas as VariableSchema[]) || [];

    // Remove any existing schema with the same name
    const filteredSchemas = existingSchemas.filter((s) => s.name !== schema.name);

    // Add new schema
    const updatedSchemas = [...filteredSchemas, schema];

    // Update entity with new schemas
    await this.updateEntitySchemas(entityType, entityId, updatedSchemas);

    // Audit log
    await this.audit.log(entityType, entityId, 'UPDATE', user.id, {
      defineSchema: schema,
    });

    return schema;
  }

  /**
   * Get a specific variable schema by name
   */
  async getSchema(
    entityType: EntityType,
    entityId: string,
    variableName: string,
    user: AuthenticatedUser
  ): Promise<VariableSchema | null> {
    const entity = await this.getEntity(entityType, entityId, user);

    if (!entity) {
      throw new NotFoundException(`${entityType} with ID ${entityId} not found`);
    }

    const schemas = (entity.variableSchemas as VariableSchema[]) || [];
    const schema = schemas.find((s) => s.name === variableName);

    return schema || null;
  }

  /**
   * List all variable schemas for an entity
   */
  async listSchemas(
    entityType: EntityType,
    entityId: string,
    user: AuthenticatedUser
  ): Promise<VariableSchema[]> {
    const entity = await this.getEntity(entityType, entityId, user);

    if (!entity) {
      throw new NotFoundException(`${entityType} with ID ${entityId} not found`);
    }

    return (entity.variableSchemas as VariableSchema[]) || [];
  }

  /**
   * Delete a variable schema
   * Also removes the variable value if it exists
   */
  async deleteSchema(
    entityType: EntityType,
    entityId: string,
    variableName: string,
    user: AuthenticatedUser
  ): Promise<void> {
    const entity = await this.getEntityWithPermissionCheck(entityType, entityId, user);

    if (!entity) {
      throw new NotFoundException(`${entityType} with ID ${entityId} not found`);
    }

    const existingSchemas = (entity.variableSchemas as VariableSchema[]) || [];
    const schemaExists = existingSchemas.some((s) => s.name === variableName);

    if (!schemaExists) {
      throw new NotFoundException(
        `Variable schema "${variableName}" not found on ${entityType} ${entityId}`
      );
    }

    // Remove schema
    const updatedSchemas = existingSchemas.filter((s) => s.name !== variableName);

    // Remove variable value if it exists
    const variables = (entity.variables as Record<string, unknown>) || {};
    const updatedVariables = { ...variables };
    delete updatedVariables[variableName];

    // Update entity
    await this.updateEntitySchemasAndVariables(
      entityType,
      entityId,
      updatedSchemas,
      updatedVariables
    );

    // Audit log
    await this.audit.log(entityType, entityId, 'UPDATE', user.id, {
      deleteSchema: variableName,
    });
  }

  /**
   * Set a variable value with validation
   */
  async setVariable(
    entityType: EntityType,
    entityId: string,
    variableName: string,
    value: unknown,
    user: AuthenticatedUser
  ): Promise<unknown> {
    const entity = await this.getEntityWithPermissionCheck(entityType, entityId, user);

    if (!entity) {
      throw new NotFoundException(`${entityType} with ID ${entityId} not found`);
    }

    // Find schema
    const schemas = (entity.variableSchemas as VariableSchema[]) || [];
    const schema = schemas.find((s) => s.name === variableName);

    if (!schema) {
      throw new NotFoundException(
        `Variable schema "${variableName}" not defined on ${entityType} ${entityId}. Define schema first.`
      );
    }

    // Validate value
    this.validateVariableValue(schema, value);

    // Update variables
    const variables = (entity.variables as Record<string, unknown>) || {};
    const updatedVariables = {
      ...variables,
      [variableName]: value,
    };

    await this.updateEntityVariables(entityType, entityId, updatedVariables);

    // Audit log
    await this.audit.log(entityType, entityId, 'UPDATE', user.id, {
      setVariable: { name: variableName, value },
    });

    return value;
  }

  /**
   * Get a variable value
   * Returns the value, default value if not set, or undefined
   */
  async getVariable(
    entityType: EntityType,
    entityId: string,
    variableName: string,
    user: AuthenticatedUser
  ): Promise<unknown> {
    const entity = await this.getEntity(entityType, entityId, user);

    if (!entity) {
      throw new NotFoundException(`${entityType} with ID ${entityId} not found`);
    }

    // Find schema
    const schemas = (entity.variableSchemas as VariableSchema[]) || [];
    const schema = schemas.find((s) => s.name === variableName);

    if (!schema) {
      throw new NotFoundException(
        `Variable schema "${variableName}" not defined on ${entityType} ${entityId}`
      );
    }

    // Get value or default
    const variables = (entity.variables as Record<string, unknown>) || {};
    const value = variables[variableName];

    return value !== undefined ? value : schema.defaultValue;
  }

  /**
   * List all variable values for an entity
   */
  async listVariables(
    entityType: EntityType,
    entityId: string,
    user: AuthenticatedUser
  ): Promise<Record<string, unknown>> {
    const entity = await this.getEntity(entityType, entityId, user);

    if (!entity) {
      throw new NotFoundException(`${entityType} with ID ${entityId} not found`);
    }

    return (entity.variables as Record<string, unknown>) || {};
  }

  /**
   * Get entity with read access check
   */
  private async getEntity(
    entityType: EntityType,
    entityId: string,
    user: AuthenticatedUser
  ): Promise<any> {
    const where = {
      id: entityId,
      deletedAt: null,
    };

    switch (entityType) {
      case 'party':
        return this.prisma.party.findFirst({
          where: {
            ...where,
            campaign: {
              deletedAt: null,
              OR: [
                { ownerId: user.id },
                {
                  memberships: {
                    some: {
                      userId: user.id,
                    },
                  },
                },
              ],
            },
          },
        });

      case 'kingdom':
        return this.prisma.kingdom.findFirst({
          where: {
            ...where,
            campaign: {
              deletedAt: null,
              OR: [
                { ownerId: user.id },
                {
                  memberships: {
                    some: {
                      userId: user.id,
                    },
                  },
                },
              ],
            },
          },
        });

      case 'settlement':
        return this.prisma.settlement.findFirst({
          where: {
            ...where,
            kingdom: {
              campaign: {
                deletedAt: null,
                OR: [
                  { ownerId: user.id },
                  {
                    memberships: {
                      some: {
                        userId: user.id,
                      },
                    },
                  },
                ],
              },
            },
          },
        });

      case 'structure':
        return this.prisma.structure.findFirst({
          where: {
            ...where,
            settlement: {
              kingdom: {
                campaign: {
                  deletedAt: null,
                  OR: [
                    { ownerId: user.id },
                    {
                      memberships: {
                        some: {
                          userId: user.id,
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        });

      default:
        throw new BadRequestException(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Get entity with edit permission check
   */
  private async getEntityWithPermissionCheck(
    entityType: EntityType,
    entityId: string,
    user: AuthenticatedUser
  ): Promise<any> {
    const entity = await this.getEntity(entityType, entityId, user);

    if (!entity) {
      return null;
    }

    // Get campaign ID based on entity type
    let campaignId: string;

    switch (entityType) {
      case 'party':
      case 'kingdom':
        campaignId = entity.campaignId;
        break;

      case 'settlement': {
        const kingdom = await this.prisma.kingdom.findFirst({
          where: { id: entity.kingdomId },
        });
        if (!kingdom) {
          throw new NotFoundException(`Kingdom not found for settlement ${entityId}`);
        }
        campaignId = kingdom.campaignId;
        break;
      }

      case 'structure': {
        const settlement = await this.prisma.settlement.findFirst({
          where: { id: entity.settlementId },
          include: { kingdom: true },
        });
        if (!settlement) {
          throw new NotFoundException(`Settlement not found for structure ${entityId}`);
        }
        campaignId = settlement.kingdom.campaignId;
        break;
      }

      default:
        throw new BadRequestException(`Unknown entity type: ${entityType}`);
    }

    // Check edit permission (owner or GM)
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        deletedAt: null,
        OR: [
          { ownerId: user.id },
          {
            memberships: {
              some: {
                userId: user.id,
                role: {
                  in: ['OWNER', 'GM'],
                },
              },
            },
          },
        ],
      },
    });

    if (!campaign) {
      throw new ForbiddenException(`You do not have permission to modify this ${entityType}`);
    }

    return entity;
  }

  /**
   * Update entity variable schemas
   */
  private async updateEntitySchemas(
    entityType: EntityType,
    entityId: string,
    schemas: VariableSchema[]
  ): Promise<void> {
    const data = {
      variableSchemas: schemas as unknown as Prisma.InputJsonValue,
    };

    switch (entityType) {
      case 'party':
        await this.prisma.party.update({ where: { id: entityId }, data });
        break;
      case 'kingdom':
        await this.prisma.kingdom.update({ where: { id: entityId }, data });
        break;
      case 'settlement':
        await this.prisma.settlement.update({ where: { id: entityId }, data });
        break;
      case 'structure':
        await this.prisma.structure.update({ where: { id: entityId }, data });
        break;
      default:
        throw new BadRequestException(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Update entity variables
   */
  private async updateEntityVariables(
    entityType: EntityType,
    entityId: string,
    variables: Record<string, unknown>
  ): Promise<void> {
    const data = {
      variables: variables as Prisma.InputJsonValue,
    };

    switch (entityType) {
      case 'party':
        await this.prisma.party.update({ where: { id: entityId }, data });
        break;
      case 'kingdom':
        await this.prisma.kingdom.update({ where: { id: entityId }, data });
        break;
      case 'settlement':
        await this.prisma.settlement.update({ where: { id: entityId }, data });
        break;
      case 'structure':
        await this.prisma.structure.update({ where: { id: entityId }, data });
        break;
      default:
        throw new BadRequestException(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Update both schemas and variables (used when deleting schema)
   */
  private async updateEntitySchemasAndVariables(
    entityType: EntityType,
    entityId: string,
    schemas: VariableSchema[],
    variables: Record<string, unknown>
  ): Promise<void> {
    const data = {
      variableSchemas: schemas as unknown as Prisma.InputJsonValue,
      variables: variables as Prisma.InputJsonValue,
    };

    switch (entityType) {
      case 'party':
        await this.prisma.party.update({ where: { id: entityId }, data });
        break;
      case 'kingdom':
        await this.prisma.kingdom.update({ where: { id: entityId }, data });
        break;
      case 'settlement':
        await this.prisma.settlement.update({ where: { id: entityId }, data });
        break;
      case 'structure':
        await this.prisma.structure.update({ where: { id: entityId }, data });
        break;
      default:
        throw new BadRequestException(`Unknown entity type: ${entityType}`);
    }
  }
}
