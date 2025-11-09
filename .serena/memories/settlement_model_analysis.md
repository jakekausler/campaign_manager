# Settlement Model Analysis - Typed Variable Schemas

## Settlement Model Definition

**File**: `/storage/programs/campaign_manager/packages/api/prisma/schema.prisma` (lines 295-319)

```prisma
model Settlement {
  id              String    @id @default(cuid())
  kingdomId       String
  kingdom         Kingdom   @relation(fields: [kingdomId], references: [id])
  locationId      String    @unique
  location        Location  @relation(fields: [locationId], references: [id])
  name            String
  level           Int       @default(1)
  variables       Json      @default("{}") // Typed variables
  variableSchemas Json      @default("[]") // Array of VariableSchema definitions
  version         Int       @default(1) // For optimistic locking
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?
  archivedAt      DateTime?

  // Relations
  structures Structure[]
  stateVars  StateVariable[]

  @@index([kingdomId])
  @@index([locationId])
  @@index([deletedAt])
  @@index([archivedAt])
}
```

## Key Fields

### variables

- **Type**: `Json` (stored as JSON in database)
- **Default**: `{}` (empty object)
- **Purpose**: Stores the actual variable values at runtime
- **Format**: `Record<string, unknown>` (TypeScript) - key-value pairs where keys match schema names

### variableSchemas

- **Type**: `Json` (stored as JSON array in database)
- **Default**: `[]` (empty array)
- **Purpose**: Defines the structure/schema for typed variables
- **Format**: Array of `VariableSchema` objects
- **Note**: Validated against `Prisma.JsonValue` type at runtime

## VariableSchema Interface

**File**: `/storage/programs/campaign_manager/packages/api/src/graphql/types/variable-schema.types.ts`

```typescript
export type VariableType = 'string' | 'number' | 'boolean' | 'enum';

export interface VariableSchema {
  name: string; // Variable name (must be unique within schemas)
  type: VariableType; // Data type: string | number | boolean | enum
  enumValues?: string[]; // For enum type: array of allowed values
  defaultValue?: unknown; // Default value for the variable
  description?: string; // Human-readable description
}
```

## Supported Variable Types

1. **string**: Text values

   ```json
   { "name": "name", "type": "string", "description": "Settlement name" }
   ```

2. **number**: Numeric values (integers, floats)

   ```json
   {
     "name": "population",
     "type": "number",
     "description": "Settlement population",
     "defaultValue": 0
   }
   ```

3. **boolean**: True/false values

   ```json
   {
     "name": "hasMarket",
     "type": "boolean",
     "description": "Has marketplace",
     "defaultValue": false
   }
   ```

4. **enum**: Restricted set of string values
   ```json
   {
     "name": "government",
     "type": "enum",
     "enumValues": ["monarchy", "democracy", "theocracy", "oligarchy"],
     "description": "Type of government",
     "defaultValue": "monarchy"
   }
   ```

## JSON Format Examples for Prisma Create

### Example 1: Simple Settlement with Variables

```typescript
const settlement = await prisma.settlement.create({
  data: {
    kingdomId: 'kingdom-1',
    locationId: 'location-1',
    name: 'Minas Tirith',
    level: 5,
    variables: {
      population: 50000,
      government: 'monarchy',
      hasMarket: true,
      ruler: 'King Aragorn',
    },
    variableSchemas: [
      {
        name: 'population',
        type: 'number',
        description: 'Total population of the settlement',
        defaultValue: 0,
      },
      {
        name: 'government',
        type: 'enum',
        enumValues: ['monarchy', 'democracy', 'theocracy', 'oligarchy'],
        description: 'Type of government',
        defaultValue: 'monarchy',
      },
      {
        name: 'hasMarket',
        type: 'boolean',
        description: 'Whether settlement has a marketplace',
        defaultValue: false,
      },
      {
        name: 'ruler',
        type: 'string',
        description: 'Name of the settlement ruler',
      },
    ],
  },
});
```

### Example 2: Empty Settlement (from seed pattern)

