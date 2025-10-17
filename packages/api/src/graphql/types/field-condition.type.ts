/**
 * Field Condition GraphQL Types
 * Represents conditions that bind JSONLogic expressions to entity fields for dynamic computed values
 */

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

/**
 * FieldCondition - Binds a JSONLogic expression to an entity field
 */
@ObjectType()
export class FieldCondition {
  @Field(() => ID)
  id!: string;

  @Field({
    description: 'Type of entity this condition applies to (e.g., "Settlement", "Structure")',
  })
  entityType!: string;

  @Field(() => ID, {
    nullable: true,
    description: 'Specific entity instance (null for type-level conditions)',
  })
  entityId?: string | null;

  @Field({
    description: 'The field name this condition computes (e.g., "is_trade_hub", "is_operational")',
  })
  field!: string;

  @Field(() => GraphQLJSON, { description: 'JSONLogic expression for evaluation' })
  expression!: Record<string, unknown>;

  @Field({ nullable: true, description: 'Human-readable explanation of what this condition does' })
  description?: string | null;

  @Field({ description: 'Whether this condition is active' })
  isActive!: boolean;

  @Field(() => Int, { description: 'Execution order when multiple conditions apply to same field' })
  priority!: number;

  @Field(() => Int, { description: 'Version for optimistic locking' })
  version!: number;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  deletedAt?: Date | null;

  @Field(() => ID, { description: 'User who created this condition' })
  createdBy!: string;

  @Field(() => ID, { nullable: true, description: 'User who last updated this condition' })
  updatedBy?: string | null;
}

/**
 * EvaluationTrace - Represents a single step in the evaluation process
 */
@ObjectType()
export class EvaluationTrace {
  @Field({ description: 'Description of this evaluation step' })
  step!: string;

  @Field(() => GraphQLJSON, { description: 'Input to this step' })
  input!: unknown;

  @Field(() => GraphQLJSON, { description: 'Output from this step' })
  output!: unknown;

  @Field({ description: 'Whether this step passed' })
  passed!: boolean;
}

/**
 * EvaluationResult - Result of evaluating a condition with trace information
 */
@ObjectType()
export class EvaluationResult {
  @Field(() => GraphQLJSON, { description: 'The computed value from evaluating the condition' })
  value!: unknown;

  @Field({ description: 'Whether the evaluation succeeded' })
  success!: boolean;

  @Field(() => [EvaluationTrace], { description: 'Trace of evaluation steps for debugging' })
  trace!: EvaluationTrace[];

  @Field({ nullable: true, description: 'Error message if evaluation failed' })
  error?: string | null;
}
