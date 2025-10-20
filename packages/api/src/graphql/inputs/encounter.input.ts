/**
 * Encounter Input Types
 * DTOs for Encounter mutations
 */

import { InputType, Field, Int, ID } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  IsBoolean,
  IsDate,
} from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

@InputType()
export class CreateEncounterInput {
  @Field()
  @IsUUID()
  @IsNotEmpty()
  campaignId!: string;

  @Field({ nullable: true })
  @IsUUID()
  @IsOptional()
  locationId?: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @Min(0)
  @IsOptional()
  difficulty?: number;

  @Field({ nullable: true })
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  scheduledAt?: Date;

  @Field(() => GraphQLJSON, { nullable: true, defaultValue: {} })
  @IsOptional()
  variables?: Record<string, unknown>;
}

/**
 * Data fields that can be updated on an Encounter
 */
export interface UpdateEncounterData {
  locationId?: string;
  name?: string;
  description?: string;
  difficulty?: number;
  scheduledAt?: Date;
  isResolved?: boolean;
  variables?: Record<string, unknown>;
}

@InputType()
export class UpdateEncounterInput implements UpdateEncounterData {
  @Field({ nullable: true })
  @IsUUID()
  @IsOptional()
  locationId?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @Min(0)
  @IsOptional()
  difficulty?: number;

  @Field({ nullable: true })
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  scheduledAt?: Date;

  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  isResolved?: boolean;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  variables?: Record<string, unknown>;

  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;

  @Field(() => Number)
  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;

  @Field({ nullable: true })
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  worldTime?: Date;
}
