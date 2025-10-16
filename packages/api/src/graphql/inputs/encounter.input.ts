/**
 * Encounter Input Types
 * DTOs for Encounter mutations
 */

import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsInt, Min, IsBoolean } from 'class-validator';
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

  @Field(() => GraphQLJSON, { nullable: true, defaultValue: {} })
  @IsOptional()
  variables?: Record<string, unknown>;
}

@InputType()
export class UpdateEncounterInput {
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
  @IsBoolean()
  @IsOptional()
  isResolved?: boolean;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  variables?: Record<string, unknown>;
}
