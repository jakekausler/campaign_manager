# Resolver JSDoc Documentation Guide

## Summary

This document contains findings from analyzing GraphQL resolver files in `/packages/api/src/graphql/resolvers/` for JSDoc comment patterns and structure.

---

## 1. Complete List of Resolver Files (23 resolvers)

All located in `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/`:

1. audit.resolver.ts
2. branch.resolver.ts
3. cache-stats.resolver.ts
4. campaign.resolver.ts
5. character.resolver.ts
6. dependency-graph.resolver.ts
7. effect.resolver.ts
8. encounter.resolver.ts
9. event.resolver.ts
10. field-condition.resolver.ts
11. health.resolver.ts
12. kingdom.resolver.ts
13. link.resolver.ts
14. location.resolver.ts
15. merge.resolver.ts
16. party.resolver.ts
17. settlement.resolver.ts
18. spatial.resolver.ts
19. state-variable.resolver.ts
20. structure.resolver.ts
21. version.resolver.ts
22. world-time.resolver.ts
23. world.resolver.ts

---

## 2. Resolver Naming Patterns

- **Pattern**: `{Entity}.resolver.ts`
- **Examples**:
  - `campaign.resolver.ts`
  - `settlement.resolver.ts`
  - `structure.resolver.ts`
- **Notes**: All follow consistent lowercase kebab-case naming

---

## 3. Common Resolver Structure

### Class Definition

```typescript
@Resolver(() => EntityType)
export class EntityResolver {
  constructor(
    private readonly entityService: EntityService,
    private readonly otherService?: OtherService
  ) {}

  // Query methods
  // Mutation methods
  // Field resolver methods (ResolveField)
}
```

### Typical Methods Found in Resolvers

1. **Query Methods** (return data):
   - Get by ID: `async entity(@Args('id') id: string): Promise<Entity | null>`
   - Get all/many: `async entities(...): Promise<Entity[]>`
   - Specialized queries: `async entityAsOf(id, branchId, asOf): Promise<Entity>`

2. **Mutation Methods** (modify data):
   - Create: `async createEntity(@Args('input') input: CreateEntityInput): Promise<Entity>`
   - Update: `async updateEntity(@Args('id') id: string, @Args('input') input: UpdateEntityInput): Promise<Entity>`
   - Delete: `async deleteEntity(@Args('id') id: string): Promise<Entity>`
   - Archive: `async archiveEntity(@Args('id') id: string): Promise<Entity>`
   - Restore: `async restoreEntity(@Args('id') id: string): Promise<Entity>`
   - Specialized mutations: e.g., `setSettlementLevel`, `defineVariableSchema`, `setVariable`

3. **Field Resolver Methods** (@ResolveField):
   - Navigate relationships: `async location(@Parent() settlement: Settlement): Promise<Location | null>`
   - Lazy-load collections: `async structures(@Parent() settlement: Settlement): Promise<Structure[]>`
   - Compute values: `async computedFields(@Parent() entity): Promise<Record<string, unknown>>`

### Common Decorators Used

- `@Resolver(() => EntityType)` - Class decorator
- `@Query(() => ReturnType, options)` - Query method decorator
- `@Mutation(() => ReturnType, options)` - Mutation method decorator
- `@ResolveField(() => FieldType, options)` - Field resolver decorator
- `@Args(name, options)` - Parameter decorator for arguments
- `@Parent()` - Parameter decorator for parent object
- `@Context()` - Parameter decorator for GraphQL context
- `@CurrentUser()` - Custom parameter decorator for authenticated user
- `@UseGuards(JwtAuthGuard, RolesGuard)` - Authentication/authorization guards
- `@Roles('owner', 'gm')` - Role-based access control

### Common Metadata Options

- `description: string` - GraphQL field description (visible in schema/docs)
- `nullable: boolean` - Whether field can be null
- `type: () => Type` - Return type for GraphQL schema

---

## 4. Existing JSDoc Patterns

### Class-Level JSDoc

All analyzed resolvers have a **simple 2-3 line class JSDoc** at the file top:

**Pattern Found**:

```typescript
/**
 * {Entity} Resolver
 * GraphQL resolvers for {Entity} queries and mutations
 */
```

