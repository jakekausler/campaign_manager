/**
 * @fileoverview Variable Schema Service - Manages typed variable schemas for campaign entities.
 *
 * This service provides centralized management of variable schemas and values across all entity types
 * (Party, Kingdom, Settlement, Structure). It supports string, number, boolean, and enum types with
 * validation and default values.
 *
 * Key responsibilities:
 * - Define and manage variable schemas with type definitions
 * - Validate variable values against schema definitions
 * - Get/set variable values with type safety
 * - Handle CRUD operations for schemas and variables
 * - Enforce campaign-level permissions for schema modifications
 *
 * Variable schemas enable flexible, typed custom fields on entities without database migrations.
 * Each schema defines a variable's name, type, optional default value, and for enum types,
 * the allowed values.
 *
 * @module services/variable-schema
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

/**
 * Minimal interface representing the common fields across all entity types
 * that support variable schemas (Party, Kingdom, Settlement, Structure).
 * Used for type-safe access to entity properties.
 */
interface EntityWithVariables {
  id: string;
  variables: Prisma.JsonValue;
  variableSchemas: Prisma.JsonValue;
  campaignId?: string; // Optional - some entities access via relations
  kingdomId?: string; // Only Settlement
  settlementId?: string; // Only Structure
}

/**
 * Service for managing typed variable schemas and values across campaign entities.
 *
 * Provides centralized schema management for custom typed variables that can be attached to
 * Party, Kingdom, Settlement, and Structure entities. Supports string, number, boolean, and
 * enum types with validation and default values.
 *
 * Variable schemas enable flexible, extensible data models without requiring database migrations.
 * Each schema defines a variable's name, type, and constraints. Values are validated against
 * schemas when set.
 *
 * Permissions:
 * - Read access: Campaign members (any role)
 * - Write access: Campaign owner or GM
 *
 * All schema modifications are logged via AuditService for compliance and debugging.
 *
 * @example
 * // Define a schema
 * const schema: VariableSchema = {
 *   name: 'morale',
 *   type: 'number',
 *   defaultValue: 50
 * };
 * await service.defineSchema('party', partyId, schema, user);
 *
 * // Set a value
 * await service.setVariable('party', partyId, 'morale', 75, user);
 *
 * // Get a value
 * const morale = await service.getVariable('party', partyId, 'morale', user);
 *
 * @injectable
 */
@Injectable()
export class VariableSchemaService {
  /**
   * Creates an instance of VariableSchemaService.
   *
   * @param prisma - Database service for entity operations
   * @param audit - Audit service for logging schema changes
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Converts Prisma JsonValue to VariableSchema array.
   *
   * Safely parses the variableSchemas JSON field from entity records into a typed array.
   * Returns empty array if the value is null, undefined, or not an array.
   *
   * @param jsonValue - Raw JSON value from Prisma entity field
   * @returns Typed array of variable schemas, or empty array if invalid
   * @private
   */
  private parseSchemas(jsonValue: Prisma.JsonValue | null | undefined): VariableSchema[] {
    if (!jsonValue || !Array.isArray(jsonValue)) {
      return [];
    }
    return jsonValue as unknown as VariableSchema[];
  }

