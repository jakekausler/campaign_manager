/**
 * Structure Input Types
 * DTOs for Structure mutations
 */

import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsString, IsInt, IsOptional, IsNotEmpty, Min, IsUUID, IsDate } from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

@InputType()
export class CreateStructureInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  settlementId!: string;

  @Field(() => String, { description: 'Structure type (e.g., temple, barracks, market, library)' })
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

/**
 * Data fields that can be updated on a Structure
 */
export interface UpdateStructureData {
  name?: string;
  type?: string;
  level?: number;
  variables?: Record<string, unknown>;
  variableSchemas?: unknown[];
}

@InputType()
export class UpdateStructureInput implements UpdateStructureData {
  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field(() => String, { nullable: true })
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

  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;

  @Field(() => Number)
  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;

  @Field(() => Date, { nullable: true })
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  worldTime?: Date;
}
