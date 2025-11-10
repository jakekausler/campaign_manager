# Settlement & Structure Hierarchical System - Comprehensive Deep-Dive

## Overview

The Campaign Manager implements a sophisticated hierarchical system for managing settlements and structures within a world. The system is built on three layers:

1. **Data Model Layer**: Prisma schema defining relationships
2. **Business Logic Layer**: Services handling CRUD and domain operations
3. **API Layer**: GraphQL resolvers exposing data with computed fields

This document provides a complete analysis of the hierarchical design, typed variable system, level progression, implementation details, and architectural decisions.

---

## 1. HIERARCHICAL DESIGN

### 1.1 Hierarchy Overview

The system uses a **3-level hierarchy**:

```
World
  └── Campaign
      └── Kingdom
          └── Settlement
              └── Structure
```

**Key Relationships**:

- **Kingdom → Settlement**: One-to-Many (A kingdom has multiple settlements)
  - Field: `Settlement.kingdomId` (foreign key to `Kingdom.id`)
  - Reverse: `Kingdom.settlements[]`
- **Settlement → Location**: One-to-One (Each settlement maps to exactly one location)
  - Field: `Settlement.locationId` (unique foreign key to `Location.id`)
  - Reverse: `Location.settlement?` (optional, since locations can exist without settlements)
- **Settlement → Structure**: One-to-Many (A settlement has multiple structures)
  - Field: `Structure.settlementId` (foreign key to `Settlement.id`)
  - Reverse: `Settlement.structures[]`

### 1.2 Location Hierarchy (Geographic)

**Separate hierarchical system** for locations (different from Settlement/Structure):

- **Location → Location**: Self-referential One-to-Many (Parent-child location hierarchy)
  - Field: `Location.parentLocationId` (self-referential foreign key)
  - Relations: `parent` (Location?) and `children` (Location[])
  - Used for: Regions → Sub-regions → Point locations

**Example**:

```
Varisia (Region - Level 0)
  ├── Sandpoint (Point Location)
  ├── Magnimar (Point Location)
  └── Whistledown (Point Location)

Cheliax (Region - Level 0)
  ├── Westcrown (Point Location)
  └── Egorian (Point Location)
```

**Important**: Settlement-Location mapping is **one-to-one**. When creating a settlement, a location must already exist.

### 1.3 Nested Settlements Capability

**Design Note**: While the current schema supports only 2 levels (Kingdom → Settlement), the architecture is **prepared for nested settlements**:

- Settlement model has no parent settlement field currently
- Could be extended with `parentSettlementId` to support districts/neighborhoods within settlements
- Would follow same pattern as Location hierarchies
- Typed variables would allow per-level customization

**Seed Data Example** (9 settlements across 3 kingdoms):

```
Kingdom: Varisia (level varies)
  ├── Sandpoint (level 1, population 1500)
  ├── Whistledown (level 2, population 3200)
  ├── Magnimar (level 4, population 16000)
  └── Korvosa (level 5, population 18000)

Kingdom: Cheliax (level varies)
  ├── Westcrown (level 4, population 35000)
  ├── Egorian (level 5, population 55000)
  └── Corentyn (level 3, population 12000)

Kingdom: Osirion (level varies)
  ├── Sothis (level 5, population 48000)
  └── Wati (level 4, population 25000)
```

### 1.4 Structure Hierarchy Within Settlements

Each settlement contains multiple structures with types:

**Common Structure Types** (8 primary types from UI):

1. **temple** - Religious building (Church icon)
2. **barracks** - Military headquarters (Swords icon)
3. **market** - Marketplace/bazaar (Store icon)
4. **library** - Knowledge/information center (BookOpen icon)
5. **forge** - Craftsperson workshop (Hammer icon)
6. **tavern** - Lodging/tavern (Beer icon)
7. **fortress** - Defensive structure (Castle icon)
8. **citadel** - Major fortification (Building2 icon)

**Other types supported**:

- workshop, guild_hall, university, courthouse, watchtower, granary, bridge, gate, dock, mine, farm

**Seed Data Example** (Multiple structures per settlement):

```
Sandpoint (level 1, 2 structures)
  ├── Cathedral of Desna (temple, level 1)
  └── The Rusty Dragon (inn, level 1)

Whistledown (level 2, 2 structures)
  ├── Cogwhisper Inventors Guild (workshop, level 2)
  └── Tinker's Bazaar (market, level 2)

Magnimar (level 4, 3 structures)
  ├── The Bazaar of Sails (market, level 4)
  ├── The Founder's Archive (library, level 3)
  └── Seafarers Guild Hall (guild_hall, level 4)

Korvosa (level 5, 4+ structures)
  ├── Citadel Volshyenek (barracks, level 5)
  └── [additional structures...]
```

### 1.5 Key Design Decisions

