/**
 * Variable Input Types
 * DTOs for variable-related mutations
 */

import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray } from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

import { VariableTypeEnum } from '../types/variable-schema.types';

@InputType({ description: 'Input for defining a variable schema' })
export class DefineVariableSchemaInput {
  @Field(() => String, { description: 'Name of the variable' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field(() => VariableTypeEnum, { description: 'Data type of the variable' })
  @IsEnum(VariableTypeEnum)
  type!: VariableTypeEnum;

  @Field(() => [String], { nullable: true, description: 'Possible values for enum type' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  enumValues?: string[];

  @Field(() => GraphQLJSON, { nullable: true, description: 'Default value for the variable' })
  @IsOptional()
  defaultValue?: unknown;

  @Field(() => String, { nullable: true, description: 'Description of the variable' })
  @IsString()
  @IsOptional()
  description?: string;
}

@InputType({ description: 'Input for setting a variable value' })
export class SetVariableInput {
  @Field(() => String, { description: 'Name of the variable' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field(() => GraphQLJSON, { description: 'Value of the variable' })
  @IsNotEmpty()
  value!: unknown;
}

@InputType({ description: 'Input for adding a party member' })
export class AddPartyMemberInput {
  @Field(() => ID, { description: 'ID of the party' })
  @IsString()
  @IsNotEmpty()
  partyId!: string;

  @Field(() => ID, { description: 'ID of the character to add' })
  @IsString()
  @IsNotEmpty()
  characterId!: string;
}

@InputType({ description: 'Input for removing a party member' })
export class RemovePartyMemberInput {
  @Field(() => ID, { description: 'ID of the party' })
  @IsString()
  @IsNotEmpty()
  partyId!: string;

  @Field(() => ID, { description: 'ID of the character to remove' })
  @IsString()
  @IsNotEmpty()
  characterId!: string;
}
