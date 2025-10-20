/**
 * World Input Types
 * DTOs for World mutations
 */

import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

@InputType()
export class CreateWorldInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field(() => GraphQLJSON, { description: 'Custom JSON schema for calendar systems' })
  @IsNotEmpty()
  calendars!: Record<string, unknown>;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  settings?: Record<string, unknown>;
}

@InputType()
export class UpdateWorldInput {
  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  calendars?: Record<string, unknown>;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  settings?: Record<string, unknown>;
}