**Why separate Kingdom/Settlement/Structure instead of generic hierarchy?**

1. **Type Safety**: Each level has specific behaviors and relationships
2. **Query Performance**: Can efficiently query by specific types
3. **Domain Clarity**: Reflects real-world political structures
4. **Semantic Meaning**: Settlement has unique Location relationship

**Why one-to-one Settlement-Location?**

1. **Spatial Grounding**: Every settlement needs exact coordinates
2. **Prevents Ambiguity**: One location can't host multiple settlements
3. **Geographic Integrity**: Maintains PostGIS spatial accuracy
4. **Location as Anchor**: Locations pre-exist, settlements are placed on them

**Why not nested settlements yet?**

1. **Complexity**: Would require migration and recursive queries
2. **Current Use Case**: Flat settlement list sufficient for current needs
3. **Extensibility**: Schema prepared if needed in future
4. **Performance**: Simpler hierarchy = faster queries

---

## 2. TYPED VARIABLE SYSTEM

### 2.1 System Overview

The typed variable system provides **flexible, runtime-customizable data fields** for entities. Instead of fixed database columns, entities can define arbitrary variables with validation.

**Two complementary JSON fields**:

1. **`variableSchemas`** (Metadata): Array of schema definitions defining what variables CAN exist
2. **`variables`** (Runtime): Object storing actual variable values

**Implemented on**:

- Kingdom
- Settlement
- Structure
- Character
- Party

### 2.2 Variable Schema Definition

**Interface** (`packages/api/src/graphql/types/variable-schema.types.ts`):

```typescript
export type VariableType = 'string' | 'number' | 'boolean' | 'enum';

export interface VariableSchema {
  name: string; // Variable name (unique within schemas)
  type: VariableType; // Data type
  enumValues?: string[]; // For enum type: allowed values
  defaultValue?: unknown; // Default value
  description?: string; // Human-readable description
}
```

### 2.3 Supported Variable Types

#### Type 1: String

Used for text values (names, descriptions, specializations).

```json
{
  "name": "primaryIndustry",
  "type": "string",
  "description": "Primary economic industry",
  "defaultValue": "agriculture"
}
```

**Seed Example** (Settlement):

```json
{
  "ruler": "King Aragorn",
  "primaryIndustry": "fishing"
}
```

#### Type 2: Number

Used for numeric values (population, counts, ratings).

```json
{
  "name": "population",
  "type": "number",
  "description": "Settlement population",
  "defaultValue": 0
}
```

**Validation**: Must be valid JavaScript number (no NaN)

**Seed Examples**:

```json
{
  "population": 1500,
  "defenseRating": 8,
  "militiaSize": 50
}
```

#### Type 3: Boolean

Used for true/false flags.

```json
{
  "name": "hasWalls",
  "type": "boolean",
  "description": "Whether settlement has defensive walls",
  "defaultValue": false
}
```

**Seed Examples**:

```json
{
  "hasWalls": false,
  "isActive": true,
  "hasExoticGoods": true
}
```

#### Type 4: Enum

Used for restricted sets of allowed values.

```json
{
  "name": "primaryIndustry",
  "type": "enum",
  "enumValues": ["agriculture", "fishing", "mining", "trade", "crafts", "magic"],
  "description": "Primary economic industry",
  "defaultValue": "agriculture"
}
```

**Validation Rules**:

- Must be in `enumValues` array
- Value must be string type
- Case-sensitive matching

**Seed Examples**:

```json
{
  "primaryIndustry": "fishing",
  "government": "monarchy",
  "marketSize": "large"
}
```

### 2.4 Validation Implementation

**Prisma doesn't enforce validation**. Application layer validates via `VariableSchemaService`:

```typescript
// Validation logic (conceptual)
function validateVariable(variable: unknown, schema: VariableSchema): boolean {
  switch (schema.type) {
    case 'string':
      return typeof variable === 'string';
    case 'number':
      return typeof variable === 'number' && !isNaN(variable);
    case 'boolean':
      return typeof variable === 'boolean';
    case 'enum':
      return typeof variable === 'string' && schema.enumValues!.includes(variable);
  }
}
```

### 2.5 Settlement Variable Schema Example

**Full example from seed data**:

