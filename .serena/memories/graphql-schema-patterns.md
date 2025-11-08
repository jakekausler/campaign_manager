# GraphQL Schema Patterns Research

## Directory Structure

GraphQL-related files are organized in `/storage/programs/campaign_manager/packages/api/src/graphql/`:

- `types/` - ObjectType definitions for GraphQL responses
- `resolvers/` - Query/Mutation resolvers
- `inputs/` - Input types for mutations
- `scalars/` - Custom scalar types
- `services/` - Business logic services
- `cache/` - Caching utilities

## File Naming Conventions

- **Type files**: `{entity}.type.ts` (e.g., `audit.type.ts`, `version.type.ts`)
- **Resolver files**: `{entity}.resolver.ts` (e.g., `audit.resolver.ts`)
- **Input files**: `{entity}.input.ts` (e.g., `world.input.ts`)
- **Scalar files**: `{scalar-name}.scalar.ts` (e.g., `datetime.scalar.ts`)
- Schema file is auto-generated: `packages/api/src/schema.gql`

## Type Definition Pattern (ObjectType)

All GraphQL types use NestJS `@nestjs/graphql` decorators with code-first approach:

```typescript
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class MyType {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { description: 'Description here' })
  name!: string;

  @Field(() => Int, { nullable: true })
  count?: number;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field()
  timestamp!: Date;
}
```

### Key Patterns:

1. **Use `@ObjectType()` decorator** on class
2. **Use `@Field()` decorator** on each property
3. **Specify return type as arrow function**: `@Field(() => String)`
4. **Add `description`** for all fields for documentation
5. **Use `nullable: true`** for optional fields (with `?:` in TypeScript)
6. **Use `!:` notation** for required fields (non-nullable)
7. **Complex types**: Use `@Field(() => TypeName)` or `@Field(() => [TypeName])`

## Statistics Type Pattern

For statistics/monitoring types with numeric metrics:

```typescript
import { ObjectType, Field, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class CacheStats {
  @Field(() => Int, { description: 'Total number of cache hits' })
  hits!: number;

  @Field(() => Int, { description: 'Total number of cache misses' })
  misses!: number;

  @Field(() => Float, { description: 'Cache hit rate as percentage (0-100)' })
  hitRate!: number;

  @Field(() => Int, { description: 'Total number of set operations' })
  sets!: number;

  @Field(() => Int, { description: 'Total number of delete operations' })
  deletes!: number;

  @Field({ description: 'When metrics collection started' })
  startTime!: Date;

  @Field(() => String, { nullable: true })
  summary?: string;
}
```

## Resolver/Query Pattern

Resolvers are classes decorated with `@Resolver()` containing query methods:

```typescript
import { Query, Resolver, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

@Resolver(() => MyType)
export class MyTypeResolver {
  constructor(private readonly service: MyTypeService) {}

  @Query(() => MyType, {
    description: 'Get a specific item by ID',
  })
  @UseGuards(JwtAuthGuard)
  async getItem(@Args('id', { type: () => ID }) id: string): Promise<MyType> {
    return this.service.getItem(id);
  }

  @Query(() => [MyType], {
    description: 'Get all items with optional filtering',
  })
  async getAllItems(
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 })
    limit: number = 50
  ): Promise<MyType[]> {
    return this.service.getAllItems(limit);
  }
}
```

### Key Query Patterns:

1. **Return type as first argument**: `@Query(() => MyType)`
2. **Always add `description`** for endpoint documentation
3. **Use `@UseGuards(JwtAuthGuard)`** for protected endpoints
4. **Args pattern**:
   - Simple type: `@Args('name') name: string`
   - Typed: `@Args('id', { type: () => ID }) id: string`
   - Optional with default: `@Args('limit', { type: () => Int, nullable: true, defaultValue: 50 }) limit: number = 50`
5. **Array returns**: `@Query(() => [MyType])`

## Complex Type Examples

### Pagination Types

```typescript
// For paginated responses
@ObjectType()
export class PageInfo {
  @Field(() => Boolean)
  hasNextPage!: boolean;

  @Field(() => Boolean)
  hasPreviousPage!: boolean;

  @Field(() => String, { nullable: true })
  startCursor!: string | null;

  @Field(() => String, { nullable: true })
  endCursor!: string | null;
}
```

### Nested Types

```typescript
@ObjectType()
export class OuterType {
  @Field(() => ID)
  id!: string;

  @Field(() => InnerType)
  nested!: InnerType;

  @Field(() => [InnerType])
  items!: InnerType[];
}
```

### JSON Fields

```typescript
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class JsonType {
  @Field(() => GraphQLJSON)
  metadata!: Record<string, unknown>;

  @Field(() => GraphQLJSON, { nullable: true })
  config?: Record<string, unknown>;
}
```

## Module Registration

Types and resolvers must be registered in the GraphQL module:

File: `/storage/programs/campaign_manager/packages/api/src/graphql/graphql.module.ts`

- Auto-generates schema file: `packages/api/src/schema.gql`
- Resolvers are provided via dependency injection
- Module uses code-first approach (no separate .graphql files)

## Available Scalars

- `String`, `Int`, `Float`, `Boolean`, `ID` - Built-in GraphQL scalars
- `Date` - Custom scalar from `datetime.scalar.ts`
- `GeoJSON` - Custom scalar for geospatial data
- `JSON` - From `graphql-type-json` package
- `Upload` - For file uploads

## Cache-Related Context

The `CacheService` (in `/storage/programs/campaign_manager/packages/api/src/common/cache/cache.service.ts`) tracks these metrics:

```typescript
interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  sets: number;
  deletes: number;
  patternDeletes: number;
  startTime: number;
  enabled: boolean;
}
```

This is used by `CacheStatsService` which needs GraphQL type definition.