```typescript
const settlement = await prisma.settlement.create({
  data: {
    kingdomId: 'kingdom-1',
    locationId: 'location-1',
    name: 'Test Settlement',
    level: 1,
    variables: {},
    variableSchemas: [],
  },
});
```

## Relations

### Kingdom

- **Type**: Required relationship
- **Field**: `kingdomId` (foreign key)
- **Reverse**: `Kingdom.settlements`
- **Meaning**: Each settlement belongs to exactly one kingdom

### Location

- **Type**: Required relationship (one-to-one unique)
- **Field**: `locationId` (unique foreign key)
- **Reverse**: `Location.settlement`
- **Meaning**: Each location can have at most one settlement, each settlement has exactly one location

### Structure

- **Type**: One-to-many relationship
- **Reverse**: `Structure.settlement`
- **Meaning**: Settlements can have multiple structures (buildings, landmarks, etc.)

## Input Type for Creating Settlements

**File**: `/storage/programs/campaign_manager/packages/api/src/graphql/inputs/settlement.input.ts`

```typescript
@InputType()
export class CreateSettlementInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  kingdomId!: string;

  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  level?: number;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  variables?: Record<string, unknown>;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  variableSchemas?: unknown[];
}
```

## Validation Rules

The `VariableSchemaService` validates variables:

1. **String type**: Value must be `typeof value === 'string'`
2. **Number type**: Value must be `typeof value === 'number'` and not NaN
3. **Boolean type**: Value must be `typeof value === 'boolean'`
4. **Enum type**:
   - Must have `enumValues` defined
   - Value must be in the `enumValues` array
   - Value must be a string

## Best Practices for Variable Schema Definitions

1. **Name Convention**: Use camelCase for schema names (e.g., `population`, `hasMarket`, `rulerName`)

2. **Always Include Descriptions**: Makes it clear what each variable represents

   ```json
   { "name": "population", "type": "number", "description": "Total population" }
   ```

3. **Provide Default Values**: Helps with initialization

   ```json
   { "name": "hasMarket", "type": "boolean", "defaultValue": false }
   ```

4. **Use Enums for Controlled Options**: Prevents invalid values

   ```json
   {
     "name": "government",
     "type": "enum",
     "enumValues": ["monarchy", "democracy", "theocracy"],
     "defaultValue": "monarchy"
   }
   ```

5. **Match variables to variableSchemas**: Every value in `variables` should have a corresponding schema definition

6. **Order Schemas Logically**: Group related schemas together for readability

## Example from Seed Script

**File**: `/storage/programs/campaign_manager/packages/api/prisma/seed.ts` (lines 601-624)

Example showing Party creation with variable schemas (settlement follows same pattern):

```typescript
const party = await prisma.party.create({
  data: {
    campaignId: campaign.id,
    name: 'The Heroes of Sandpoint',
    averageLevel: 1,
    variables: {
      gold: 100,
      reputation: 'neutral',
    },
    variableSchemas: [
      {
        name: 'gold',
        type: 'number',
        description: 'Party gold in pieces',
      },
      {
        name: 'reputation',
        type: 'string',
        description: 'Party reputation in the region',
      },
    ],
  },
});
```

## Type Casting Notes

When working with Prisma's JSON type, you may need to cast:

```typescript
// In service layer
variableSchemas: (input.variableSchemas ?? []) as Prisma.InputJsonValue,

// In type definitions
variableSchemas: [schema] as unknown as Prisma.JsonValue,
```

## Important Notes

1. **Settlement MUST have Location**: The `locationId` is unique and required - each settlement maps to exactly one location
2. **Variables are Runtime Values**: The `variables` field stores the actual values of defined schema properties
3. **Schemas are Definitions**: The `variableSchemas` field is metadata that defines what variables CAN exist
4. **JSON Storage**: Both fields are stored as JSON in PostgreSQL for flexibility
5. **No Validation in Schema**: Prisma doesn't enforce the validation - it's done in the application layer via `VariableSchemaService`
6. **Circular Dependency**: Settlement resolver has known circular dependency issues with certain test configurations