```typescript
await prisma.settlement.create({
  data: {
    kingdomId: 'kingdom-1',
    locationId: 'location-1',
    name: 'Sandpoint',
    level: 1,
    variables: {
      population: 1500,
      defenseRating: 8,
      hasWalls: false,
      primaryIndustry: 'fishing',
      marketSize: 'small',
      militiaSize: 50,
    },
    variableSchemas: [
      {
        name: 'population',
        type: 'number',
        description: 'Settlement population',
        defaultValue: 0,
      },
      {
        name: 'defenseRating',
        type: 'number',
        description: 'Defense rating (1-20)',
        defaultValue: 5,
      },
      {
        name: 'hasWalls',
        type: 'boolean',
        description: 'Whether settlement has defensive walls',
        defaultValue: false,
      },
      {
        name: 'primaryIndustry',
        type: 'enum',
        enumValues: ['agriculture', 'fishing', 'mining', 'trade', 'crafts', 'magic'],
        description: 'Primary economic industry',
        defaultValue: 'agriculture',
      },
      {
        name: 'marketSize',
        type: 'enum',
        enumValues: ['small', 'medium', 'large', 'metropolis'],
        description: 'Size of the marketplace',
        defaultValue: 'small',
      },
      {
        name: 'militiaSize',
        type: 'number',
        description: 'Size of the local militia/guard',
        defaultValue: 0,
      },
    ],
  },
});
```

### 2.6 Structure Variable Schema Example

**Temple structure**:

```typescript
await prisma.structure.create({
  data: {
    settlementId: 'settlement-1',
    type: 'temple',
    name: 'Cathedral of Desna',
    level: 1,
    variables: {
      deity: 'Desna',
      clergy: 3,
      isActive: true,
    },
    variableSchemas: [
      {
        name: 'deity',
        type: 'string',
        description: 'Primary deity worshipped',
      },
      {
        name: 'clergy',
        type: 'number',
        description: 'Number of clergy members',
        defaultValue: 1,
      },
      {
        name: 'isActive',
        type: 'boolean',
        description: 'Whether temple is actively conducting services',
        defaultValue: true,
      },
    ],
  },
});
```

**Barracks structure**:

```typescript
await prisma.structure.create({
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

### 2.7 Integration with Conditions (JSONLogic)

Variables are **referenced in conditions** via JSONLogic expressions:

```javascript
// Example condition that evaluates against settlement variables
{
  "and": [
    { ">": [{ "var": "population" }, 5000] },      // population > 5000
    { "==": [{ "var": "hasWalls" }, true] },       // hasWalls = true
    { "in": [{ "var": "primaryIndustry" }, ["trade", "crafts"]] }  // industry is trade or crafts
  ]
}
```

When evaluated:

- `{ "var": "population" }` resolves to the actual value from `variables.population`
- Rules engine evaluates the expression against current state
- Result feeds into effects or computedFields

### 2.8 Integration with Effects (JSON Patch)

Effects can **modify variables** using JSON Patch operations:

```json
{
  "effectType": "modify_variable",
  "payload": {
    "scope": "settlement",
    "scopeId": "settlement-123",
    "patches": [
      { "op": "replace", "path": "/variables/population", "value": 2000 },
      { "op": "replace", "path": "/variables/hasWalls", "value": true }
    ]
  }
}
```

When executed, patches are applied to the target settlement's `variables` field.

### 2.9 Computed Fields

**StateVariable model** creates derived variables using `formula` field:

```typescript
{
  scope: 'settlement',
  scopeId: 'settlement-1',
  key: 'is_trade_hub',
  type: 'derived',
  formula: {
    "and": [
      { ">=": [{ "var": "settlement.population" }, 5000] },
      { "==": [{ "var": "settlement.primaryIndustry" }, "trade"] }
    ]
  },
  description: 'True if settlement is a major trade hub'
}
```

When queried, the `computedFields` field on Settlement/Structure includes evaluated results.

### 2.10 Best Practices

1. **Always include descriptions**: Clarifies purpose and usage
2. **Provide default values**: Helps with initialization
3. **Use enums for controlled options**: Prevents invalid values
4. **Name with camelCase**: Consistent with JavaScript conventions
5. **Match variables to schemas**: Every value in `variables` should have a schema definition
6. **Order schemas logically**: Group related schemas together

---

## 3. LEVEL PROGRESSION SYSTEM

### 3.1 Level Field Overview

Each entity has a `level` field representing its tier/importance/quality:

```typescript
level: Int @default(1)
```

**Applies to**:

- Kingdom
- Settlement
- Structure
- Character
- Party

**Range**: 1-20 (Convention, not enforced in schema)

### 3.2 Level Meaning by Entity

#### Kingdom Level

Represents the kingdom's power and development.

- **Level 1**: Emerging kingdom with minimal infrastructure
- **Level 3**: Established kingdom with multiple settlements
- **Level 5**: Major power with diverse economy and strong military
- **Level 10+**: Ancient, powerful kingdom with significant magical/political influence

#### Settlement Level

Represents settlement size, complexity, and importance.

**Correlation to population**:

- **Level 1**: Small village (population < 2000)
- **Level 2**: Large town (population 2000-5000)
- **Level 3**: Small city (population 5000-15000)
- **Level 4**: City (population 15000-40000)
- **Level 5**: Metropolis (population 40000+)

**Seed Data Examples**:

```
Sandpoint:      level 1 (population 1500)
Whistledown:    level 2 (population 3200)
Magnimar:       level 4 (population 16000)
Korvosa:        level 5 (population 18000)
Westcrown:      level 4 (population 35000)
Egorian:        level 5 (population 55000)
Sothis:         level 5 (population 48000)
```

#### Structure Level

Represents structure size, quality, and importance.

**Guidelines**:

- Typically ≤ parent settlement level
- Level 1-3: Small/basic structures
- Level 4-6: Medium structures
- Level 7-10: Large/significant structures
- Level 11-15: Major/important structures
- Level 16-20: Legendary/exceptional structures

**Seed Data Examples** (Magnimar, level 4):

```
The Bazaar of Sails:      level 4 (major market)
The Founder's Archive:    level 3 (large library)
Seafarers Guild Hall:     level 4 (major guild)
```

### 3.3 What Unlocks at Different Levels

**No hard constraints** in current implementation, but implications:

#### Variable Schemas Can Be Level-Dependent

While not implemented yet, the architecture supports this:

```typescript
// Hypothetical future feature
{
  name: "magicalAffinity",
  type: "number",
  minLevel: 5,  // Only available at settlement level 5+
  description: "Settlement's connection to magical forces"
}
```

#### Character/Party Capabilities

- **Level 1 characters**: Apprentices, commoners
- **Level 5 characters**: Experienced adventurers
- **Level 10+ characters**: Masters of their craft, legendary heroes

#### Derived Variables

Computed fields can trigger based on level thresholds:

```javascript
{
  "if": [
    { ">=": [{ "var": "settlement.level" }, 3] },
    { "var": "settlement.hasUniversity" },  // Can have university at level 3+
    false
  ]
}
```

#### Structure Availability

Could implement restrictions (not currently enforced):

- Fortress: Settlement level 4+
- Citadel: Settlement level 5+
- University: Settlement level 3+

### 3.4 Level Changes

**Service Methods**:

```typescript
// Settlement Service
setLevel(id: string, newLevel: number, expectedVersion?: number): Promise<Settlement>

