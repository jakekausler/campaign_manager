/**
 * Branch Input Types
 * DTOs for Branch mutations
 */

import { InputType, Field, ID } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsDate } from 'class-validator';

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