**Examples**:

```typescript
// health.resolver.ts (lines 1-4)
/**
 * Health Check Resolver
 * Provides basic health check query for GraphQL endpoint testing
 */

// campaign.resolver.ts (lines 1-4)
/**
 * Campaign Resolver
 * GraphQL resolvers for Campaign queries and mutations
 */

// settlement.resolver.ts (lines 1-4)
/**
 * Settlement Resolver
 * GraphQL resolvers for Settlement queries and mutations
 */

// branch.resolver.ts (lines 1-4)
/**
 * Branch Resolver
 * GraphQL resolvers for Branch queries and mutations (alternate timeline management)
 */
```

### Method-Level JSDoc

**NONE FOUND** - All methods rely solely on the `description` option in decorators

**Current Pattern**:

```typescript
@Query(() => Settlement, { nullable: true, description: 'Get settlement by ID' })
async settlement(
  @Args('id', { type: () => ID }) id: string,
  @CurrentUser() user: AuthenticatedUser
): Promise<Settlement | null> {
```

---

## 5. Resolver Organization

### By Feature/Entity

Resolvers are organized by business entity:

- **Core Domain**: campaign, world, kingdom, settlement, structure
- **Spatial**: location, spatial
- **Temporal**: world-time, encounter, event
- **Management**: character, party, link
- **Advanced Features**: branch (versioning/branching), effect, state-variable, dependency-graph, field-condition
- **System**: audit, merge, version, cache-stats, health

### Directory Structure

```
packages/api/src/graphql/
├── resolvers/         # All 23 resolver files
├── types/             # GraphQL ObjectType definitions
├── inputs/            # GraphQL Input types
├── services/          # Business logic services (one per entity)
├── dataloaders/       # Batch loaders for efficient queries
└── ...
```

---

## 6. JSDoc Documentation Standards (To Be Applied)

Based on project CLAUDE.md guidelines and existing patterns:

### Class-Level JSDoc

```typescript
/**
 * {Entity} Resolver
 *
 * Provides GraphQL resolvers for {Entity} queries, mutations, and field resolution.
 *
 * Key Methods:
 * - Queries: Retrieve single and multiple entities
 * - Mutations: Create, update, delete, archive, restore entities
 * - Field Resolvers: Resolve relationships and computed fields
 *
 * Authentication: All methods require JWT authentication via @UseGuards(JwtAuthGuard)
 * Authorization: Mutation methods require specific roles via @Roles decorator
 *
 * @class
 */
```

### Method-Level JSDoc Format

For each method, add JSDoc above the decorator:

```typescript
/**
 * Get settlement by ID.
 *
 * @param id - The settlement ID
 * @param user - Authenticated user (injected)
 * @returns Settlement object or null if not found or user lacks access
 * @throws ForbiddenException - If user lacks access to the settlement
 *
 * @decorator @Query
 * @guard JwtAuthGuard
 */
@Query(() => Settlement, { nullable: true, description: 'Get settlement by ID' })
@UseGuards(JwtAuthGuard)
async settlement(
  @Args('id', { type: () => ID }) id: string,
  @CurrentUser() user: AuthenticatedUser
): Promise<Settlement | null>
```

### For Query Methods

```typescript
/**
 * Get all {entities} for a {parent}.
 *
 * Fetches all {entity} records associated with the specified {parent}, with access control.
 *
 * @param {parentId} - The parent ID
 * @param user - Authenticated user (injected)
 * @returns Array of {Entity} objects
 *
 * @decorator @Query
 * @guard JwtAuthGuard
 */
@Query(() => [EntityType], { description: '...' })
@UseGuards(JwtAuthGuard)
async {entities}(
  @Args('{parentId}', { type: () => ID }) {parentId}: string,
  @CurrentUser() user: AuthenticatedUser
): Promise<EntityType[]>
```

### For Mutation Methods

