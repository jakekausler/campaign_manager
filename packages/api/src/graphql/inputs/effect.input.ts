/**
 * Effect Input Types
 * DTOs for Effect mutations and queries
 */

import { InputType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import {
  IsString,
  IsInt,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
  Min,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

import { EffectTiming } from '../types/effect.type';

import { SortOrder } from './filter.input';

/**
 * Input for creating a new effect
 */
@InputType()
export class CreateEffectInput {
  @Field({ description: 'Display name for this effect' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field({ nullable: true, description: 'Human-readable explanation of what this effect does' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string | null;

  @Field({
    description: 'Type of effect (e.g., "modify_variable", "trigger_event", "create_entity")',
  })
  @IsString()
  @IsNotEmpty()
  effectType!: string;

  @Field(() => GraphQLJSON, {
    description:
      'Effect-specific configuration data (e.g., JSON Patch operations). Max 100KB. Will be validated by EffectPatchService.',
  })
  @IsNotEmpty()
  payload!: Record<string, unknown>;

  @Field({ description: 'Type of entity this effect belongs to (e.g., "encounter", "event")' })
  @IsString()
  @IsNotEmpty()
  entityType!: string;

  @Field(() => ID, { description: 'ID of the entity this effect belongs to' })
  @IsString()
  @IsNotEmpty()
  entityId!: string;

  @Field(() => EffectTiming, {
    nullable: true,
    defaultValue: EffectTiming.ON_RESOLVE,
    description: 'When to execute this effect during resolution',
  })
  @IsEnum(EffectTiming)
  @IsOptional()
  timing?: EffectTiming;

  @Field(() => Int, {
    nullable: true,
    defaultValue: 0,
    description: 'Execution order within timing phase (lower values execute first)',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;
}

/**
 * Input for updating an existing effect
 */
@InputType()
export class UpdateEffectInput {
  @Field({ nullable: true, description: 'Display name for this effect' })
  @IsString()
  @IsOptional()
  name?: string;

  @Field({ nullable: true, description: 'Human-readable explanation of what this effect does' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string | null;

  @Field({ nullable: true, description: 'Type of effect' })
  @IsString()
  @IsOptional()
  effectType?: string;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description:
      'Effect-specific configuration data. Max 100KB. Will be validated by EffectPatchService.',
  })
  @IsOptional()
  payload?: Record<string, unknown>;

  @Field(() => EffectTiming, {
    nullable: true,
    description: 'When to execute this effect during resolution',
  })
  @IsEnum(EffectTiming)
  @IsOptional()
  timing?: EffectTiming;

  @Field(() => Int, { nullable: true, description: 'Execution order within timing phase' })
  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @Field(() => Boolean, { nullable: true, description: 'Whether this effect is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @Field(() => Int, { description: 'Expected version for optimistic locking' })
  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;
}

/**
 * Input for executing an effect with custom context
 */
@InputType()
export class ExecuteEffectInput {
  @Field(() => ID, { description: 'ID of the effect to execute' })
  @IsString()
  @IsNotEmpty()
  effectId!: string;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description:
      'Custom context for execution (entity data). If omitted, context is loaded from database using effect.entityType and effect.entityId.',
  })
  @IsOptional()
  context?: Record<string, unknown>;

  @Field(() => Boolean, {
    nullable: true,
    defaultValue: false,
    description: 'If true, preview the effect without applying changes',
  })
  @IsBoolean()
  @IsOptional()
  dryRun?: boolean;
}

/**
 * Input for executing all effects for an entity
 */
@InputType()
export class ExecuteEffectsForEntityInput {
  @Field({ description: 'Type of entity (e.g., "encounter", "event")' })
  @IsString()
  @IsNotEmpty()
  entityType!: string;

  @Field(() => ID, { description: 'ID of the entity' })
  @IsString()
  @IsNotEmpty()
  entityId!: string;

  @Field(() => EffectTiming, { description: 'Timing phase to execute (pre, onResolve, or post)' })
  @IsEnum(EffectTiming)
  @IsNotEmpty()
  timing!: EffectTiming;

  @Field(() => Boolean, {
    nullable: true,
    defaultValue: false,
    description: 'If true, preview effects without applying changes',
  })
  @IsBoolean()
  @IsOptional()
  dryRun?: boolean;
}

/**
 * Filter input for querying effects
 */
@InputType()
export class EffectWhereInput {
  @Field({ nullable: true, description: 'Filter by effect name (partial match)' })
  @IsString()
  @IsOptional()
  name?: string;

  @Field({ nullable: true, description: 'Filter by effect type' })
  @IsString()
  @IsOptional()
  effectType?: string;

  @Field({ nullable: true, description: 'Filter by entity type' })
  @IsString()
  @IsOptional()
  entityType?: string;

  @Field(() => ID, { nullable: true, description: 'Filter by specific entity instance' })
  @IsString()
  @IsOptional()
  entityId?: string;

  @Field(() => EffectTiming, { nullable: true, description: 'Filter by timing phase' })
  @IsEnum(EffectTiming)
  @IsOptional()
  timing?: EffectTiming;

  @Field(() => Boolean, { nullable: true, description: 'Filter by active status' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @Field(() => Date, { nullable: true, description: 'Created after this date' })
  @IsOptional()
  createdAfter?: Date;

  @Field(() => Date, { nullable: true, description: 'Created before this date' })
  @IsOptional()
  createdBefore?: Date;

  @Field(() => Boolean, {
    nullable: true,
    defaultValue: false,
    description: 'Include deleted effects',
  })
  @IsBoolean()
  @IsOptional()
  includeDeleted?: boolean;
}

/**
 * Sort field options for effects
 */
export enum EffectSortField {
  NAME = 'NAME',
  EFFECT_TYPE = 'EFFECT_TYPE',
  ENTITY_TYPE = 'ENTITY_TYPE',
  TIMING = 'TIMING',
  PRIORITY = 'PRIORITY',
  CREATED_AT = 'CREATED_AT',
  UPDATED_AT = 'UPDATED_AT',
}

registerEnumType(EffectSortField, {
  name: 'EffectSortField',
  description: 'Fields that can be used to sort effects',
});

/**
 * Sort input for effects
 */
@InputType()
export class EffectOrderByInput {
  @Field(() => EffectSortField, {
    nullable: true,
    defaultValue: EffectSortField.PRIORITY,
    description: 'Field to sort by',
  })
  field?: EffectSortField;

  @Field(() => SortOrder, {
    nullable: true,
    defaultValue: SortOrder.ASC,
    description: 'Sort order',
  })
  order?: SortOrder;
}

/**
 * Filter input for querying effect execution history
 */
@InputType()
export class EffectExecutionWhereInput {
  @Field(() => ID, { nullable: true, description: 'Filter by effect ID' })
  @IsString()
  @IsOptional()
  effectId?: string;

  @Field({ nullable: true, description: 'Filter by entity type' })
  @IsString()
  @IsOptional()
  entityType?: string;

  @Field(() => ID, { nullable: true, description: 'Filter by entity ID' })
  @IsString()
  @IsOptional()
  entityId?: string;

  @Field(() => ID, { nullable: true, description: 'Filter by user who executed' })
  @IsString()
  @IsOptional()
  executedBy?: string;

  @Field(() => Date, { nullable: true, description: 'Executed after this date' })
  @IsOptional()
  executedAfter?: Date;

  @Field(() => Date, { nullable: true, description: 'Executed before this date' })
  @IsOptional()
  executedBefore?: Date;

  @Field(() => Boolean, { nullable: true, description: 'Filter by success status' })
  @IsBoolean()
  @IsOptional()
  wasSuccessful?: boolean;
}

/**
 * Sort field options for effect executions
 */
export enum EffectExecutionSortField {
  EXECUTED_AT = 'EXECUTED_AT',
  EFFECT_ID = 'EFFECT_ID',
  ENTITY_TYPE = 'ENTITY_TYPE',
}

registerEnumType(EffectExecutionSortField, {
  name: 'EffectExecutionSortField',
  description: 'Fields that can be used to sort effect executions',
});

/**
 * Sort input for effect executions
 */
@InputType()
export class EffectExecutionOrderByInput {
  @Field(() => EffectExecutionSortField, {
    nullable: true,
    defaultValue: EffectExecutionSortField.EXECUTED_AT,
    description: 'Field to sort by',
  })
  field?: EffectExecutionSortField;

  @Field(() => SortOrder, {
    nullable: true,
    defaultValue: SortOrder.DESC,
    description: 'Sort order',
  })
  order?: SortOrder;
}
