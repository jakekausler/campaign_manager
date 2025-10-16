/**
 * Link Input Types
 * DTOs for Link mutations
 */

import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsIn } from 'class-validator';

@InputType()
export class CreateLinkInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @IsIn(['encounter', 'event'])
  sourceType!: string; // "encounter" | "event"

  @Field()
  @IsUUID()
  @IsNotEmpty()
  sourceId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @IsIn(['encounter', 'event'])
  targetType!: string; // "encounter" | "event"

  @Field()
  @IsUUID()
  @IsNotEmpty()
  targetId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @IsIn(['prerequisite', 'blocks', 'triggers', 'related'])
  linkType!: string; // "prerequisite" | "blocks" | "triggers" | "related"

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;
}

@InputType()
export class UpdateLinkInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @IsIn(['prerequisite', 'blocks', 'triggers', 'related'])
  linkType?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;
}
