/**
 * Location Input Types
 * DTOs for Location mutations
 */

import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

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

@InputType()
export class UpdateLocationInput {
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

  // Note: geometry updates will be handled separately
}
