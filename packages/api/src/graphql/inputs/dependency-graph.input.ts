/**
 * Dependency Graph GraphQL Input Types
 * Input types for querying and manipulating the dependency graph
 */

import { InputType, Field, ID } from '@nestjs/graphql';

/**
 * GetDependencyGraphInput - Input for querying a dependency graph
 */
@InputType()
export class GetDependencyGraphInput {
  @Field(() => ID, {
    description: 'Campaign ID to get the dependency graph for',
  })
  campaignId!: string;

  @Field({
    defaultValue: 'main',
    description: 'Branch ID to get the dependency graph for',
  })
  branchId!: string;
}

/**
 * GetNodeDependenciesInput - Input for getting dependencies of a specific node
 */
@InputType()
export class GetNodeDependenciesInput {
  @Field(() => ID, {
    description: 'Campaign ID',
  })
  campaignId!: string;

  @Field({
    defaultValue: 'main',
    description: 'Branch ID',
  })
  branchId!: string;

  @Field(() => ID, {
    description: 'Node ID to get dependencies for',
  })
  nodeId!: string;
}

/**
 * InvalidateDependencyGraphInput - Input for invalidating a dependency graph cache
 */
@InputType()
export class InvalidateDependencyGraphInput {
  @Field(() => ID, {
    description: 'Campaign ID',
  })
  campaignId!: string;

  @Field({
    defaultValue: 'main',
    description: 'Branch ID',
  })
  branchId!: string;
}
