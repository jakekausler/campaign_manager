# World Time System (TICKET-010)

Campaign-specific time tracking with support for custom calendars, time advancement, and integration with the versioning system.

## Overview

- Each campaign can track its own `currentWorldTime` (nullable DateTime field)
- Time can be advanced via GraphQL mutation `advanceWorldTime`
- Supports custom calendar systems defined per World (JSON field)
- Integrates with bitemporal versioning (Version.validFrom/validTo)
- Time advancement triggers cache invalidation (future: rules engine recalculation)

## Key Components

### WorldTimeService

**Location:** `packages/api/src/graphql/services/world-time.service.ts`

**Methods:**

- `getCurrentWorldTime(campaignId, user)` - Query current world time for a campaign
- `advanceWorldTime(campaignId, to, userId, expectedVersion, branchId?, invalidateCache?)` - Advance campaign time

**Features:**

- Transaction-safe updates with audit logging
- Optimistic locking for concurrency control (version checking)
- Campaign access authorization via `verifyCampaignAccess` helper
- Configurable cache invalidation
- Validates time only moves forward (no time travel to past)

### WorldTimeResolver

**Location:** `packages/api/src/graphql/resolvers/world-time.resolver.ts`

**GraphQL Operations:**

- `query getCurrentWorldTime(campaignId: ID!)` - Returns current world time or null
- `mutation advanceWorldTime(input: AdvanceWorldTimeInput!)` - Advances time and returns result

**Authorization:**

- Query: JwtAuthGuard (authorization delegated to service)
- Mutation: JwtAuthGuard + RolesGuard (requires 'owner' or 'gm' role)

### Calendar Utilities

**Location:** `packages/api/src/graphql/utils/calendar.utils.ts`

**Functions:**

- `parseWorldDate(dateString, calendar?)` - Parse date string using custom calendar or ISO format
- `formatWorldDate(date, calendar?, includeTime?)` - Format Date using custom calendar or ISO format
- `validateWorldDate(date, calendar?)` - Validate Date against calendar constraints

**Calendar Definition:**

```typescript
interface CalendarDefinition {
  id: string; // e.g., "absalom-reckoning"
  name: string; // e.g., "Absalom Reckoning"
  monthsPerYear: number; // e.g., 12
  daysPerMonth: number[]; // e.g., [31, 28, 31, ...]
  monthNames: string[]; // e.g., ["Abadius", "Calistril", ...]
  epoch: string; // ISO date, e.g., "2700-01-01T00:00:00Z"
  notes?: string;
}
```

**Supported Date Formats:**

- ISO 8601: `"4707-03-15T12:00:00Z"` or `"4707-03-15"`
- Custom Calendar: `"15 Pharast 4707"` or `"15 Pharast 4707 12:00:00"`

## GraphQL API Examples

### Query Current World Time

```graphql
query GetCurrentWorldTime {
  getCurrentWorldTime(campaignId: "cm4qk08y3000008l69xj44fyj")
}
```

Returns: Date in ISO 8601 format or null if not set

### Advance World Time

```graphql
mutation AdvanceWorldTime {
  advanceWorldTime(
    input: {
      campaignId: "cm4qk08y3000008l69xj44fyj"
      to: "4707-04-01T08:00:00Z"
      branchId: "main" # Optional, defaults to "main"
      invalidateCache: true # Optional, defaults to true
    }
  ) {
    campaignId
    previousWorldTime
    currentWorldTime
    affectedEntities
    message
  }
}
```

## Integration Points

1. **Campaign Model**: `currentWorldTime DateTime?` field added to Campaign
2. **Campaign Service**: Automatically includes currentWorldTime in all campaign queries
3. **Versioning System**: Works alongside Version.validFrom/validTo for bitemporal queries
4. **Cache Invalidation**: Calls `CampaignContextService.invalidateContext()` on time advancement
5. **Rules Engine** (Future - TICKET-020+): TODO marker in WorldTimeService for future integration

## Database Schema

```prisma
model Campaign {
  // ... other fields
  currentWorldTime DateTime? @db.Timestamp(3)
  // ... other fields

  @@index([currentWorldTime])
}
```

## Common Use Cases

1. **First-time setup**: Set initial world time for campaign
2. **Session advancement**: Advance time at end of game session
3. **Event triggering**: Use world time to determine if scheduled events should activate
4. **Historical queries**: Query entity state at specific world time using existing `asOf` parameters
5. **Custom calendars**: Parse/format dates using world-specific calendar definitions

## Validation Rules

- Time can only move forward (cannot go backward)
- Must have campaign access (owner or member)
- Mutation requires 'owner' or 'gm' role
- Optimistic locking prevents race conditions (version checking)

## Testing

- **Unit Tests**: WorldTimeService (17 tests), Calendar Utilities (31 tests)
- **Integration Tests**: WorldTimeResolver (8 tests), Campaign Service (3 tests for currentWorldTime)
- **Test Coverage**: All scenarios including null handling, validation, authorization, concurrency

## Implementation Details

- **Migration**: `add_campaign_current_world_time` (Stage 1)
- **Commits**:
  - Stage 1: 3934e7c (Database Schema)
  - Stage 2: 2f5ee47 (GraphQL Types)
  - Stage 3: ece354d (WorldTimeService)
  - Stage 4: 39e0b63 (GraphQL Resolver)
  - Stage 5: 91b3cf0 (Campaign Service Integration)
  - Stage 6: 57e1b71 (Calendar System)
  - Stage 7: 5e7fe2f (Rules Engine Hook)

## Future Enhancements

- Expose `expectedVersion` in AdvanceWorldTimeInput for client-side optimistic locking
- Rules engine integration for automatic recalculation on time advancement (TICKET-020+)
- Time-based event scheduling integration
