/**
 * Event Input Types
 * DTOs for Event mutations
 */

import { InputType, Field, ID } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsDate,
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

/**
 * Data fields that can be updated on an Event
 */
export interface UpdateEventData {
  locationId?: string;
  name?: string;
  description?: string;
  eventType?: string;
  scheduledAt?: string;
  occurredAt?: string;
  isCompleted?: boolean;
  variables?: Record<string, unknown>;
}

@InputType()
export class UpdateEventInput implements UpdateEventData {
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