// Structure Service
setLevel(id: string, newLevel: number, expectedVersion?: number): Promise<Structure>
```

**Includes**:

- Optimistic locking via `expectedVersion` parameter
- Version increment on successful change
- Audit logging of change

**Front-end Integration** (from `settlement-structure-hierarchy-ui.md`):

- Level control with increment/decrement buttons
- Confirmation dialog before changes
- Rules engine impact warnings (computed fields, conditions, effects, child structures)
- Optimistic locking via `expectedVersion`
- Toast notifications (success/error)
- Rollback on error

**Example Flow**:

```typescript
// User clicks "Level Up" button
// 1. Show confirmation dialog
// 2. Display impact warnings:
//    - Recompute dependent fields
//    - Recalculate conditions
//    - Re-execute effects
//    - Revalidate child structures
// 3. On confirmation:
//    - Send mutation with expectedVersion
//    - Optimistic update UI
// 4. On success:
//    - Show success toast
//    - Refetch dependent data
// 5. On error:
//    - Show error toast
//    - Rollback to previous level
```

### 3.5 Side Effects of Level Changes

**Current Implementation**:

1. **Version increment**: `version` field incremented
2. **Audit trail**: Change logged by AuditLog system
3. **Cache invalidation**: Apollo Client cache updated
4. **WebSocket broadcast**: Real-time updates to connected clients

**Future Possibilities**:

1. **Unlock capabilities**: New structures/features at higher levels
2. **Trigger effects**: Rules engine executes on level-up
3. **Cascade to children**: Validate child structures still valid
4. **Recalculate derived fields**: StateVariables with formulas recalculated

---

## 4. IMPLEMENTATION DETAILS

### 4.1 Data Model (Prisma Schema)

**Settlement Model** (`packages/api/prisma/schema.prisma`, lines 295-319):

```prisma
model Settlement {
  id              String    @id @default(cuid())
  kingdomId       String
  kingdom         Kingdom   @relation(fields: [kingdomId], references: [id])
  locationId      String    @unique
  location        Location  @relation(fields: [locationId], references: [id])
  name            String
  level           Int       @default(1)
  variables       Json      @default("{}")
  variableSchemas Json      @default("[]")
  version         Int       @default(1)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?
  archivedAt      DateTime?

  structures Structure[]
  stateVars  StateVariable[]

  @@index([kingdomId])
  @@index([locationId])
  @@index([deletedAt])
  @@index([archivedAt])
}
```

**Structure Model** (`packages/api/prisma/schema.prisma`, lines 321-343):

```prisma
model Structure {
  id              String     @id @default(cuid())
  settlementId    String
  settlement      Settlement @relation(fields: [settlementId], references: [id])
  type            String
  name            String
  level           Int        @default(1)
  variables       Json       @default("{}")
  variableSchemas Json       @default("[]")
  version         Int        @default(1)
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  deletedAt       DateTime?
  archivedAt      DateTime?

  stateVars StateVariable[]

  @@index([settlementId])
  @@index([type])
  @@index([deletedAt])
  @@index([archivedAt])
}
```

**StateVariable Model** (for derived fields):

```prisma
model StateVariable {
  id          String    @id @default(cuid())
  scope       String    // Enum: settlement/structure/...
  scopeId     String?   // ID of the entity
  key         String    // Variable name
  value       Json?     // Nullable for derived
  type        String    // string/integer/float/boolean/json/derived
  formula     Json?     // JSONLogic expression for derived
  description String?
  isActive    Boolean   @default(true)

  settlement Settlement? @relation(fields: [scopeId], references: [id])
  structure  Structure?  @relation(fields: [scopeId], references: [id])
  // ... other polymorphic relations

  @@unique([scope, scopeId, key, deletedAt])
  @@index([scope, scopeId, key])
}
```

**Condition Model** (for JSONLogic rules):

```prisma
model Condition {
  id          String  @id @default(cuid())
  name        String
  description String?
  expression  Json    // JSONLogic expression
  entityType  String  // encounter/event
  entityId    String  // Polymorphic reference
  isActive    Boolean @default(true)

  @@index([entityType, entityId])
}
```

**Effect Model** (for state mutations):

```prisma
model Effect {
  id          String       @id @default(cuid())
  name        String
  description String?
  effectType  String       // modify_variable/trigger_event/create_entity
  payload     Json         // Effect-specific data
  entityType  String
  entityId    String
  timing      EffectTiming // PRE/ON_RESOLVE/POST
  priority    Int          @default(0)
  isActive    Boolean      @default(true)

  @@index([entityType, entityId, timing])
}
```

### 4.2 Service Layer

**SettlementService** (`packages/api/src/graphql/services/settlement.service.ts`):

Key Methods:

```typescript
class SettlementService {
  // CRUD Operations
  async create(input: CreateSettlementInput): Promise<Settlement>;
  async update(id: string, input: UpdateSettlementInput): Promise<Settlement>;
  async findById(id: string): Promise<Settlement | null>;
  async findByKingdom(kingdomId: string): Promise<Settlement[]>;
  async delete(id: string): Promise<Settlement>;

