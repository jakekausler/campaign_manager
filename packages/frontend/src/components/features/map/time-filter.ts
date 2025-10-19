/**
 * Time Filtering Utilities
 *
 * Utilities for filtering entities based on temporal fields (createdAt, deletedAt, archivedAt).
 * Used by map layer hooks to support historical time view functionality.
 */

/**
 * Filter entities by time - checks if entity existed at the given time
 *
 * Entity exists at time T if:
 * - createdAt <= T (entity was created before or at time T)
 * - AND (deletedAt > T OR deletedAt is null) (entity was not deleted before time T)
 * - AND (archivedAt > T OR archivedAt is null) (entity was not archived before time T)
 *
 * @param entities - Array of entities with temporal fields
 * @param time - Time to filter by (null means current time, showing only active entities)
 * @returns Filtered array of entities that existed at the specified time
 *
 * @example
 * ```typescript
 * const currentSettlements = filterByTime(allSettlements, null); // Only active
 * const historicalSettlements = filterByTime(allSettlements, new Date('2024-01-01')); // As of Jan 1
 * ```
 */
export function filterByTime<
  T extends {
    createdAt?: string | Date;
    deletedAt?: string | Date | null;
    archivedAt?: string | Date | null;
  },
>(entities: T[], time: Date | null): T[] {
  if (!time) {
    // If no time specified, return all active entities (not deleted/archived)
    return entities.filter((e) => !e.deletedAt && !e.archivedAt);
  }

  const timeMs = time.getTime();

  return entities.filter((entity) => {
    // Entity must have been created by the specified time
    if (!entity.createdAt) return false;
    const createdMs = new Date(entity.createdAt).getTime();
    if (createdMs > timeMs) return false;

    // Entity must not have been deleted by the specified time
    if (entity.deletedAt) {
      const deletedMs = new Date(entity.deletedAt).getTime();
      if (deletedMs <= timeMs) return false;
    }

    // Entity must not have been archived by the specified time
    if (entity.archivedAt) {
      const archivedMs = new Date(entity.archivedAt).getTime();
      if (archivedMs <= timeMs) return false;
    }

    return true;
  });
}
