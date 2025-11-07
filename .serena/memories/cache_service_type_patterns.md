# Cache Service Type Definition Patterns

## Codebase Analysis - Type Definition Patterns for Cache Service

### Existing Cache Implementations Found

1. **TileCacheService** (`packages/api/src/common/services/tile-cache.service.ts`)
   - Simple in-memory cache for GeoJSON FeatureCollections
   - Defines: `MapFilters` interface and `CacheStats` interface

2. **ExpressionCache** (`packages/api/src/rules/cache/expression-cache.ts`)
   - LRU cache with size limits and metrics tracking
   - Defines: `ExpressionCacheOptions` and `CacheStats` with comprehensive metrics

### Pattern Summary

The codebase uses three main interface patterns for service-related types:

1. **Options/Configuration Interfaces** (e.g., `ExpressionCacheOptions`, `SandboxOptions`)
2. **Statistics/Metrics Interfaces** (e.g., `CacheStats`, `CacheStatsResponse`)
3. **Parameter/Params Interfaces** (e.g., `ExecuteMergeParams`, `PaginationParams`)

### Key Observations

1. **Documentation Style**: Extensive JSDoc comments for each interface property
2. **Optional Properties**: Configuration interfaces use optional properties with defaults
3. **Metrics Properties**: Stats interfaces include computed metrics (hits, misses, hitRate)
4. **Separation**: Type definitions are kept in the same file as their service or in dedicated types files
5. **Naming Convention**: Suffixes like `-Options`, `-Params`, `-Stats` are standard
