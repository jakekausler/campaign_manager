/**
 * Soft Delete Helpers
 *
 * Utilities for working with soft-deleted entities.
 * All mutable entities in the schema have a `deletedAt` field.
 * Entities are never hard deleted to preserve audit trail and versioning.
 */

/**
 * Filter to exclude soft-deleted records
 */
export const notDeleted = {
  deletedAt: null,
};

/**
 * Filter to include only soft-deleted records
 */
export const onlyDeleted = {
  deletedAt: { not: null },
};

/**
 * Soft delete an entity by setting deletedAt timestamp
 *
 * @param delegate - Prisma model delegate (e.g., prisma.user)
 * @param id - Entity ID to soft delete
 * @returns Updated entity with deletedAt set
 *
 * @example
 * ```typescript
 * const deleted = await softDelete(prisma.user, userId);
 * ```
 */
export async function softDelete<T extends { update: (args: unknown) => Promise<unknown> }>(
  delegate: T,
  id: string
): Promise<unknown> {
  return delegate.update({
    where: { id },
    data: { deletedAt: new Date() },
  } as Parameters<T['update']>[0]);
}

/**
 * Restore a soft-deleted entity by clearing deletedAt
 *
 * @param delegate - Prisma model delegate (e.g., prisma.user)
 * @param id - Entity ID to restore
 * @returns Updated entity with deletedAt cleared
 *
 * @example
 * ```typescript
 * const restored = await restoreDeleted(prisma.user, userId);
 * ```
 */
export async function restoreDeleted<T extends { update: (args: unknown) => Promise<unknown> }>(
  delegate: T,
  id: string
): Promise<unknown> {
  return delegate.update({
    where: { id },
    data: { deletedAt: null },
  } as Parameters<T['update']>[0]);
}

/**
 * Find all active (non-deleted) entities
 *
 * @param delegate - Prisma model delegate (e.g., prisma.user)
 * @param where - Additional where conditions
 * @returns Array of active entities
 *
 * @example
 * ```typescript
 * const activeUsers = await findActive(prisma.user, { role: 'admin' });
 * ```
 */
export async function findActive<T extends { findMany: (args: unknown) => Promise<unknown[]> }>(
  delegate: T,
  where?: Record<string, unknown>
): Promise<unknown[]> {
  return delegate.findMany({
    where: {
      ...where,
      ...notDeleted,
    },
  } as Parameters<T['findMany']>[0]);
}

/**
 * Find a single active (non-deleted) entity
 *
 * @param delegate - Prisma model delegate (e.g., prisma.user)
 * @param where - Where conditions
 * @returns Active entity or null
 *
 * @example
 * ```typescript
 * const user = await findOneActive(prisma.user, { id: userId });
 * ```
 */
export async function findOneActive<
  T extends { findFirst: (args: unknown) => Promise<unknown | null> },
>(delegate: T, where: Record<string, unknown>): Promise<unknown | null> {
  return delegate.findFirst({
    where: {
      ...where,
      ...notDeleted,
    },
  } as Parameters<T['findFirst']>[0]);
}

/**
 * Count active (non-deleted) entities
 *
 * @param delegate - Prisma model delegate (e.g., prisma.user)
 * @param where - Additional where conditions
 * @returns Count of active entities
 *
 * @example
 * ```typescript
 * const count = await countActive(prisma.user, { role: 'admin' });
 * ```
 */
export async function countActive<T extends { count: (args: unknown) => Promise<number> }>(
  delegate: T,
  where?: Record<string, unknown>
): Promise<number> {
  return delegate.count({
    where: {
      ...where,
      ...notDeleted,
    },
  } as Parameters<T['count']>[0]);
}

/**
 * Hard delete an entity (USE WITH CAUTION)
 *
 * Only use for:
 * - Test cleanup
 * - Data anonymization (GDPR right to be forgotten)
 * - Removing test/spam data
 *
 * @param delegate - Prisma model delegate (e.g., prisma.user)
 * @param id - Entity ID to hard delete
 * @returns Deleted entity
 *
 * @example
 * ```typescript
 * const deleted = await hardDelete(prisma.user, userId);
 * ```
 */
export async function hardDelete<T extends { delete: (args: unknown) => Promise<unknown> }>(
  delegate: T,
  id: string
): Promise<unknown> {
  return delegate.delete({
    where: { id },
  } as Parameters<T['delete']>[0]);
}

/**
 * Bulk soft delete entities
 *
 * @param delegate - Prisma model delegate (e.g., prisma.user)
 * @param where - Where conditions for entities to delete
 * @returns Update count
 *
 * @example
 * ```typescript
 * const result = await bulkSoftDelete(prisma.user, { role: 'guest' });
 * console.log(`Deleted ${result.count} users`);
 * ```
 */
export async function bulkSoftDelete<
  T extends { updateMany: (args: unknown) => Promise<{ count: number }> },
>(delegate: T, where: Record<string, unknown>): Promise<{ count: number }> {
  return delegate.updateMany({
    where: {
      ...where,
      ...notDeleted, // Only delete records not already deleted
    },
    data: { deletedAt: new Date() },
  } as Parameters<T['updateMany']>[0]);
}
