/**
 * Variable Schema Types
 * Type definitions for typed variable schemas
 */

import { ObjectType, Field, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

export type VariableType = 'string' | 'number' | 'boolean' | 'enum';

export type EntityType = 'party' | 'kingdom' | 'settlement' | 'structure';

export interface VariableSchema {
  name: string;
  type: VariableType;
  enumValues?: string[];
  defaultValue?: unknown;
  description?: string;
}

/**
 * GraphQL Enum for Variable Types
 */
export enum VariableTypeEnum {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ENUM = 'enum',
}

registerEnumType(VariableTypeEnum, {
  name: 'SchemaVariableType',
  description: 'Type of a typed variable',
});

/**
 * GraphQL Object Type for Variable Schema
 */
@ObjectType({ description: 'Schema definition for a typed variable' })
export class VariableSchemaType {
  @Field(() => String, { description: 'Name of the variable' })
  name!: string;

  @Field(() => VariableTypeEnum, { description: 'Data type of the variable' })
  type!: VariableTypeEnum;

  @Field(() => [String], { nullable: true, description: 'Possible values for enum type' })
  enumValues?: string[];

  @Field(() => GraphQLJSON, { nullable: true, description: 'Default value for the variable' })
  defaultValue?: unknown;

  @Field(() => String, { nullable: true, description: 'Description of the variable' })
  description?: string;
}

/**
 * GraphQL Object Type for Variable Value
 */
@ObjectType({ description: 'A typed variable with its value' })
export class Variable {
  @Field(() => String, { description: 'Name of the variable' })
  name!: string;

  @Field(() => GraphQLJSON, { description: 'Value of the variable' })
  value!: unknown;
}
