/**
 * Party Input Types
 * DTOs for Party mutations
 */

import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsString, IsInt, IsOptional, IsNotEmpty, Min, IsUUID, IsDate } from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

@InputType()
export class CreatePartyInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  campaignId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @Min(1)
  @IsOptional()
  averageLevel?: number;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @Min(1)
  @IsOptional()
  manualLevelOverride?: number;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  variables?: Record<string, unknown>;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  variableSchemas?: unknown[];
}

/**
 * Data fields that can be updated on a Party
 */
export interface UpdatePartyData {
  name?: string;
  averageLevel?: number;
  manualLevelOverride?: number;
  variables?: Record<string, unknown>;
  variableSchemas?: unknown[];
}

@InputType()
export class UpdatePartyInput implements UpdatePartyData {
  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @Min(1)
  @IsOptional()
  averageLevel?: number;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @Min(1)
  @IsOptional()
  manualLevelOverride?: number;

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
