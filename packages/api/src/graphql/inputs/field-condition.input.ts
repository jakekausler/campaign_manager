/**
 * Field Condition Input Types
 * DTOs for FieldCondition mutations and queries
 */

import { InputType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { IsString, IsInt, IsOptional, IsNotEmpty, IsBoolean, Min, IsUUID } from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

import { SortOrder } from './filter.input';

/**
 * Input for creating a new field condition
 */
@InputType()
export class CreateFieldConditionInput {
  @Field(() => String, {
    description: 'Type of entity this condition applies to (e.g., "Settlement", "Structure")',
  })
  @IsString()
  @IsNotEmpty()
  entityType!: string;

  @Field(() => ID, {
    nullable: true,
    description: 'Specific entity instance (null for type-level conditions)',
  })
  @IsString()
  @IsOptional()
  entityId?: string | null;

  @Field(() => String, {
    description: 'The field name this condition computes (e.g., "is_trade_hub", "is_operational")',
  })
  @IsString()
  @IsNotEmpty()
  field!: string;

  @Field(() => GraphQLJSON, { description: 'JSONLogic expression for evaluation' })
  @IsNotEmpty()
  expression!: Record<string, unknown>;

  @Field(() => String, {
    nullable: true,
    description: 'Human-readable explanation of what this condition does',
  })
  @IsString()
  @IsOptional()
  description?: string | null;

  @Field(() => Int, {
    defaultValue: 0,
    description: 'Execution order when multiple conditions apply to same field',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;
}

/**
 * Input for updating an existing field condition
 */
@InputType()
export class UpdateFieldConditionInput {
  @Field(() => GraphQLJSON, { nullable: true, description: 'JSONLogic expression for evaluation' })
  @IsOptional()
  expression?: Record<string, unknown>;

  @Field(() => String, {
    nullable: true,
    description: 'Human-readable explanation of what this condition does',
  })
  @IsString()
  @IsOptional()
  description?: string | null;

  @Field(() => Boolean, { nullable: true, description: 'Whether this condition is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @Field(() => Int, {
    nullable: true,
    description: 'Execution order when multiple conditions apply to same field',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @Field(() => Int, { description: 'Expected version for optimistic locking' })
  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;
}

/**
 * Filter input for querying field conditions
 */
@InputType()
export class FieldConditionWhereInput {
  @Field(() => String, { nullable: true, description: 'Filter by entity type' })
  @IsString()
  @IsOptional()
  entityType?: string;

  @Field(() => ID, { nullable: true, description: 'Filter by specific entity instance' })
  @IsString()
  @IsOptional()
  entityId?: string | null;

  @Field(() => String, { nullable: true, description: 'Filter by field name' })
  @IsString()
  @IsOptional()
  field?: string;

  @Field(() => Boolean, { nullable: true, description: 'Filter by active status' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @Field(() => ID, { nullable: true, description: 'Filter by creator user ID' })
  @IsString()
  @IsOptional()
  createdBy?: string;

  @Field(() => Date, { nullable: true, description: 'Created after this date' })
  @IsOptional()
  createdAfter?: Date;

  @Field(() => Date, { nullable: true, description: 'Created before this date' })
  @IsOptional()
  createdBefore?: Date;

  @Field(() => Boolean, {
    nullable: true,
    defaultValue: false,
    description: 'Include deleted conditions',
  })
  @IsBoolean()
  @IsOptional()
  includeDeleted?: boolean;
}

/**
 * Sort field options for field conditions
 */
export enum FieldConditionSortField {
  ENTITY_TYPE = 'ENTITY_TYPE',
  FIELD = 'FIELD',
  PRIORITY = 'PRIORITY',
  CREATED_AT = 'CREATED_AT',
  UPDATED_AT = 'UPDATED_AT',
}

registerEnumType(FieldConditionSortField, {
  name: 'FieldConditionSortField',
  description: 'Fields that can be used to sort field conditions',
});

/**
 * Sort input for field conditions
 */
@InputType()
export class FieldConditionOrderByInput {
  @Field(() => FieldConditionSortField, {
    nullable: true,
    defaultValue: FieldConditionSortField.PRIORITY,
    description: 'Field to sort by',
  })
  field?: FieldConditionSortField;

  @Field(() => SortOrder, {
    nullable: true,
    defaultValue: SortOrder.DESC,
    description: 'Sort order',
  })
  order?: SortOrder;
}

/**
 * Input for evaluating a condition with custom context
 */
@InputType()
export class EvaluateConditionInput {
  @Field(() => ID, { description: 'ID of the condition to evaluate' })
  @IsUUID()
  @IsNotEmpty()
  conditionId!: string;

  @Field(() => GraphQLJSON, { description: 'Context data for evaluation (entity data)' })
  @IsNotEmpty()
  context!: Record<string, unknown>;
}
