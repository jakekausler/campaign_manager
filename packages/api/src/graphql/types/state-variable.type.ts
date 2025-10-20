/**
 * State Variable GraphQL Types
 * Represents dynamic campaign state variables with support for derived values computed from formulas
 */

import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

/**
 * VariableScope - The scope level at which a state variable exists
 */
export enum VariableScope {
  WORLD = 'world',
  CAMPAIGN = 'campaign',
  PARTY = 'party',
  KINGDOM = 'kingdom',
  SETTLEMENT = 'settlement',
  STRUCTURE = 'structure',
  CHARACTER = 'character',
  LOCATION = 'location',
  EVENT = 'event',
  ENCOUNTER = 'encounter',
}

registerEnumType(VariableScope, {
  name: 'VariableScope',
  description:
    'The scope level at which a state variable exists (world, campaign, party, kingdom, settlement, structure, character, location, event, encounter)',
});

/**
 * VariableType - The data type of a state variable
 */
export enum VariableType {
  STRING = 'string',
  INTEGER = 'integer',
  FLOAT = 'float',
  BOOLEAN = 'boolean',
  JSON = 'json',
  DERIVED = 'derived',
}

registerEnumType(VariableType, {
  name: 'VariableType',
  description: 'The data type of a state variable (string, integer, float, boolean, json, derived)',
});

/**
 * StateVariable - A dynamic campaign state variable
 */
@ObjectType()
export class StateVariable {
  @Field(() => ID)
  id!: string;

  @Field(() => VariableScope, {
    description: 'The scope level of this variable',
  })
  scope!: VariableScope;

  @Field(() => ID, {
    nullable: true,
    description: 'ID of the scope entity (null for world-level variables)',
  })
  scopeId?: string | null;

  @Field(() => String, { description: 'Variable name/key within the scope' })
  key!: string;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'The stored value (null for derived variables)',
  })
  value?: unknown | null;

  @Field(() => VariableType, {
    description: 'The data type of this variable',
  })
  type!: VariableType;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'JSONLogic formula for derived variables (null for non-derived)',
  })
  formula?: Record<string, unknown> | null;

  @Field(() => String, {
    nullable: true,
    description: 'Human-readable description of this variable',
  })
  description?: string | null;

  @Field(() => Boolean, {
    description: 'Whether this variable is currently active',
  })
  isActive!: boolean;

  @Field(() => Int, {
    description: 'Version number for optimistic locking',
  })
  version!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null;

  @Field(() => ID, { description: 'User who created this variable' })
  createdBy!: string;

  @Field(() => ID, { nullable: true, description: 'User who last updated this variable' })
  updatedBy?: string | null;
}

/**
 * VariableEvaluationResult - Result of evaluating a state variable (especially derived variables)
 */
@ObjectType()
export class VariableEvaluationResult {
  @Field(() => ID, { description: 'ID of the evaluated variable' })
  variableId!: string;

  @Field(() => String, { description: 'Variable key' })
  key!: string;

  @Field(() => VariableScope, { description: 'Variable scope' })
  scope!: VariableScope;

  @Field(() => ID, { nullable: true, description: 'Scope entity ID' })
  scopeId?: string | null;

  @Field(() => GraphQLJSON, { description: 'The computed/stored value' })
  value!: unknown;

  @Field({ description: 'Whether evaluation succeeded' })
  success!: boolean;

  @Field(() => String, { nullable: true, description: 'Error message if evaluation failed' })
  error?: string | null;

  @Field(() => [EvaluationStep], {
    nullable: true,
    description: 'Detailed evaluation trace for debugging',
  })
  trace?: EvaluationStep[] | null;
}

/**
 * EvaluationStep - A single step in the variable evaluation trace
 */
@ObjectType()
export class EvaluationStep {
  @Field(() => String, { description: 'Step description' })
  step!: string;

  @Field(() => String, { nullable: true, description: 'Step details' })
  description?: string | null;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Input to this step' })
  input?: unknown | null;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Output from this step' })
  output?: unknown | null;

  @Field({ description: 'Whether this step passed' })
  passed!: boolean;
}
