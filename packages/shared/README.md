# Campaign Manager - Shared Types and Utilities

Shared TypeScript type definitions and utilities used across all packages in the Campaign Manager monorepo.

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Build Tool**: TypeScript compiler (tsc)
- **Testing**: Jest
- **Code Quality**: ESLint, Prettier

## Purpose

This package provides common code that is shared across all other packages:

- **Type Definitions**: Shared TypeScript interfaces and types
- **Utility Functions**: Helper functions used by multiple packages
- **Constants**: Common constants and enums
- **Type Guards**: Runtime type checking functions

All other packages (`@campaign/api`, `@campaign/frontend`, `@campaign/rules-engine`, `@campaign/scheduler`) depend on this package for consistent type definitions and shared utilities.

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

From the project root:

```bash
# Install dependencies
pnpm install

# Build shared package
pnpm --filter @campaign/shared build
```

### Development Commands

**IMPORTANT**: Always run commands from the project root, never `cd` into this directory.

```bash
# Build the package
pnpm --filter @campaign/shared build

# Watch mode (rebuild on changes)
pnpm --filter @campaign/shared dev

# Type checking
pnpm --filter @campaign/shared type-check

# Linting
pnpm --filter @campaign/shared lint
pnpm --filter @campaign/shared lint -- --fix

# Testing
pnpm --filter @campaign/shared test
pnpm --filter @campaign/shared test:watch

# Clean build artifacts
pnpm --filter @campaign/shared clean
```

## Package Structure

```
packages/shared/
├── src/
│   ├── index.ts                     # Main export file
│   └── types/
│       ├── index.ts                 # Base type definitions
│       ├── geojson.ts               # GeoJSON and spatial types
│       └── websocket-events.ts      # Real-time event types
├── dist/                            # Compiled output (gitignored)
├── package.json
├── tsconfig.json
└── README.md
```

## Type Definitions

### Base Types

**`BaseEntity`**

Base interface that all domain objects extend:

```typescript
interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**`EntityType`**

Union type for all entity types in the system:

```typescript
type EntityType = 'location' | 'encounter' | 'event' | 'character';
```

### GeoJSON Types

Comprehensive GeoJSON type definitions based on RFC 7946:

- `GeoJSONPoint`, `GeoJSONLineString`, `GeoJSONPolygon`
- `GeoJSONMultiPoint`, `GeoJSONMultiLineString`, `GeoJSONMultiPolygon`
- `GeoJSONGeometryCollection`
- `GeoJSONFeature`, `GeoJSONFeatureCollection`
- `BoundingBox`, `CRSConfig`

**Common SRID Constants:**

```typescript
const SRID = {
  WGS84: 4326, // Standard GPS coordinates
  WEB_MERCATOR: 3857, // Used by most web maps
} as const;
```

**Example Usage:**

```typescript
import { GeoJSONPoint, SRID } from '@campaign/shared';

const location: GeoJSONPoint = {
  type: 'Point',
  coordinates: [-122.4194, 37.7749], // [longitude, latitude]
};
```

### WebSocket Event Types

Type-safe real-time event definitions for WebSocket/Redis pub/sub:

- `EntityUpdatedEvent` - Entity CRUD operations
- `StateInvalidatedEvent` - Computed state invalidations
- `WorldTimeChangedEvent` - Campaign world time updates
- `SettlementUpdatedEvent` - Settlement changes
- `StructureUpdatedEvent` - Structure changes

All events extend `BaseWebSocketEvent` with common fields:

```typescript
interface BaseWebSocketEvent {
  timestamp: string; // ISO 8601
  metadata?: {
    userId?: string;
    source?: string;
    correlationId?: string;
  };
}
```

**Example Usage:**

```typescript
import { createEntityUpdatedEvent, isWebSocketEvent, WebSocketEvent } from '@campaign/shared';

// Create an event
const event = createEntityUpdatedEvent('campaign', 'campaign-123', 'campaign-123', {
  changedFields: ['name', 'description'],
  userId: 'user-456',
});

// Type-safe event handling
function handleEvent(event: WebSocketEvent) {
  if (event.type === 'entity_updated') {
    // TypeScript knows the payload structure
    console.log(`Entity ${event.payload.entityId} updated`);
  }
}

// Runtime validation
if (isWebSocketEvent(unknownData)) {
  handleEvent(unknownData);
}
```

## Helper Functions

### WebSocket Event Creators

Type-safe helper functions for creating WebSocket events:

- `createEntityUpdatedEvent(entityType, entityId, campaignId, options?)`
- `createStateInvalidatedEvent(campaignId, scope, options?)`
- `createWorldTimeChangedEvent(campaignId, previousTime, newTime, options?)`
- `createSettlementUpdatedEvent(settlementId, campaignId, operation, options?)`
- `createStructureUpdatedEvent(structureId, settlementId, campaignId, operation, options?)`

### Type Guards

- `isWebSocketEvent(obj)` - Validates if an object is a valid WebSocket event

## Usage in Other Packages

### API Package

```typescript
import { BaseEntity, GeoJSONPoint, createEntityUpdatedEvent } from '@campaign/shared';

