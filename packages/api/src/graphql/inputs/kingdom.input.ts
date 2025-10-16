/**
 * Kingdom Input Types
 * DTOs for Kingdom mutations
 */

import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsString, IsInt, IsOptional, IsNotEmpty, Min } from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

@InputType()
export class CreateKingdomInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  campaignId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  level?: number;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  variables?: Record<string, unknown>;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  variableSchemas?: unknown[];
}

@InputType()
export class UpdateKingdomInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @Min(1)
  @IsOptional()
  level?: number;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  variables?: Record<string, unknown>;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  variableSchemas?: unknown[];
}
