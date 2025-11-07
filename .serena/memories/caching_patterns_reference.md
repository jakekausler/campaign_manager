# Caching Patterns Reference for Stage 3

This document provides the exact patterns used in Stage 2 and Stage 3 for implementing caching with Redis.

## Pattern Overview

The caching pattern follows this flow:

1. **Check cache** → `cache.get()` with try-catch
2. **Cache miss** → Query database
3. **Store in cache** → `cache.set()` with TTL
4. **Handle errors** → Log but don't throw (graceful degradation)

---

## 1. Cache Check Pattern

```typescript
// Check cache first
try {
  const cached = await this.cache.get<ResultType>(cacheKey);
  if (cached) {
    this.logger.debug(`Cache hit for ...`);
    return cached;
  }

  this.logger.debug(`Cache miss for ...`);
} catch (error) {
  // Log cache error but continue - graceful degradation
  this.logger.warn(
    `Failed to read cache for ${cacheKey}`,
    error instanceof Error ? error.message : undefined
  );
}
```

**Key Points:**

- Use `cache.get<T>()` with generic type for type safety
- Check for truthy value (cached might be `null`)
- Wrap in try-catch for graceful degradation
- Log both hit and miss for debugging
- Continue to database if cache fails

---

## 2. Cache Store Pattern (Post-Query)

```typescript
// Store in cache for future requests (TTL: 600 seconds)
try {
  await this.cache.set(cacheKey, results, { ttl: 600 });
  this.logger.debug(`Cached results: ${cacheKey}`);
} catch (error) {
  // Log cache error but don't throw - graceful degradation
  this.logger.warn(
    `Failed to cache results for ${cacheKey}`,
    error instanceof Error ? error.message : undefined
  );
}

return results;
```

**Key Points:**

- Always provide TTL in milliseconds (600 = 600 seconds)
- Don't block main flow if cache write fails
- Log success for debugging
- Return results even if cache write fails

---

## 3. Cache Key Building Patterns

### For Spatial Queries (NEW - Stage 3)

```typescript
import { buildSpatialQueryKey, normalizeSpatialParams } from '../../common/cache/cache-key.builder';

// Normalize parameters for deterministic cache keys
const normalizedParams = normalizeSpatialParams(
  input.point.latitude,
  input.point.longitude,
  input.radius,
  input.srid || 3857,
  input.worldId
);

// Build cache key for spatial query
const cacheKey = buildSpatialQueryKey(
  'locations-near', // query type
  normalizedParams, // normalized parameters array
  'main' // branchId (hardcoded to 'main' for now)
);
```

### For Entity Lists (Existing Pattern)

```typescript
// Simple string concatenation (from settlement.service.ts)
const branchId = 'main';
const cacheKey = `settlements:kingdom:${kingdomId}:${branchId}`;
```

---

## 4. Complete locationsNear() Caching Example

This is the exact pattern you need to implement for `locationsNear()`:

```typescript
/**
 * Find locations near a point with caching
 */
async locationsNear(
  point: GeoJSONPoint,
  radius: number,
  srid: number = SRID.WEB_MERCATOR,
  worldId?: string
): Promise<LocationWithDistance[]> {
  // === STEP 1: BUILD CACHE KEY ===
  const branchId = 'main'; // TODO: Support branch parameter
  const normalizedParams = normalizeSpatialParams(
    point.coordinates[1], // latitude
    point.coordinates[0], // longitude
    radius,
    srid,
    worldId
  );

  const cacheKey = buildSpatialQueryKey(
    'locations-near',
    normalizedParams,
    branchId
  );

  // === STEP 2: CHECK CACHE ===
  try {
    const cached = await this.cache.get<LocationWithDistance[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for locations near point: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss for locations near point: ${cacheKey}`);
  } catch (error) {
    // Log cache read error but continue with database query
    this.logger.warn(
      `Cache read error for locations near ${cacheKey}`,
      error instanceof Error ? error.message : undefined
    );
  }

  // === STEP 3: QUERY DATABASE ===
  const results = await this.spatialService.locationsNear(
    point,
    radius,
    srid,
    worldId
  );

  // === STEP 4: STORE IN CACHE ===
  try {
    await this.cache.set(cacheKey, results, { ttl: 600 });
    this.logger.debug(`Cached locations near point: ${cacheKey}`);
  } catch (error) {
    // Log cache write error but don't prevent returning results
    this.logger.warn(
      `Cache write error for locations near ${cacheKey}`,
      error instanceof Error ? error.message : undefined
    );
  }

  return results;
}
```

---

## 5. Error Handling Pattern (Graceful Degradation)

```typescript
// Pattern used throughout Stage 2 & 3
try {
  // Cache operation (read or write)
  const cached = await this.cache.get(cacheKey);
} catch (error) {
  // Always log with proper error extraction
  this.logger.warn(
    `Cache operation failed for ${cacheKey}`,
    error instanceof Error ? error.message : undefined
  );
  // Continue execution - cache is optional
}

// Never throw on cache errors
// Never block main operation on cache failure
// Always return data even if cache fails
```

---

## 6. Imports Required for locationsNear() Caching

```typescript
// At top of file
import { buildSpatialQueryKey, normalizeSpatialParams } from '../../common/cache/cache-key.builder';
```

---

## 7. Real Examples from Stage 2

### findByKingdom (settlement.service.ts, lines 88-159)

- Simple string concatenation for cache key
- Checks cache before querying (lines 95-108)
- Stores results after query (lines 147-156)
- Uses 600 second TTL

### findBySettlement (structure.service.ts, lines 92-167)

- Same pattern as findByKingdom
- Includes authorization before query
- Try-catch wraps both read and write operations

### getComputedFields (settlement.service.ts, lines 967-1186)

- More complex caching with nested try-catch blocks
- Checks cache before expensive computation
- Stores computed results in cache
- Falls back to local evaluation if cache fails
- Uses 300 second TTL for time-sensitive data

---

## 8. Key Implementation Notes

1. **TTL Values:**
   - Entity lists: 600 seconds
   - Computed fields: 300 seconds
   - Spatial queries: 600 seconds (recommended)

2. **Null vs Missing:**
   - `cache.get()` returns `null` if not cached
   - Check `if (cached)` or `if (cached !== null)`
   - Empty arrays are valid results (not null)

3. **Cache Key Structure:**
   - Keep keys hierarchical: `prefix:type:id:params:branchId`
   - Use `buildSpatialQueryKey()` for spatial queries
   - Use simple strings for simple entity lists

4. **Logger Usage:**
   - `.debug()` for cache hits/misses
   - `.warn()` for cache errors
   - Never `.error()` for optional cache operations

5. **Graceful Degradation:**
   - Always wrap cache operations in try-catch
   - Log but don't throw
   - Return data even if cache fails
   - Cache is an optimization, not a requirement

---

## 9. Cache Invalidation Pattern (For Reference)

When mutations occur, invalidate the cache:

```typescript
try {
  const cacheKey = `locations-near:${normalizedParams}:main`;
  await this.cache.del(cacheKey);
  this.logger.debug(`Invalidated cache: ${cacheKey}`);
} catch (error) {
  this.logger.warn(
    `Failed to invalidate cache ${cacheKey}`,
    error instanceof Error ? error.message : undefined
  );
}
```
