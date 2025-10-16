/**
 * Campaign Input Types
 * DTOs for Campaign mutations
 */

import { InputType, Field, ID } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsInt,
  IsDate,
} from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

@InputType()
export class CreateCampaignInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  worldId!: string;

  @Field(() => GraphQLJSON, { nullable: true, defaultValue: {} })
  @IsOptional()
  settings?: Record<string, unknown>;

  @Field({ nullable: true, defaultValue: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/**
 * Data fields that can be updated on a Campaign
 */
export interface UpdateCampaignData {
  name?: string;
  settings?: Record<string, unknown>;
  isActive?: boolean;
}

@InputType()
export class UpdateCampaignInput implements UpdateCampaignData {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  settings?: Record<string, unknown>;

  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

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
