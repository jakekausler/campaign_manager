/**
 * Settlement Input Types
 * DTOs for Settlement mutations
 */

import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsString, IsInt, IsOptional, IsNotEmpty, Min, IsUUID, IsDate } from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

@InputType()
export class CreateSettlementInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  kingdomId!: string;

  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  locationId!: string;

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
 * Data fields that can be updated on a Settlement
 */
export interface UpdateSettlementData {
  name?: string;
  level?: number;
  variables?: Record<string, unknown>;
  variableSchemas?: unknown[];
}

@InputType()
export class UpdateSettlementInput implements UpdateSettlementData {
  @Field(() => String, { nullable: true })
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
