/**
 * Pagination Utilities
 * Helper functions for cursor-based pagination
 */

import type { Edge, PageInfo, PaginatedResponse } from '../types/pagination.type';

/**
 * Encode a cursor from an entity ID
 * Uses base64 encoding for obfuscation
 */
export function encodeCursor(id: string): string {
  return Buffer.from(`cursor:${id}`).toString('base64');
}

/**
 * Decode a cursor to get the entity ID
 * Returns null if cursor is invalid
 */
export function decodeCursor(cursor: string): string | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    if (!decoded.startsWith('cursor:')) {
      return null;
    }
    return decoded.slice(7); // Remove 'cursor:' prefix
  } catch {
    return null;
  }
}

/**
 * Pagination parameters for queries
 */
export interface PaginationParams {
  first?: number; // Number of items to return
  after?: string; // Cursor to start after
  last?: number; // Number of items to return from end (not commonly used)
  before?: string; // Cursor to start before (not commonly used)
}

/**
 * Build a paginated response from a list of entities
 *
 * @param entities - List of entities (should include one extra item if hasMore)
 * @param totalCount - Total count of all matching entities
 * @param first - Number of items requested
 * @param after - Cursor of the item to start after
 * @param getId - Function to extract ID from entity
 */
export function buildPaginatedResponse<T>(
  entities: T[],
  totalCount: number,
  first: number,
  after: string | null,
  getId: (entity: T) => string
): PaginatedResponse<T> {
  const hasMore = entities.length > first;
  const nodes = hasMore ? entities.slice(0, first) : entities;

  const edges: Edge<T>[] = nodes.map((node) => ({
    cursor: encodeCursor(getId(node)),
    node,
  }));

  const pageInfo: PageInfo = {
    hasNextPage: hasMore,
    hasPreviousPage: after !== null,
    startCursor: edges.length > 0 ? edges[0].cursor : null,
    endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
  };

  return {
    edges,
    pageInfo,
    totalCount,
  };
}

/**
 * Calculate skip value for Prisma query from cursor
 * Returns 0 if no cursor provided
 */
export function getSkipFromCursor(after?: string): number {
  if (!after) {
    return 0;
  }
  // When using cursor, we skip 1 to exclude the cursor item itself
  return 1;
}

/**
 * Get cursor ID for Prisma query
 * Returns undefined if no cursor provided
 */
export function getCursorIdFromCursor(after?: string): string | undefined {
  if (!after) {
    return undefined;
  }
  const id = decodeCursor(after);
  return id || undefined;
}

/**
 * Default pagination limits
 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Validate and normalize pagination parameters
 */
export function normalizePaginationParams(params: PaginationParams): {
  first: number;
  after: string | null;
} {
  let first = params.first ?? DEFAULT_PAGE_SIZE;

  // Enforce maximum page size
  if (first > MAX_PAGE_SIZE) {
    first = MAX_PAGE_SIZE;
  }

  // Ensure minimum page size
  if (first < 1) {
    first = 1;
  }

  const after = params.after ?? null;

  return { first, after };
}