  // Level Management
  async setLevel(id: string, newLevel: number, expectedVersion?: number): Promise<Settlement>;

  // Computed Fields
  async getComputedFields(settlement: Settlement): Promise<Record<string, unknown>>;

  // Archive/Restore
  async archive(id: string): Promise<Settlement>;
  async restore(id: string): Promise<Settlement>;
}
```

**StructureService** (`packages/api/src/graphql/services/structure.service.ts`):

Key Methods:

```typescript
class StructureService {
  // CRUD Operations
  async create(input: CreateStructureInput): Promise<Structure>;
  async update(id: string, input: UpdateStructureInput): Promise<Structure>;
  async findById(id: string): Promise<Structure | null>;
  async findBySettlement(settlementId: string): Promise<Structure[]>;
  async findBySettlements(settlementIds: string[]): Promise<Structure[]>;
  async delete(id: string): Promise<Structure>;

  // Level Management
  async setLevel(id: string, newLevel: number, expectedVersion?: number): Promise<Structure>;

  // Computed Fields
  async getComputedFields(structure: Structure): Promise<Record<string, unknown>>;

  // Archive/Restore
  async archive(id: string): Promise<Structure>;
  async restore(id: string): Promise<Structure>;
}
```

### 4.3 GraphQL Resolvers

**SettlementResolver** (`packages/api/src/graphql/resolvers/settlement.resolver.ts`):

```typescript
@Resolver(() => Settlement)
export class SettlementResolver {
  @Query(() => Settlement, { nullable: true })
  async settlement(@Args('id', { type: () => ID }) id: string): Promise<Settlement | null> {
    return this.settlementService.findById(id);
  }

  @Query(() => [Settlement])
  async settlementsByKingdom(
    @Args('kingdomId', { type: () => ID }) kingdomId: string
  ): Promise<Settlement[]> {
    return this.settlementService.findByKingdom(kingdomId);
  }

  @Mutation(() => Settlement)
  async createSettlement(@Args('input') input: CreateSettlementInput): Promise<Settlement> {
    return this.settlementService.create(input);
  }

  @Mutation(() => Settlement)
  async updateSettlement(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSettlementInput
  ): Promise<Settlement> {
    return this.settlementService.update(id, input);
  }

  @Mutation(() => Settlement)
  async setSettlementLevel(
    @Args('id', { type: () => ID }) id: string,
    @Args('level') level: number,
    @Args('expectedVersion', { type: () => Int, nullable: true }) expectedVersion?: number
  ): Promise<Settlement> {
    return this.settlementService.setLevel(id, level, expectedVersion);
  }

