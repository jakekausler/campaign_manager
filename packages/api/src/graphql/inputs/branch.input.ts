/**
 * Branch Input Types
 * DTOs for Branch mutations
 */

import { InputType, Field, ID } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDate,
  IsBoolean,
  IsArray,
  Matches,
  ValidateNested,
} from 'class-validator';

@InputType()
export class CreateBranchInput {
  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  campaignId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field(() => ID, { nullable: true })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @Field({ nullable: true })
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  divergedAt?: Date;

  // Metadata fields
  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex color code (e.g., #FF5733)',
  })
  color?: string;

  @Field(() => [String], { nullable: true })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}

@InputType()
export class UpdateBranchInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  // Metadata fields
  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex color code (e.g., #FF5733)',
  })
  color?: string;

  @Field(() => [String], { nullable: true })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}

@InputType()
export class BranchWhereInput {
  @Field(() => ID, { nullable: true })
  @IsUUID()
  @IsOptional()
  id?: string;

  @Field(() => ID, { nullable: true })
  @IsUUID()
  @IsOptional()
  campaignId?: string;

  @Field(() => ID, { nullable: true })
  @IsUUID()
  @IsOptional()
  parentId?: string;
}

@InputType()
export class ForkBranchInput {
  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  sourceBranchId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field()
  @IsDate()
  @IsNotEmpty()
  @Type(() => Date)
  worldTime!: Date;
}

@InputType()
export class PreviewMergeInput {
  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  sourceBranchId!: string;

  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  targetBranchId!: string;

  @Field()
  @IsDate()
  @IsNotEmpty()
  @Type(() => Date)
  worldTime!: Date;
}

@InputType()
export class ConflictResolution {
  @Field({ description: 'Entity ID' })
  @IsString()
  @IsNotEmpty()
  entityId!: string;

  @Field({ description: 'Entity type' })
  @IsString()
  @IsNotEmpty()
  entityType!: string;

  @Field({ description: 'JSON path to the conflict' })
  @IsString()
  @IsNotEmpty()
  path!: string;

  @Field({ description: 'Resolved value as JSON string' })
  @IsString()
  @IsNotEmpty()
  resolvedValue!: string;
}

@InputType()
export class ExecuteMergeInput {
  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  sourceBranchId!: string;

  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  targetBranchId!: string;

  @Field()
  @IsDate()
  @IsNotEmpty()
  @Type(() => Date)
  worldTime!: Date;

  @Field(() => [ConflictResolution], {
    description: 'Manual resolutions for conflicts',
    nullable: true,
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ConflictResolution)
  resolutions?: ConflictResolution[];
}
