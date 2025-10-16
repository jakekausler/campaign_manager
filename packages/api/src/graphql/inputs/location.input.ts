/**
 * Location Input Types
 * DTOs for Location mutations
 */

import { InputType, Field, ID } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsInt, IsDate } from 'class-validator';

@InputType()
export class CreateLocationInput {
  @Field()
  @IsUUID()
  @IsNotEmpty()
  worldId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  type!: string; // "point" | "region"

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field({ nullable: true })
  @IsUUID()
  @IsOptional()
  parentLocationId?: string;

  // Note: geometry field will be handled separately via PostGIS functions
  // Not included in input for MVP - will be added in spatial features ticket
}

/**
 * Data fields that can be updated on a Location
 */
export interface UpdateLocationData {
  type?: string;
  name?: string;
  description?: string;
  parentLocationId?: string | null;
}

@InputType()
export class UpdateLocationInput implements UpdateLocationData {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  type?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field({ nullable: true })
  @IsUUID()
  @IsOptional()
  parentLocationId?: string | null;

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

  // Note: geometry updates will be handled separately
}
