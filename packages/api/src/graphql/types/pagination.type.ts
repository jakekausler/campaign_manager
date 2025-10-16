/**
 * Shared Pagination Types for GraphQL
 * Implements cursor-based pagination following Relay specification
 */

import { Field, ObjectType, Int } from '@nestjs/graphql';

/**
 * Page information for cursor-based pagination
 */
@ObjectType()
export class PageInfo {
  @Field(() => Boolean, { description: 'Whether there are more items after this page' })
  hasNextPage!: boolean;

  @Field(() => Boolean, { description: 'Whether there are more items before this page' })
  hasPreviousPage!: boolean;

  @Field(() => String, { nullable: true, description: 'Cursor of the first item in this page' })
  startCursor!: string | null;

  @Field(() => String, { nullable: true, description: 'Cursor of the last item in this page' })
  endCursor!: string | null;
}

/**
 * Base edge type for paginated results
 * Generic T should be replaced with specific entity type
 */
export interface Edge<T> {
  cursor: string;
  node: T;
}

/**
 * Base paginated response type
 * Generic T should be replaced with specific entity type
 */
export interface PaginatedResponse<T> {
  edges: Edge<T>[];
  pageInfo: PageInfo;
  totalCount: number;
}

/**
 * Helper function to create a paginated edge type
 * Used to generate entity-specific edge types
 */
export function createEdgeType<T>(NodeType: new () => T, typeName: string) {
  @ObjectType(`${typeName}Edge`)
  class EdgeClass implements Edge<T> {
    @Field(() => String, { description: 'Cursor for this edge' })
    cursor!: string;

    @Field(() => NodeType, { description: 'The node at this edge' })
    node!: T;
  }
  return EdgeClass;
}

/**
 * Helper function to create a paginated response type
 * Used to generate entity-specific paginated response types
 */
export function createPaginatedType<T>(
  _NodeType: new () => T,
  EdgeType: new () => Edge<T>,
  typeName: string
) {
  @ObjectType(`Paginated${typeName}`)
  class PaginatedClass implements PaginatedResponse<T> {
    @Field(() => [EdgeType], { description: 'List of edges in this page' })
    edges!: Edge<T>[];

    @Field(() => PageInfo, { description: 'Information about this page' })
    pageInfo!: PageInfo;

    @Field(() => Int, { description: 'Total count of items matching the query' })
    totalCount!: number;
  }
  return PaginatedClass;
}
