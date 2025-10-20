/**
 * Effect GraphQL Types
 * Represents effects that mutate world state or other entities when they resolve
 */

import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

/**
 * EffectTiming - When the effect should execute during encounter/event resolution
 */
export enum EffectTiming {
  PRE = 'PRE',
  ON_RESOLVE = 'ON_RESOLVE',
  POST = 'POST',
}

registerEnumType(EffectTiming, {
  name: 'EffectTiming',
  description: 'Timing phase for effect execution (pre/during/post resolution)',
  valuesMap: {
    PRE: {
      description: 'Execute before encounter/event resolution',
    },
    ON_RESOLVE: {
      description: 'Execute during encounter/event resolution (default)',
    },
    POST: {
      description: 'Execute after encounter/event resolution',
    },
  },
});

/**
 * EffectEntityType - Type of entity that can trigger effects
 */
export enum EffectEntityType {
  ENCOUNTER = 'ENCOUNTER',
  EVENT = 'EVENT',
}

registerEnumType(EffectEntityType, {
  name: 'EffectEntityType',
  description: 'Type of entity that can have effects',
  valuesMap: {
    ENCOUNTER: {
      description: 'Effect belongs to an encounter',
    },
    EVENT: {
      description: 'Effect belongs to an event',
    },
  },
});

/**
 * Effect - Represents an action that modifies world state when triggered
 */
@ObjectType()
export class Effect {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { description: 'Display name for this effect' })
  name!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Human-readable explanation of what this effect does',
  })
  description?: string | null;

  @Field(() => String, {
    description: 'Type of effect (e.g., "modify_variable", "trigger_event", "create_entity")',
  })
  effectType!: string;

  @Field(() => GraphQLJSON, {
    description:
      'Effect-specific configuration data. For patch effects: array of JSON Patch operations (RFC 6902). For other effects: custom payload matching effectType schema.',
  })
  payload!: Record<string, unknown>;

  @Field(() => String, {
    description: 'Type of entity this effect belongs to (e.g., "encounter", "event")',
  })
  entityType!: string;

  @Field(() => ID, { description: 'ID of the entity this effect belongs to' })
  entityId!: string;

  @Field(() => EffectTiming, {
    description: 'When to execute this effect during resolution',
    defaultValue: EffectTiming.ON_RESOLVE,
  })
  timing!: EffectTiming;

  @Field(() => Int, {
    description: 'Execution order within timing phase (lower values execute first)',
    defaultValue: 0,
  })
  priority!: number;

  @Field({ description: 'Whether this effect is active and should execute' })
  isActive!: boolean;

  @Field(() => Int, { description: 'Version for optimistic locking' })
  version!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null;

  // Field resolvers will populate these
  @Field(() => [EffectExecution], {
    nullable: true,
    description: 'Execution history for this effect',
  })
  executions?: EffectExecution[];
}

/**
 * EffectExecution - Audit record of a single effect execution
 */
@ObjectType()
export class EffectExecution {
  @Field(() => ID)
  id!: string;

  @Field(() => ID, { description: 'ID of the effect that was executed' })
  effectId!: string;

  @Field(() => String, {
    description: 'Type of entity that triggered this execution (e.g., "encounter", "event")',
  })
  entityType!: string;

  @Field(() => ID, { description: 'ID of the entity that triggered this execution' })
  entityId!: string;

  @Field(() => Date, { description: 'When this effect was executed' })
  executedAt!: Date;

  @Field(() => ID, { description: 'User who triggered this execution' })
  executedBy!: string;

  @Field(() => GraphQLJSON, {
    description: 'Entity state snapshot before execution (for audit trail)',
  })
  context!: Record<string, unknown>;

  @Field(() => GraphQLJSON, {
    description: 'Execution result (patch applied, success status, affected fields)',
  })
  result!: Record<string, unknown>;

  @Field(() => String, { nullable: true, description: 'Error message if execution failed' })
  error?: string | null;

  // Field resolver will populate this
  @Field(() => Effect, { nullable: true, description: 'The effect that was executed' })
  effect?: Effect;
}

/**
 * EffectExecutionResult - Result of executing an effect with execution details
 */
@ObjectType()
export class EffectExecutionResult {
  @Field({ description: 'Whether the effect executed successfully' })
  success!: boolean;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'The patch that was applied (if successful)',
  })
  patchApplied?: unknown | null;

  @Field(() => String, { nullable: true, description: 'Error message if execution failed' })
  error?: string | null;

  @Field(() => ID, {
    nullable: true,
    description: 'ID of the EffectExecution audit record created',
  })
  executionId?: string | null;

  @Field(() => [String], {
    nullable: true,
    description: 'List of entity fields that were modified',
  })
  affectedFields?: string[];
}

/**
 * EffectExecutionSummary - Summary result of executing multiple effects
 */
@ObjectType()
export class EffectExecutionSummary {
  @Field(() => Int, { description: 'Total number of effects executed' })
  total!: number;

  @Field(() => Int, { description: 'Number of effects that succeeded' })
  succeeded!: number;

  @Field(() => Int, { description: 'Number of effects that failed' })
  failed!: number;

  @Field(() => [EffectExecutionResult], { description: 'Individual execution results' })
  results!: EffectExecutionResult[];

  @Field(() => [String], { nullable: true, description: 'Dependency execution order (effect IDs)' })
  executionOrder?: string[];
}