```typescript
/**
 * Create a new {entity}.
 *
 * Creates a new {entity} record with the provided input data.
 * Enforces access control and validation.
 *
 * @param input - Creation data (CreateEntityInput)
 * @param user - Authenticated user (injected)
 * @returns The newly created Entity
 * @throws ForbiddenException - If user lacks authorization
 * @throws BadRequestException - If input validation fails
 *
 * @decorator @Mutation
 * @guard JwtAuthGuard, RolesGuard
 * @roles 'owner', 'gm'
 */
@Mutation(() => EntityType, { description: 'Create a new {entity}' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'gm')
async create{Entity}(
  @Args('input') input: Create{Entity}Input,
  @CurrentUser() user: AuthenticatedUser
): Promise<EntityType>
```

### For ResolveField Methods

```typescript
/**
 * Resolve the {fieldName} field for a {parentEntity}.
 *
 * Resolves the relationship to {RelatedEntity} using a DataLoader
 * for efficient batch loading and caching.
 *
 * @param {entity} - The parent entity instance (injected)
 * @param context - GraphQL context with dataloaders (injected)
 * @returns The resolved {RelatedEntity} or null if not found
 *
 * @decorator @ResolveField
 * @see DataLoader pattern for batch loading
 */
@ResolveField(() => RelatedEntityType, { description: '...' })
async {fieldName}(
  @Parent() {entity}: ParentEntityType,
  @Context() context: GraphQLContext
): Promise<RelatedEntityType | null>
```

---

## 7. Key Insights for JSDoc Implementation

1. **Existing Coverage**: Class-level JSDoc exists (simple format) but NO method-level JSDoc
2. **Decorator Descriptions**: Each decorator already has a `description` option - JSDoc should expand on this
3. **Pattern Consistency**: All resolvers follow same structure - standardized JSDoc format will be appropriate
4. **Common Guards**: Most need `@UseGuards(JwtAuthGuard)` and `@UseGuards(JwtAuthGuard, RolesGuard)`
5. **Variable Methods**: Some resolvers (Settlement, Structure) have additional variable schema methods
6. **Field Resolvers**: Use DataLoaders for efficient relationship resolution

---

## 8. Special Resolver Patterns

### Settlement & Structure Resolvers

Additional methods for variable schema management:

- `defineSettlementVariableSchema` / `defineStructureVariableSchema`
- `setSettlementVariable` / `setStructureVariable`
- `deleteSettlementVariableSchema` / `deleteStructureVariableSchema`
- `settlementVariable(s)` / `structureVariable(s)` queries
- `settlementVariableSchemas` / `structureVariableSchemas` queries

### Branch Resolver

Specialized methods:

- `branch` and `branches` queries
- Additional authorization checks beyond decorator level

### Merge Resolver

Specialized methods for merge operations

### Spatial Resolver

Specialized methods for spatial queries

### State Variable Resolver

Methods for dynamic state variable management

---

## Files Needing JSDoc

All 23 resolver files need method-level JSDoc comments added:

1. ✓ audit.resolver.ts
2. ✓ branch.resolver.ts
3. ✓ cache-stats.resolver.ts
4. ✓ campaign.resolver.ts
5. ✓ character.resolver.ts
6. ✓ dependency-graph.resolver.ts
7. ✓ effect.resolver.ts
8. ✓ encounter.resolver.ts
9. ✓ event.resolver.ts
10. ✓ field-condition.resolver.ts
11. ✓ health.resolver.ts (simple - 1 query method)
12. ✓ kingdom.resolver.ts
13. ✓ link.resolver.ts
14. ✓ location.resolver.ts
15. ✓ merge.resolver.ts
16. ✓ party.resolver.ts
17. ✓ settlement.resolver.ts (complex - multiple method types)
18. ✓ spatial.resolver.ts
19. ✓ state-variable.resolver.ts
20. ✓ structure.resolver.ts (complex - multiple method types)
21. ✓ version.resolver.ts
22. ✓ world-time.resolver.ts
23. ✓ world.resolver.ts

---

## File Sizes and Complexity

Quick analysis:

- **Simple**: health.resolver.ts (1 query), version.resolver.ts
- **Medium**: campaign.resolver.ts, world.resolver.ts, kingdom.resolver.ts
- **Complex**: settlement.resolver.ts, structure.resolver.ts (20+ methods each including variable schema methods)

Total estimate: ~400-500 method-level JSDoc blocks to add across all resolvers.