  @Field(() => [Structure])
  async structures(@Parent() settlement: Settlement): Promise<Structure[]> {
    return this.structureService.findBySettlement(settlement.id);
  }

  @Field(() => GraphQLJSON, { nullable: true })
  async computedFields(@Parent() settlement: Settlement): Promise<Record<string, unknown>> {
    return this.settlementService.getComputedFields(settlement);
  }
}
```

**StructureResolver** (similar pattern):

```typescript
@Resolver(() => Structure)
export class StructureResolver {
  @Query(() => Structure, { nullable: true })
  async structure(@Args('id', { type: () => ID }) id: string): Promise<Structure | null> {
    return this.structureService.findById(id);
  }

  @Mutation(() => Structure)
  async createStructure(@Args('input') input: CreateStructureInput): Promise<Structure> {
    return this.structureService.create(input);
  }

  // ... other mutations and field resolvers
}
```

### 4.4 GraphQL Types

**Settlement GraphQL Type** (`packages/api/src/graphql/types/settlement.type.ts`):

```typescript
@ObjectType()
export class Settlement {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  kingdomId!: string;

  @Field(() => ID)
  locationId!: string;

  @Field(() => Location)
  location!: Location;

  @Field()
  name!: string;

  @Field(() => Int)
  level!: number;

  @Field(() => GraphQLJSON)
  variables!: Record<string, unknown>;

  @Field(() => [VariableSchemaType])
  variableSchemas!: VariableSchemaType[];

  @Field(() => Int)
  version!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null;

  @Field(() => Date, { nullable: true })
  archivedAt?: Date | null;

  @Field(() => GraphQLJSON, { nullable: true })
  computedFields?: Record<string, unknown>;
}
```

**VariableSchemaType**:

```typescript
@ObjectType()
export class VariableSchemaType {
  @Field()
  name!: string;

  @Field()
  type!: VariableType; // 'string' | 'number' | 'boolean' | 'enum'

  @Field(() => [String], { nullable: true })
  enumValues?: string[];

  @Field(() => GraphQLJSON, { nullable: true })
  defaultValue?: unknown;

