/**
 * State Variable Input Types
 * DTOs for StateVariable mutations and queries
 */

import { InputType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import {
  IsString,
  IsInt,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
  IsEnum,
  ValidateIf,
  IsUUID,
} from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

import { VariableScope, VariableType } from '../types/state-variable.type';

import { SortOrder } from './filter.input';

/**
 * Input for creating a new state variable
 */
@InputType()
export class CreateStateVariableInput {
  @Field(() => VariableScope, {
    description: 'The scope level of this variable',
  })
  @IsEnum(VariableScope)
  @IsNotEmpty()
  scope!: VariableScope;

  @Field(() => ID, {
    nullable: true,
    description: 'ID of the scope entity (null for world-level variables)',
  })
  @IsString()
  @IsOptional()
  scopeId?: string | null;

  @Field(() => String, { description: 'Variable name/key within the scope' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'The value to store (required for non-derived variables, null for derived)',
  })
  @ValidateIf((o) => o.type !== VariableType.DERIVED)
  @IsNotEmpty()
  value?: unknown | null;

  @Field(() => VariableType, {
    description: 'The data type of this variable',
  })
  @IsEnum(VariableType)
  @IsNotEmpty()
  type!: VariableType;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'JSONLogic formula for derived variables (required if type is derived)',
  })
  @ValidateIf((o) => o.type === VariableType.DERIVED)
  @IsNotEmpty()
  formula?: Record<string, unknown> | null;

  @Field(() => String, {
    nullable: true,
    description: 'Human-readable description of this variable',
  })
  @IsString()
  @IsOptional()
  description?: string | null;
}

/**
 * Input for updating an existing state variable
 */
@InputType()
export class UpdateStateVariableInput {
  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'The value to store (only for non-derived variables)',
  })
  @IsOptional()
  value?: unknown | null;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'JSONLogic formula for derived variables',
  })
  @IsOptional()
  formula?: Record<string, unknown> | null;

  @Field(() => String, {
    nullable: true,
    description: 'Human-readable description of this variable',
  })
  @IsString()
  @IsOptional()
  description?: string | null;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Whether this variable is currently active',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @Field(() => Int, {
    nullable: true,
    description: 'Expected version for optimistic locking',
  })
  @IsInt()
  @IsOptional()
  expectedVersion?: number;
}

/**
 * Filter input for querying state variables
 */
@InputType()
export class StateVariableWhereInput {
  @Field(() => VariableScope, {
    nullable: true,
    description: 'Filter by scope level',
  })
  @IsEnum(VariableScope)
  @IsOptional()
  scope?: VariableScope;

  @Field(() => ID, {
    nullable: true,
    description: 'Filter by scope entity ID',
  })
  @IsString()
  @IsOptional()
  scopeId?: string | null;

  @Field(() => String, { nullable: true, description: 'Filter by variable key' })
  @IsString()
  @IsOptional()
  key?: string;

  @Field(() => VariableType, {
    nullable: true,
    description: 'Filter by variable type',
  })
  @IsEnum(VariableType)
  @IsOptional()
  type?: VariableType;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Filter by active status',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @Field(() => ID, {
    nullable: true,
    description: 'Filter by creator user ID',
  })
  @IsString()
  @IsOptional()
  createdBy?: string;

  @Field(() => Date, {
    nullable: true,
    description: 'Created after this date',
  })
  @IsOptional()
  createdAfter?: Date;

  @Field(() => Date, {
    nullable: true,
    description: 'Created before this date',
  })
  @IsOptional()
  createdBefore?: Date;

  @Field(() => Boolean, {
    nullable: true,
    defaultValue: false,
    description: 'Include deleted variables',
  })
  @IsBoolean()
  @IsOptional()
  includeDeleted?: boolean;
}

/**
 * Sort field options for state variables
 */
export enum StateVariableSortField {
  KEY = 'KEY',
  SCOPE = 'SCOPE',
  TYPE = 'TYPE',
  CREATED_AT = 'CREATED_AT',
  UPDATED_AT = 'UPDATED_AT',
}

registerEnumType(StateVariableSortField, {
  name: 'StateVariableSortField',
  description: 'Fields that can be used to sort state variables',
});

/**
 * Sort input for state variables
 */
@InputType()
export class StateVariableOrderByInput {
  @Field(() => StateVariableSortField, {
    nullable: true,
    defaultValue: StateVariableSortField.KEY,
    description: 'Field to sort by',
  })
  field?: StateVariableSortField;

  @Field(() => SortOrder, {
    nullable: true,
    defaultValue: SortOrder.ASC,
    description: 'Sort order',
  })
  order?: SortOrder;
}

/**
 * Input for evaluating a state variable with custom context
 */
@InputType()
export class EvaluateVariableInput {
  @Field(() => ID, {
    description: 'ID of the variable to evaluate',
  })
  @IsUUID()
  @IsNotEmpty()
  variableId!: string;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Additional context data for evaluation (merged with scope entity data)',
  })
  @IsOptional()
  context?: Record<string, unknown> | null;
}
