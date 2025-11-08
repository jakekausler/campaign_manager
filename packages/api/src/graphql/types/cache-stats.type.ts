import { ObjectType, Field, Int, Float } from '@nestjs/graphql';

/**
 * Cache statistics for a specific cache type
 */
@ObjectType({ description: 'Statistics for a specific cache type' })
export class CacheTypeStats {
  @Field(() => Int, { description: 'Total cache hits for this type' })
  hits!: number;

  @Field(() => Int, { description: 'Total cache misses for this type' })
  misses!: number;

  @Field(() => Int, { description: 'Total cache set operations for this type' })
  sets!: number;

  @Field(() => Int, { description: 'Total single-key invalidations for this type' })
  invalidations!: number;

  @Field(() => Int, {
    description: 'Total pattern-based cascade invalidations for this type',
  })
  cascadeInvalidations!: number;

  @Field(() => Float, {
    description: 'Cache hit rate as a decimal (0.0 to 1.0)',
  })
  hitRate!: number;
}

/**
 * Redis memory usage information
 */
@ObjectType({ description: 'Redis memory usage information from INFO command' })
export class RedisMemoryInfo {
  @Field(() => Int, { description: 'Total memory used by Redis in bytes' })
  usedMemory!: number;

  @Field(() => String, {
    description: 'Human-readable used memory (e.g., "15.2M")',
  })
  usedMemoryHuman!: string;

  @Field(() => Int, { description: 'Peak memory used by Redis in bytes' })
  usedMemoryPeak!: number;

  @Field(() => String, {
    description: 'Human-readable peak memory (e.g., "20.5M")',
  })
  usedMemoryPeakHuman!: string;

  @Field(() => Int, { description: 'Memory used by dataset in bytes' })
  usedMemoryDataset!: number;

  @Field(() => Int, { description: 'Memory used by Lua engine in bytes' })
  usedMemoryLua!: number;

  @Field(() => Int, { description: 'Number of keys in the database' })
  dbKeys!: number;

  @Field(() => Int, { description: 'Number of keys with expiration set' })
  dbExpires!: number;
}

/**
 * Aggregated cache statistics across all cache types
 */
@ObjectType({ description: 'Aggregated cache statistics and performance metrics' })
export class CacheStats {
  @Field(() => Int, { description: 'Total cache hits across all types' })
  totalHits!: number;

  @Field(() => Int, { description: 'Total cache misses across all types' })
  totalMisses!: number;

  @Field(() => Float, {
    description: 'Overall cache hit rate as a decimal (0.0 to 1.0)',
  })
  hitRate!: number;

  @Field(() => Int, { description: 'Total cache set operations across all types' })
  totalSets!: number;

  @Field(() => Int, {
    description: 'Total single-key invalidations across all types',
  })
  totalInvalidations!: number;

  @Field(() => Int, {
    description: 'Total pattern-based cascade invalidations across all types',
  })
  totalCascadeInvalidations!: number;

  @Field(() => Float, {
    description: 'Estimated time saved by cache hits in milliseconds',
  })
  estimatedTimeSavedMs!: number;

  @Field({ description: 'Timestamp when cache statistics tracking started' })
  startTime!: Date;

  @Field(() => Boolean, {
    description: 'Whether cache statistics tracking is currently enabled',
  })
  enabled!: boolean;

  @Field(() => CacheTypeStats, {
    nullable: true,
    description: 'Statistics for computed-fields cache type',
  })
  computedFields?: CacheTypeStats;

  @Field(() => CacheTypeStats, {
    nullable: true,
    description: 'Statistics for settlements cache type',
  })
  settlements?: CacheTypeStats;

  @Field(() => CacheTypeStats, {
    nullable: true,
    description: 'Statistics for structures cache type',
  })
  structures?: CacheTypeStats;

  @Field(() => CacheTypeStats, {
    nullable: true,
    description: 'Statistics for spatial cache type',
  })
  spatial?: CacheTypeStats;

  @Field(() => RedisMemoryInfo, {
    nullable: true,
    description: 'Redis server memory usage information',
  })
  memoryInfo?: RedisMemoryInfo;

  @Field(() => Int, {
    nullable: true,
    description: 'Total number of keys for computed-fields cache type',
  })
  computedFieldsKeyCount?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Total number of keys for settlements cache type',
  })
  settlementsKeyCount?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Total number of keys for structures cache type',
  })
  structuresKeyCount?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Total number of keys for spatial cache type',
  })
  spatialKeyCount?: number;
}
