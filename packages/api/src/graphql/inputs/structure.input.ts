/**
 * Structure Input Types
 * DTOs for Structure mutations
 */

import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsString, IsInt, IsOptional, IsNotEmpty, Min } from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

@InputType()
export class CreateStructureInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  settlementId!: string;

  @Field({ description: 'Structure type (e.g., temple, barracks, market, library)' })
  @IsString()
  @IsNotEmpty()
  type!: string;

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
export class UpdateStructureInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  type?: string;

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
