# Region Model Analysis

## Overview

In this codebase, **regions are NOT a separate model**. Instead, regions are represented as **Locations with type="region"** that have polygon geometry (PostGIS geometry).

## Location Model Definition

The Location model is used for BOTH point locations AND regions.

### Schema (from packages/api/prisma/schema.prisma)

```prisma
model Location {
  id               String                   @id @default(cuid())
  worldId          String
  world            World                    @relation(fields: [worldId], references: [id])
  type             String                   // "point" | "region"
  geom             Unsupported("geometry")? // PostGIS geometry (SRID 3857)
  name             String?
  description      String?
  parentLocationId String?
  parent           Location?                @relation("LocationHierarchy", fields: [parentLocationId], references: [id])
  children         Location[]               @relation("LocationHierarchy")
  version          Int                      @default(1)
  createdAt        DateTime                 @default(now())
  updatedAt        DateTime                 @updatedAt
  deletedAt        DateTime?
  archivedAt       DateTime?

  // Relations
  settlement Settlement?
  encounters Encounter[]
  events     Event[]
}
```

### Key Fields for Regions

| Field                                               | Type              | Purpose                                          |
| --------------------------------------------------- | ----------------- | ------------------------------------------------ |
| `id`                                                | CUID              | Unique identifier                                |
| `worldId`                                           | String            | Foreign key to World                             |
| `type`                                              | String            | Set to "region" for regions, "point" for points  |
| `geom`                                              | PostGIS geometry  | Polygon or Point (uses SRID 3857 - Web Mercator) |
| `name`                                              | String (nullable) | Region name (e.g., "Varisia", "Cheliax")         |
| `description`                                       | String (nullable) | Region description                               |
| `parentLocationId`                                  | String (nullable) | Hierarchical parent (for nested regions)         |
| `version`                                           | Int               | For optimistic locking                           |
| `createdAt`, `updatedAt`, `deletedAt`, `archivedAt` | DateTime          | Timestamps for versioning & soft delete          |

## Relationships

- **World**: Each Location belongs to one World
- **Hierarchy**: Locations can have parent locations (supports nested regions)
- **Settlement**: A Settlement optionally links to one Location (usually for settlement location)
- **Encounter/Event**: Multiple Encounters/Events can be linked to a Location

## Creating Regions - Technical Details

### GeoJSON Support

The codebase supports two GeoJSON types:

1. **Point**: `{ type: 'Point', coordinates: [lon, lat] }`
   - For point locations (cities, landmarks, dungeons)

2. **Polygon**: `{ type: 'Polygon', coordinates: [[[lon, lat], [lon, lat], ...]] }`
   - For regions with geographic boundaries
   - Supports outer ring and holes (islands, enclaves)

### PostGIS Conversion

The `spatial.helpers.ts` file provides utilities:

- `geoJsonToWKT()` - Converts GeoJSON to Well-Known Text format for PostGIS
- `createLocationWithGeometry()` - Creates Location with spatial data via raw SQL
- `updateLocationGeometry()` - Updates geometry of existing location

### SRID 3857 (Web Mercator)

All geometries use SRID 3857 (Web Mercator projection), suitable for regional maps and fantasy world maps.

## Spatial Queries Available

From the codebase, the following spatial queries exist:

- `findLocationsInBounds(worldId, bounds)` - Find locations in bounding box
- `findLocationsNearPoint(worldId, point, distance)` - Proximity search
- `isPointWithinLocation(locationId, point)` - Point-in-polygon test
- `locationsInRegion(regionGeometry, regionId, worldId)` - Find locations within region
- `getLocationGeoJSON(locationId)` - Retrieve geometry as GeoJSON

## Creating Regions in Seed Script

### Simple Region (No Geometry)

```typescript
const region = await prisma.location.create({
  data: {
    worldId: world.id,
    type: 'region',
    name: 'Varisia',
    description: 'A coastal region in the north',
  },
});
```

### Region with Polygon Geometry

Use the spatial helper for regions with PostGIS geometry:

```typescript
import { createLocationWithGeometry } from '../database/spatial.helpers';

const region = await createLocationWithGeometry(prisma, {
  worldId: world.id,
  type: 'region',
  name: 'Varisia',
  description: 'A coastal region in the north',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [100, 200],
        [150, 200],
        [150, 150],
        [100, 150],
        [100, 200],
      ],
    ],
  },
});
```

## Relationships to Other Models

### Location ↔ World

- Each Location belongs to exactly one World
- A World can have multiple Locations (regions and points)

### Location ↔ Settlement

- A Settlement optionally links to one Location (its geographic position)
- Typically a point or specific region

### Location ↔ Encounters/Events

- Multiple Encounters can be linked to a Location
- Multiple Events can be linked to a Location
- Used to show where encounters/events occur

### Location ↔ Location (Hierarchy)

- Locations can have parent locations via `parentLocationId`
- Enables nested region hierarchies (e.g., Regions → Sub-regions → Towns)
- Self-referential relationship via `children` and `parent` relations

## Example: Region Hierarchy

```
World: Golarion
  └─ Region: Varisia (polygon, parent: null)
      ├─ Point: Sandpoint (parent: Varisia region)
      ├─ Point: Magnimar (parent: Varisia region)
      └─ Sub-region: Nolands (polygon, parent: Varisia region)
          └─ Point: Thistletop (parent: Nolands)
```

## GraphQL Type Definition

From `packages/api/src/graphql/types/location.type.ts`:

```typescript
@ObjectType()
export class Location {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  worldId!: string;

  @Field(() => String, { description: 'Location type: point or region' })
  type!: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => ID, { nullable: true })
  parentLocationId?: string;

  @Field(() => GeoJSONScalar, {
    nullable: true,
    description: 'GeoJSON geometry representation',
  })
  geojson?: unknown;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}
```

## Demo Data Requirements (TICKET-035)

According to TICKET-035, the seed script should create:

- Multiple regions with evolving borders (polygon geometries)
- 20+ locations (cities, dungeons, landmarks) distributed across regions
- Regions should support hierarchical structure
- Regions should demonstrate relationship with Settlements and Structures
