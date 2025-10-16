/**
 * Character Input Types
 * DTOs for Character mutations
 */

import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsInt,
  Min,
  IsDate,
} from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

@InputType()
export class CreateCharacterInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  campaignId!: string;

  @Field(() => ID, { nullable: true })
  @IsUUID()
  @IsOptional()
  partyId?: string;

  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  level?: number;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  race?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  class?: string;

  @Field({ defaultValue: false })
  @IsBoolean()
  @IsOptional()
  isNPC?: boolean;

  @Field(() => GraphQLJSON, { nullable: true, defaultValue: {} })
  @IsOptional()
  variables?: Record<string, unknown>;
}

/**
 * Data fields that can be updated on a Character
 */
export interface UpdateCharacterData {
  name?: string;
  partyId?: string;
  level?: number;
  race?: string;
  class?: string;
  isNPC?: boolean;
  variables?: Record<string, unknown>;
}

@InputType()
export class UpdateCharacterInput implements UpdateCharacterData {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field(() => ID, { nullable: true })
  @IsUUID()
  @IsOptional()
  partyId?: string;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @Min(1)
  @IsOptional()
  level?: number;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  race?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  class?: string;

  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  isNPC?: boolean;

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
