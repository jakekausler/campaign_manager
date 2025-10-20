/**
 * Version Input Types
 * DTOs for Version queries and mutations
 */

import { InputType, Field, ID } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsUUID, IsOptional, IsDate } from 'class-validator';

@InputType()
export class RestoreVersionInput {
  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  versionId!: string;

  @Field(() => ID, { description: 'Branch to restore the version in' })
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;

  @Field(() => String, {
    nullable: true,
    description: 'World-time for the restored version (defaults to now)',
  })
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  worldTime?: Date;

  @Field(() => String, { nullable: true, description: 'Optional comment for the restoration' })
  @IsString()
  @IsOptional()
  comment?: string;
}
