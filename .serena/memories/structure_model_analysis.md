# Structure Model Analysis - Building/Landmark Definition

## Structure Model Definition

**File**: `/storage/programs/campaign_manager/packages/api/prisma/schema.prisma` (lines 321-343)

```prisma
model Structure {
  id              String     @id @default(cuid())
  settlementId    String
  settlement      Settlement @relation(fields: [settlementId], references: [id])
  type            String // e.g., 'temple', 'barracks', 'market', 'library'
  name            String
  level           Int        @default(1)
  variables       Json       @default("{}") // Typed variables
  variableSchemas Json       @default("[]") // Array of VariableSchema definitions
  version         Int        @default(1) // For optimistic locking
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  deletedAt       DateTime?
  archivedAt      DateTime?

  // Relations
  stateVars StateVariable[]

  @@index([settlementId])
  @@index([type])
  @@index([deletedAt])
  @@index([archivedAt])
}
```

## Key Fields Summary

| Field             | Type          | Required | Default | Purpose                                                                                                 |
| ----------------- | ------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `id`              | String (CUID) | Yes      | auto    | Unique identifier                                                                                       |
| `settlementId`    | String        | Yes      | -       | Foreign key to Settlement                                                                               |
| `settlement`      | Settlement    | Yes      | -       | Relation to parent settlement                                                                           |
| `type`            | String        | Yes      | -       | Building type (e.g., 'temple', 'barracks', 'market', 'library', 'tower', 'inn', 'smithy', 'university') |
| `name`            | String        | Yes      | -       | Building/structure name                                                                                 |
| `level`           | Int           | No       | 1       | Tier/level of the structure (1-20, scales with settlement level)                                        |
| `variables`       | Json          | No       | {}      | Runtime values for typed variables                                                                      |
| `variableSchemas` | Json          | No       | []      | Metadata definitions for typed variables                                                                |
| `version`         | Int           | No       | 1       | Optimistic locking version                                                                              |
| `createdAt`       | DateTime      | No       | now()   | Creation timestamp                                                                                      |
| `updatedAt`       | DateTime      | No       | now()   | Last update timestamp                                                                                   |
| `deletedAt`       | DateTime      | No       | null    | Soft delete timestamp                                                                                   |
| `archivedAt`      | DateTime      | No       | null    | Archive timestamp                                                                                       |

## Required vs Optional Fields

### REQUIRED

- `settlementId` - Must belong to a settlement
- `type` - Type of structure (building, landmark, etc.)
- `name` - Display name of the structure

### OPTIONAL (with defaults)

- `level` - Defaults to 1
- `variables` - Defaults to empty object `{}`
- `variableSchemas` - Defaults to empty array `[]`
- `version` - Defaults to 1
- `createdAt`, `updatedAt` - Auto-generated
- `deletedAt`, `archivedAt` - For soft delete/archival

## Relationship with Settlement

**Relationship Type**: One-to-Many (Settlement → Structure)

- **Direction**: Each Structure has ONE parent Settlement
- **Field**: `settlementId` (foreign key)
- **Reverse**: `Settlement.structures` (array of Structures)
- **Cascade**: When a settlement is deleted, its structures are NOT automatically deleted (no `onDelete: Cascade`)
- **Typical Usage**: A settlement like "Magnimar" has multiple structures (temple, market, barracks, library, etc.)

## Variable Schema Pattern

Structures follow the SAME variable schema pattern as Settlements and Kingdoms.

### VariableSchema Interface

```typescript
export interface VariableSchema {
  name: string; // Variable name (must be unique within schemas)
  type: 'string' | 'number' | 'boolean' | 'enum';
  enumValues?: string[]; // For enum type only
  defaultValue?: unknown; // Default value
  description?: string; // Human-readable description
}
```

### Supported Variable Types

1. **string**: Text values
2. **number**: Numeric values (integers or floats)
3. **boolean**: True/false values
4. **enum**: Restricted set of allowed string values

## Prisma Create Examples

### Example 1: Minimal Structure (most common for seed)

```typescript
const structure = await prisma.structure.create({
  data: {
    settlementId: 'settlement-1',
    type: 'temple',
    name: 'Temple of Gozreh',
    level: 2,
    variables: {},
    variableSchemas: [],
  },
});
```

### Example 2: Structure with Typed Variables

```typescript
const structure = await prisma.structure.create({
  data: {
    settlementId: 'settlement-1',
    type: 'barracks',
    name: 'City Guard Headquarters',
    level: 3,
    variables: {
      garrison: 150,
      commander: 'Captain Gavrin',
      isOperational: true,
      defenseBonus: 2,
    },
    variableSchemas: [
      {
        name: 'garrison',
        type: 'number',
        description: 'Number of soldiers stationed here',
        defaultValue: 0,
      },
      {
        name: 'commander',
        type: 'string',
        description: 'Name of the garrison commander',
      },
      {
        name: 'isOperational',
        type: 'boolean',
        description: 'Whether the barracks is operational',
        defaultValue: true,
      },
      {
        name: 'defenseBonus',
        type: 'number',
        description: 'Defense bonus provided to settlement',
        defaultValue: 0,
      },
    ],
  },
});
```