// Extend base entity
interface Campaign extends BaseEntity {
  name: string;
  description: string;
}

// Use GeoJSON types in GraphQL resolvers
@Resolver()
class LocationResolver {
  @Query(() => GeoJSONPoint)
  async getLocationGeometry(@Args('id') id: string): Promise<GeoJSONPoint> {
    // ...
  }
}

// Publish WebSocket events
const event = createEntityUpdatedEvent('campaign', id, campaignId);
await this.eventBus.publish(event);
```

### Frontend Package

```typescript
import { WebSocketEvent, GeoJSONFeatureCollection } from '@campaign/shared';

// Handle real-time events
socket.on('event', (event: WebSocketEvent) => {
  if (event.type === 'entity_updated') {
    refetchEntity(event.payload.entityId);
  }
});

// Work with map data
const features: GeoJSONFeatureCollection = {
  type: 'FeatureCollection',
  features: locations.map((loc) => ({
    type: 'Feature',
    id: loc.id,
    geometry: loc.geometry,
    properties: { name: loc.name },
  })),
};
```

### Rules Engine & Scheduler

```typescript
import { EntityType, createStateInvalidatedEvent } from '@campaign/shared';

// Type-safe entity references
function evaluateConditions(entityType: EntityType, entityId: string) {
  // ...
}

// Publish invalidation events
const event = createStateInvalidatedEvent(campaignId, 'entity', {
  entityIds: [entityId],
  reason: 'Condition re-evaluation required',
});
```

## TypeScript Configuration

This package is configured with strict TypeScript settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true
  }
}
```

All exported types are compiled to `dist/` with:

- Type declarations (`.d.ts`)
- Source maps (`.d.ts.map`, `.js.map`)
- JavaScript output (`.js`)

## Adding New Shared Types

When adding new shared types:

1. Create the type definition in `src/types/` (or appropriate subdirectory)
2. Export the type from `src/types/index.ts`
3. Re-export from `src/index.ts` if needed
4. Run `pnpm --filter @campaign/shared build` to compile
5. Update this README with usage examples
6. Document in JSDoc comments for IntelliSense

**Example:**

```typescript
// src/types/my-new-type.ts
/**
 * Description of the new type
 */
export interface MyNewType {
  id: string;
  // ...
}

// src/types/index.ts
export * from './my-new-type';
```

## Testing

This package uses Jest for testing. Tests should:

- Validate type guards work correctly
- Test helper functions produce correct output
- Ensure discriminated unions work as expected

```bash
# Run tests
pnpm --filter @campaign/shared test

# Watch mode
pnpm --filter @campaign/shared test:watch
```

## Build Output

The package is built to `dist/` and published to the npm registry (future) with:

- `dist/index.js` - Main entry point
- `dist/index.d.ts` - Type declarations
- `dist/types/*` - Modular type definitions

Other packages consume this via workspace dependencies:

```json
{
  "dependencies": {
    "@campaign/shared": "workspace:*"
  }
}
```

## Related Documentation

- **Project Documentation**:
  - [Root README](../../README.md) - Project overview and setup guide
  - [CLAUDE.md](../../CLAUDE.md) - Development guidelines and workflow

- **Feature Documentation** (in `../../docs/features/`):
  - [Condition System](../../docs/features/condition-system.md) - JSONLogic condition types
  - [Effect System](../../docs/features/effect-system.md) - JSON Patch effect types
  - [Dependency Graph System](../../docs/features/dependency-graph-system.md) - Dependency link types
  - [World Time System](../../docs/features/world-time-system.md) - Time and calendar types
  - [Branching System](../../docs/features/branching-system.md) - Branch and merge types
  - [Real-time Updates](../../docs/features/realtime-updates.md) - WebSocket event types
  - [Map Editing Tools](../../docs/features/map-editing-tools.md) - GeoJSON geometry types

- **Development Documentation** (in `../../docs/development/`):
  - [Frontend Guide](../../docs/development/frontend-guide.md) - Frontend integration patterns
  - [Subagent Guide](../../docs/development/subagent-guide.md) - Development workflow

- **Package Documentation**:
  - [API Package](../api/README.md) - NestJS GraphQL API (consumer)
  - [Frontend Package](../frontend/README.md) - React frontend (consumer)
  - [Rules Engine](../rules-engine/README.md) - Condition evaluation worker (consumer)
  - [Scheduler](../scheduler/README.md) - Time-based operations worker (consumer)

## Contributing

When modifying shared types:

1. **Breaking Changes**: Coordinate with all packages that use the type
2. **Versioning**: Update package version following semver
3. **Migration**: Provide migration guide for breaking changes
4. **Documentation**: Update JSDoc comments and this README
5. **Testing**: Ensure all consuming packages still compile and pass tests

Run the full monorepo type-check after making changes:

```bash
pnpm run type-check
```
