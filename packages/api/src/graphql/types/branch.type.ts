/**
 * Branch GraphQL Type
 * Represents an alternate timeline branch for version management
 */

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class Branch {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => ID)
  campaignId!: string;

  @Field(() => ID, { nullable: true })
  parentId?: string;

  @Field(() => Date, {
    nullable: true,
    description: 'World time when this branch diverged from parent',
  })
  divergedAt?: Date;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date;

  // Optional field resolvers for relations
  @Field(() => Branch, { nullable: true, description: 'Parent branch in hierarchy' })
  parent?: Branch;

  @Field(() => [Branch], { description: 'Child branches' })
  children?: Branch[];
}

@ObjectType()
export class BranchNode {
  @Field(() => Branch, { description: 'The branch at this node' })
  branch!: Branch;

  @Field(() => [BranchNode], { description: 'Child nodes in hierarchy tree' })
  children!: BranchNode[];
}

@ObjectType()
export class ForkResult {
  @Field(() => Branch, { description: 'The newly created branch' })
  branch!: Branch;

  @Field(() => Int, { description: 'Number of entity versions copied to new branch' })
  versionsCopied!: number;
}