  @Field({ nullable: true })
  description?: string;
}
```

### 4.5 Hierarchy Query Examples

**Query: Get Settlement with all structures**

```graphql
query GetSettlementWithStructures($settlementId: ID!) {
  settlement(id: $settlementId) {
    id
    name
    level
    variables
    variableSchemas
    structures {
      id
      name
      type
      level
      variables
      variableSchemas
      computedFields
    }
    computedFields
  }
}
```

**Query: Get Kingdom with all settlements and structures**

```graphql
query GetKingdomHierarchy($kingdomId: ID!) {
  kingdom(id: $kingdomId) {
    id
    name
    level
    settlements {
      id
      name
      level
      variables
      structures {
        id
        name
        type
        level
        variables
      }
    }
  }
}
```

**Mutation: Create settlement with variables**

```graphql
mutation CreateSettlement($input: CreateSettlementInput!) {
  createSettlement(input: $input) {
    id
    name
    variables
    variableSchemas
  }
}
```

Input:

```typescript
{
  kingdomId: "kingdom-1",
  locationId: "location-1",
  name: "New City",
  level: 3,
  variables: {
    population: 10000,
    hasWalls: true,
    primaryIndustry: "trade"
  },
  variableSchemas: [
    {
      name: "population",
      type: "number",
      defaultValue: 0,
      description: "Settlement population"
    },
    // ... more schemas
  ]
}
```

### 4.6 Cache Invalidation Strategy

**Apollo Client Cache Patterns**:

- **cache-first** for details (settlement, structure, location, kingdom)
- **cache-and-network** for lists (settlements, structures)
- Cache eviction on delete with `gc()`
- Refetch queries after mutations
- Optimistic updates for level changes

**Specific Strategies**:

1. **After Structure Creation**:
   - Refetch structures list for parent settlement
   - Update settlement structures array in cache
2. **After Structure Deletion**:
   - Evict structure from cache
   - Run `gc()` to clean orphaned entries
   - Refetch structures list
3. **After Settlement Level Change**:
   - Optimistic update of `level` field
   - Refetch computed fields
   - Recompute conditions/effects

### 4.7 Validation Implementation

**Variable Schema Validation** (during create/update):

```typescript
async validateVariableSchemas(
  schemas: VariableSchema[],
  variables: Record<string, unknown>,
): Promise<void> {
  for (const schema of schemas) {
    const value = variables[schema.name];

    if (value === undefined && !schema.defaultValue) {
      throw new ValidationException(`Missing required variable: ${schema.name}`);
    }

    const valueToValidate = value ?? schema.defaultValue;

    switch (schema.type) {
      case 'string':
        if (typeof valueToValidate !== 'string') {
          throw new ValidationException(`${schema.name} must be a string`);
        }
        break;
      case 'number':
        if (typeof valueToValidate !== 'number' || isNaN(valueToValidate)) {
          throw new ValidationException(`${schema.name} must be a valid number`);
        }
        break;
      case 'boolean':
        if (typeof valueToValidate !== 'boolean') {
          throw new ValidationException(`${schema.name} must be a boolean`);
        }
        break;
      case 'enum':
        if (!schema.enumValues!.includes(valueToValidate as string)) {
          throw new ValidationException(
            `${schema.name} must be one of: ${schema.enumValues!.join(', ')}`
          );
        }
        break;
    }
  }
}
```

---

## 5. INTEGRATION WITH OTHER SYSTEMS

### 5.1 Integration with Conditions (JSONLogic)

**Conditions** reference settlement/structure variables:

```javascript
// Condition for "Settlement is a major trade hub"
{
  "and": [
    { ">=": [{ "var": "population" }, 5000] },
    { "==": [{ "var": "primaryIndustry" }, "trade"] }
  ]
}
```

**Variables are resolved** from the entity context when condition is evaluated.

### 5.2 Integration with Effects (JSON Patch)

**Effects** can modify variables using JSON Patch:

```json
{
  "effectType": "modify_variable",
  "payload": {
    "scope": "settlement",
    "scopeId": "settlement-123",
    "patches": [{ "op": "replace", "path": "/variables/population", "value": 2000 }]
  }
}
```

### 5.3 Integration with Dependency Graph

**Dependency System** tracks:

- StateVariable → Condition
- StateVariable → Effect
- StateVariable → Entity

When a variable changes, dependent conditions/effects are re-evaluated.

### 5.4 Integration with Rules Engine

**Rules Engine Worker** (`@campaign/rules-engine`):

- Evaluates conditions against current state
- Executes effects that match conditions
- Uses settlement/structure variables as context
- Can modify variables via effects

### 5.5 Integration with Scheduler

**Scheduler Service** (`@campaign/scheduler`):

- Can trigger events at specific times
- Events can depend on settlement/structure state
- Effects executed on settlements/structures

### 5.6 Integration with Front-end UI

**Settlement & Structure Hierarchical UI** (`TICKET-036`):

Features from `settlement-structure-hierarchy-ui.md`:

1. **Settlement Hierarchy Panel**: Recursive tree view
2. **Structure List View**: Virtual-scrolled list per settlement
3. **Typed Variable Editor**: Dynamic form for variables
4. **Level Control**: Increment/decrement with confirmation
5. **Cross-entity Navigation**: Settlement ↔ Structure ↔ Kingdom

---

## 6. DESIGN DECISIONS & RATIONALE

### 6.1 JSON Storage for Variables

**Decision**: Store typed variables as JSON instead of fixed database columns

**Rationale**:

1. **Flexibility**: New variable types can be added without migrations
2. **Type Safety**: TypeScript validation at application layer
3. **Extensibility**: Different entity types can have different variables
4. **Performance**: Single JSON column faster than multiple nullable columns
5. **Backward Compatibility**: Existing data unaffected by schema changes

**Trade-offs**:

- ❌ Can't use SQL WHERE clauses on variables (need application-layer filtering)
- ❌ No type checking at database level
- ❌ Larger row sizes for entities with many variables
- ✅ More flexible and maintainable long-term

### 6.2 One-to-One Settlement-Location Mapping

**Decision**: Each settlement maps to exactly one location

**Rationale**:

1. **Spatial Integrity**: Every settlement needs geographic coordinates
2. **Prevents Ambiguity**: Can't have multiple settlements at same location
3. **Unique Constraint**: `locationId` is unique on Settlement model
4. **Query Performance**: Fast location lookups via unique index

**Implications**:

- Locations pre-exist before settlements created
- Settlement is placed ON a location (not in a region)
- Can't move settlements (would require new location)

### 6.3 No Nested Settlements (Yet)

**Decision**: Support only 2 levels (Kingdom → Settlement) currently

**Rationale**:

1. **Current Use Case**: Flat settlement list sufficient for Golarion campaigns
2. **Complexity**: Nested settlements would require recursive queries
3. **Performance**: Simpler hierarchy = faster queries
4. **Extensibility**: Schema can be extended with `parentSettlementId` field later

**Future Extension** (if needed):

```prisma
model Settlement {
  // ... existing fields ...
  parentSettlementId String?
  parent Settlement? @relation("SettlementHierarchy", fields: [parentSettlementId], references: [id])
  children Settlement[] @relation("SettlementHierarchy")
}
```

### 6.4 Separate Hierarchy for Locations

**Decision**: Locations have separate self-referential hierarchy from Settlements

**Rationale**:

1. **Geographic Organization**: Regions → Sub-regions → Points
2. **Independent Concern**: Location hierarchy ≠ Political hierarchy
3. **Query Patterns**: Different queries for geographic vs political structures
4. **Spatial Data**: Locations have geometry (PostGIS), settlements don't

**Example**:

- Regions (location hierarchy): Varisia, Cheliax, Osirion
- Settlements (political hierarchy): Magnimar, Korvosa, Sandpoint
- Both use locations for geographic grounding

### 6.5 No FK Constraint for Conditions/Effects

**Decision**: Use polymorphic pattern without foreign key constraints

**Rationale**:

```prisma
model Condition {
  entityType String  // "encounter" | "event" (no enum)
  entityId   String  // Polymorphic reference (no FK)
}
```

1. **Flexibility**: One condition type for multiple entity types
2. **No Cycles**: Prevents circular FK constraints
3. **Application Responsibility**: App code enforces integrity

**Trade-off**: Database can't enforce referential integrity

### 6.6 Version Field for Optimistic Locking

**Decision**: Include `version` field on all entities

**Rationale**:

1. **Concurrent Edits**: Detect conflicts when same entity edited simultaneously
2. **Predictable Errors**: App can provide meaningful conflict messages
3. **Audit Trail**: Version track shows change history
4. **Rollback Safety**: Can detect unexpected changes

**Usage**:

```typescript
// Update only succeeds if version matches
await prisma.settlement.update({
  where: { id: 'settlement-1' },
  data: {
    level: 5,
    version: { increment: 1 }, // Increment version on success
  },
});
```

---

## 7. PERFORMANCE CONSIDERATIONS

### 7.1 Index Strategy

**Settlement indexes**:

- `kingdomId` - Query settlements by kingdom
- `locationId` - Unique lookup
- `deletedAt` - Soft delete queries
- `archivedAt` - Archive queries

**Structure indexes**:

- `settlementId` - Query structures by settlement
- `type` - Filter by structure type
- `deletedAt` - Soft delete queries
- `archivedAt` - Archive queries

### 7.2 Query Optimization

**Batch Loading**:

```typescript
// Bad: N+1 query problem
const settlements = await prisma.settlement.findMany({ where: { kingdomId } });
for (const settlement of settlements) {
  const structures = await prisma.structure.findMany({ where: { settlementId: settlement.id } });
}