  /**
   * Validates a variable value against its schema definition.
   *
   * Performs type checking based on the schema's type field:
   * - string: Checks typeof value === 'string'
   * - number: Checks typeof value === 'number' and not NaN
   * - boolean: Checks typeof value === 'boolean'
   * - enum: Checks value is string and matches one of enumValues
   *
   * Enum types must have enumValues array defined in schema. Validation ensures the value
   * matches exactly one of the allowed enum values.
   *
   * @param schema - Variable schema definition containing type and constraints
   * @param value - Value to validate against the schema
   * @throws {BadRequestException} If value doesn't match schema type
   * @throws {BadRequestException} If enum schema missing enumValues
   * @throws {BadRequestException} If unknown variable type
   * @public
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
   * Defines or updates a variable schema for an entity.
   *
   * Creates a new schema or replaces an existing schema with the same name. The schema
   * defines a typed variable that can be attached to the entity. If a schema with the same
   * name already exists, it is replaced entirely (not merged).
   *
   * Supported types: 'string', 'number', 'boolean', 'enum'
   * For enum types, enumValues array is required in the schema definition.
   *
   * Requires campaign owner or GM permission. Logs the operation via AuditService.
   *
   * @param entityType - Type of entity ('party', 'kingdom', 'settlement', 'structure')
   * @param entityId - UUID of the entity
   * @param schema - Schema definition with name, type, optional defaultValue and enumValues
   * @param user - Authenticated user making the request
   * @returns The newly defined or updated schema
   * @throws {NotFoundException} If entity not found
   * @throws {ForbiddenException} If user lacks permission (not owner/GM)
   * @public
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
    const existingSchemas = this.parseSchemas(entity.variableSchemas);

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
   * Retrieves a specific variable schema by name.
   *
   * Returns the schema definition for a single variable identified by name. If no schema
   * with the given name exists, returns null.
   *
   * Requires read access (any campaign member).
   *
   * @param entityType - Type of entity ('party', 'kingdom', 'settlement', 'structure')
   * @param entityId - UUID of the entity
   * @param variableName - Name of the variable schema to retrieve
   * @param user - Authenticated user making the request
   * @returns The variable schema if found, null otherwise
   * @throws {NotFoundException} If entity not found
   * @throws {ForbiddenException} If user not a campaign member
   * @public
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

    const schemas = this.parseSchemas(entity.variableSchemas);
    const schema = schemas.find((s) => s.name === variableName);

    return schema || null;
  }

  /**
   * Lists all variable schemas defined for an entity.
   *
   * Returns all schema definitions for the entity. Returns empty array if no schemas defined.
   *
   * Requires read access (any campaign member).
   *
   * @param entityType - Type of entity ('party', 'kingdom', 'settlement', 'structure')
   * @param entityId - UUID of the entity
   * @param user - Authenticated user making the request
   * @returns Array of all variable schemas for the entity
   * @throws {NotFoundException} If entity not found
   * @throws {ForbiddenException} If user not a campaign member
   * @public
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

    return this.parseSchemas(entity.variableSchemas);
  }

  /**
   * Deletes a variable schema and its associated value.
   *
   * Removes the schema definition for the specified variable. If a value exists for this
   * variable, it is also removed from the entity's variables field. This is a destructive
   * operation that cannot be undone.
   *
   * Requires campaign owner or GM permission. Logs the operation via AuditService.
   *
   * @param entityType - Type of entity ('party', 'kingdom', 'settlement', 'structure')
   * @param entityId - UUID of the entity
   * @param variableName - Name of the variable schema to delete
   * @param user - Authenticated user making the request
   * @throws {NotFoundException} If entity not found
   * @throws {NotFoundException} If variable schema not found
   * @throws {ForbiddenException} If user lacks permission (not owner/GM)
   * @public
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

    const existingSchemas = this.parseSchemas(entity.variableSchemas);
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
   * Sets a variable value with type validation.
   *
   * Sets or updates a variable's value after validating it against the schema definition.
   * The schema must already exist before setting a value. The value is validated according
   * to the schema's type constraints.
   *
   * Validation rules:
   * - string: Must be a string
   * - number: Must be a number and not NaN
   * - boolean: Must be a boolean
   * - enum: Must match one of the enumValues exactly
   *
   * Requires campaign owner or GM permission. Logs the operation via AuditService.
   *
   * @param entityType - Type of entity ('party', 'kingdom', 'settlement', 'structure')
   * @param entityId - UUID of the entity
   * @param variableName - Name of the variable to set
   * @param value - Value to set (must match schema type)
   * @param user - Authenticated user making the request
   * @returns The value that was set
   * @throws {NotFoundException} If entity not found
   * @throws {NotFoundException} If variable schema not defined
   * @throws {BadRequestException} If value fails validation
   * @throws {ForbiddenException} If user lacks permission (not owner/GM)
   * @public
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
    const schemas = this.parseSchemas(entity.variableSchemas);
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
   * Retrieves a variable value.
   *
   * Returns the current value of the variable, or the schema's defaultValue if no value
   * has been explicitly set. The schema must exist before retrieving a value.
   *
   * Requires read access (any campaign member).
   *
   * @param entityType - Type of entity ('party', 'kingdom', 'settlement', 'structure')
   * @param entityId - UUID of the entity
   * @param variableName - Name of the variable to retrieve
   * @param user - Authenticated user making the request
   * @returns The variable's value, or defaultValue if not set, or undefined if no default
   * @throws {NotFoundException} If entity not found
   * @throws {NotFoundException} If variable schema not defined
   * @throws {ForbiddenException} If user not a campaign member
   * @public
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
    const schemas = this.parseSchemas(entity.variableSchemas);
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
   * Lists all variable values for an entity.
   *
   * Returns all variable values currently set on the entity as a key-value map.
   * Does not include default values for variables that haven't been explicitly set.
   * Returns empty object if no variables have been set.
   *
   * Requires read access (any campaign member).
   *
   * @param entityType - Type of entity ('party', 'kingdom', 'settlement', 'structure')
   * @param entityId - UUID of the entity
   * @param user - Authenticated user making the request
   * @returns Object mapping variable names to their current values
   * @throws {NotFoundException} If entity not found
   * @throws {ForbiddenException} If user not a campaign member
   * @public
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
   * Retrieves an entity with read access permission check.
   *
   * Fetches the entity from the database and verifies the user has read access through
   * campaign membership. Read access is granted to campaign owner and all members regardless
   * of role.
   *
   * For each entity type, traverses relationships to reach the campaign:
   * - party: Direct campaignId
   * - kingdom: Direct campaignId
   * - settlement: Through kingdom.campaignId
   * - structure: Through settlement.kingdom.campaignId
   *
   * Only returns non-deleted entities from non-deleted campaigns.
   *
   * @param entityType - Type of entity ('party', 'kingdom', 'settlement', 'structure')
   * @param entityId - UUID of the entity
   * @param user - Authenticated user making the request
   * @returns Entity with variables fields, or null if not found/no access
   * @throws {BadRequestException} If entityType is invalid
   * @private
   */
  private async getEntity(
    entityType: EntityType,
    entityId: string,
    user: AuthenticatedUser
  ): Promise<EntityWithVariables | null> {
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
   * Retrieves an entity with edit permission check.
   *
   * Fetches the entity from the database and verifies the user has edit permission.
   * Edit permission requires campaign owner or GM role. First calls getEntity() to fetch
   * with read access, then traverses relationships to find campaign and verify role.
   *
   * For each entity type, determines campaign through:
   * - party/kingdom: Direct campaignId field
   * - settlement: Fetches kingdom to get campaignId
   * - structure: Fetches settlement and its kingdom to get campaignId
   *
   * @param entityType - Type of entity ('party', 'kingdom', 'settlement', 'structure')
   * @param entityId - UUID of the entity
   * @param user - Authenticated user making the request
   * @returns Entity with variables fields, or null if not found
   * @throws {NotFoundException} If campaign or parent entities not found
   * @throws {ForbiddenException} If user not owner/GM
   * @throws {BadRequestException} If entityType is invalid
   * @private
   */
  private async getEntityWithPermissionCheck(
    entityType: EntityType,
    entityId: string,
    user: AuthenticatedUser
  ): Promise<EntityWithVariables | null> {
    const entity = await this.getEntity(entityType, entityId, user);

    if (!entity) {
      return null;
    }

    // Get campaign ID based on entity type
    let campaignId: string;

    switch (entityType) {
      case 'party':
      case 'kingdom':
        if (!entity.campaignId) {
          throw new NotFoundException(`Campaign ID not found for ${entityType} ${entityId}`);
        }
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
   * Updates the variableSchemas field for an entity.
   *
   * Writes the schema array to the entity's variableSchemas JSON field. Uses a switch
   * statement to call the correct Prisma model's update method based on entity type.
   *
   * @param entityType - Type of entity ('party', 'kingdom', 'settlement', 'structure')
   * @param entityId - UUID of the entity
   * @param schemas - Array of variable schemas to write
   * @throws {BadRequestException} If entityType is invalid
   * @private
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
   * Updates the variables field for an entity.
   *
   * Writes the variable values to the entity's variables JSON field. Uses a switch
   * statement to call the correct Prisma model's update method based on entity type.
   *
   * @param entityType - Type of entity ('party', 'kingdom', 'settlement', 'structure')
   * @param entityId - UUID of the entity
   * @param variables - Key-value map of variable names to their values
   * @throws {BadRequestException} If entityType is invalid
   * @private
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
   * Updates both variableSchemas and variables fields atomically.
   *
   * Performs a single database update that modifies both the variableSchemas and variables
   * JSON fields. Used primarily when deleting a schema to ensure the schema definition and
   * its value are removed together in a single transaction.
   *
   * @param entityType - Type of entity ('party', 'kingdom', 'settlement', 'structure')
   * @param entityId - UUID of the entity
   * @param schemas - Array of variable schemas to write
   * @param variables - Key-value map of variable names to their values
   * @throws {BadRequestException} If entityType is invalid
   * @private
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
