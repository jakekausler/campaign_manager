/**
 * World Time Input Types
 * DTOs for world time mutations
 */

import { InputType, Field, ID } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsUUID, IsDate, IsOptional, IsBoolean } from 'class-validator';

@InputType()
export class AdvanceWorldTimeInput {
  @Field(() => ID, { description: 'Campaign to advance time for' })
  @IsUUID()
  @IsNotEmpty()
  campaignId!: string;

  @Field({ description: 'New world time to advance to' })
  @IsDate()
  @IsNotEmpty()
  @Type(() => Date)
  to!: Date;

  @Field(() => ID, {
    nullable: true,
    description: 'Branch to advance time on (defaults to main branch)',
  })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @Field({
    nullable: true,
    defaultValue: true,
    description: 'Whether to invalidate campaign context cache',
  })
  @IsBoolean()
  @IsOptional()
  invalidateCache?: boolean;
}