// Good: Batch load
const settlements = await prisma.settlement.findMany({
  where: { kingdomId },
  include: { structures: true },
});
```

**Pagination**:

```typescript
// For large settlement lists
const settlements = await prisma.settlement.findMany({
  where: { kingdomId },
  skip: offset,
  take: limit,
  orderBy: { name: 'asc' },
});
```

### 7.3 Front-end Optimization

**Virtual Scrolling** (from settlement-structure-hierarchy-ui.md):

- Renders only visible items in lists
- Reduces DOM nodes from 200+ to ~8
- React-window FixedSizeList for performance

**Debounced Search**:

- 300ms delay on search input
- Prevents excessive filtering calculations

**Lazy Structure Loading**:

- Structure lists only render for expanded settlements
- Collapsible state managed per settlement

### 7.4 JSON Performance

**Variables field** (stored as JSON):

- ✅ Fast for small objects (< 1KB)
- ⚠️ Slower for large objects (> 100KB)
- Use case: Limited to ~10-30 variables per entity

---

## 8. SUMMARY & KEY TAKEAWAYS

### Hierarchy Structure

```
Kingdom
  └── Settlement (one-to-one with Location)
      └── Structure (multiple types)
```

### Typed Variables

- **Schema-based validation**: Define what variables CAN exist
- **Runtime storage**: Store actual values in `variables` field
- **4 types**: string, number, boolean, enum
- **Used by**: Conditions (JSONLogic), Effects (JSON Patch), Derived Fields

### Level Progression

- **1-20 scale**: Represents entity tier/importance
- **Population correlation**: Settlement level ~= population tier
- **Child constraints**: Child levels typically ≤ parent level
- **Triggers**: Level changes can trigger computed field recalculation

### Key Design Principles

1. **Flexibility**: JSON-based variables allow extensibility
2. **Separation of Concerns**: Geographic (Location) ≠ Political (Kingdom/Settlement) hierarchy
3. **Type Safety**: Application-layer validation despite JSON storage
4. **Performance**: Indexes on foreign keys and soft-delete fields
5. **Auditability**: Version field and audit logging on changes

### Integration Points

- **Conditions**: Reference variables via JSONLogic expressions
- **Effects**: Modify variables via JSON Patch operations
- **Derived Fields**: StateVariable formulas computed on query
- **Rules Engine**: Evaluates conditions and executes effects
- **Front-end**: Rich UI for hierarchy management and editing
