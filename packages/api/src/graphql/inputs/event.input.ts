/**
 * Event Input Types
 * DTOs for Event mutations
 */

import { InputType, Field } from '@nestjs/graphql';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsDateString,
  IsIn,
} from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

@InputType()
export class CreateEventInput {
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

  @Field()
  @IsString()
  @IsNotEmpty()
  @IsIn(['story', 'kingdom', 'party', 'world'])
  eventType!: string; // "story" | "kingdom" | "party" | "world"

  @Field({ nullable: true })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @Field(() => GraphQLJSON, { nullable: true, defaultValue: {} })
  @IsOptional()
  variables?: Record<string, unknown>;
}

@InputType()
export class UpdateEventInput {
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

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @IsIn(['story', 'kingdom', 'party', 'world'])
  eventType?: string;

  @Field({ nullable: true })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @Field({ nullable: true })
  @IsDateString()
  @IsOptional()
  occurredAt?: string;

  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  isCompleted?: boolean;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  variables?: Record<string, unknown>;
}