### Example 3: Structure with Enum Variables

```typescript
const structure = await prisma.structure.create({
  data: {
    settlementId: 'settlement-1',
    type: 'market',
    name: 'Grand Bazaar',
    level: 2,
    variables: {
      marketSize: 'large',
      quality: 'excellent',
      hasExoticGoods: true,
    },
    variableSchemas: [
      {
        name: 'marketSize',
        type: 'enum',
        enumValues: ['small', 'medium', 'large', 'massive'],
        description: 'Size of the marketplace',
        defaultValue: 'small',
      },
      {
        name: 'quality',
        type: 'enum',
        enumValues: ['poor', 'fair', 'good', 'excellent'],
        description: 'Quality of goods available',
        defaultValue: 'fair',
      },
      {
        name: 'hasExoticGoods',
        type: 'boolean',
        description: 'Whether exotic/rare goods are available',
        defaultValue: false,
      },
    ],
  },
});
```

## Common Structure Types (from codebase and D&D tradition)

- `temple` - Religious building
- `barracks` - Military headquarters
- `market` - Marketplace/bazaar
- `library` - Knowledge/information center
- `tower` - Defensive or magical tower
- `inn` - Lodging/tavern
- `smithy` - Blacksmith/craftsperson workshop
- `university` - School/academy
- `courthouse` - Justice/administrative
- `guild_hall` - Guild headquarters
- `watchtower` - Surveillance/defense
- `granary` - Food storage
- `bridge` - Infrastructure
- `gate` - City entrance
- `dock` - Port facility
- `mine` - Resource extraction
- `farm` - Agricultural facility

## Structure Level System

Structures follow the same level pattern as Settlements:

- **Range**: 1-20 (default: 1)
- **Meaning**: Represents the tier/importance/quality of the structure
- **Progression**:
  - Level 1-3: Small/basic structures
  - Level 4-6: Medium structures
  - Level 7-10: Large/significant structures
  - Level 11-15: Major/important structures
  - Level 16-20: Legendary/exceptional structures

Typically structures in a settlement have levels that correlate with or are lower than the settlement's level.

## Indexes

For performance optimization:

- `settlementId` - Fast lookup of structures in a settlement
- `type` - Fast filtering by structure type
- `deletedAt` - For soft-delete queries
- `archivedAt` - For archival queries

## Relations

### StateVariable

- **Type**: One-to-Many
- **Reverse**: `StateVariable.structure`
- **Purpose**: Derived variables and state that depend on structure data
- **Scope**: `StateVariable.scope = 'structure'` with `scopeId = structure.id`

## Test Mock Example

From `packages/api/src/graphql/services/structure.service.test.ts`:

```typescript
const mockStructure = {
  id: 'structure-1',
  settlementId: 'settlement-1',
  type: 'temple',
  name: 'Temple of Gondor',
  level: 2,
  version: 1,
  variables: {},
  variableSchemas: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  archivedAt: null,
};
```

## Best Practices for Seed Data

1. **Varied Types**: Use diverse structure types across settlements
2. **Matching Levels**: Structure levels should complement settlement size/level
3. **Descriptive Names**: Use clear, thematic names (e.g., "Temple of Gozreh" not "Temple1")
4. **Minimal Variables for Seed**: Most seed structures can use empty `variables: {}` and `variableSchemas: []`
5. **Type Field**: Never leave type empty - it's used for filtering and understanding structure purpose
6. **Settlement Connection**: Ensure all structures reference valid settlement IDs

## Creating Multiple Structures per Settlement (recommended for seed)

For a settlement like Magnimar (level 4), typical structures might include:

- 1-2 temples (religious)
- 1 barracks (military)
- 1-2 markets (commerce)
- 1 library (knowledge)
- 1 tower/fortress (defense)
- 1 guild hall (commerce/crafts)

Total: ~7-9 structures per major settlement
Total: ~3-5 structures per minor settlement

For 8 settlements with total 20+ structures:

- Large settlements (3-4): 3-4 structures each
- Medium settlements (2-3): 2-3 structures each
- Small settlements (2-3): 1-2 structures each

## SQL Indexes

```sql
CREATE INDEX "Structure_settlementId_idx" ON "Structure"("settlementId");
CREATE INDEX "Structure_type_idx" ON "Structure"("type");
CREATE INDEX "Structure_deletedAt_idx" ON "Structure"("deletedAt");
CREATE INDEX "Structure_archivedAt_idx" ON "Structure"("archivedAt");
```

## Important Notes

1. **No Cascade Delete**: Structures are NOT deleted when settlement is deleted (can create orphaned records)
2. **Level Default**: Always defaults to 1 if not specified
3. **Type is Required**: Structure type is a discriminator for understanding what the building is
4. **JSON Storage**: Both `variables` and `variableSchemas` are JSON - flexible but unvalidated at DB level
5. **Soft Delete Pattern**: Uses `deletedAt` for soft deletes, can be queried with `where: { deletedAt: null }`
6. **Version Field**: For optimistic locking - incremented on each update
