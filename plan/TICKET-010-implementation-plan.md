# TICKET-010: World Time System - Implementation Plan

## Overview

Implement a world time management system that tracks campaign-specific time, supports custom calendars from the World model, allows manual time advancement, and integrates with the existing versioning system.

**Key Insight**: The codebase already has worldTime support in the versioning system (Version.validFrom/validTo fields). This ticket adds explicit world time tracking per campaign and exposes mutations/queries to advance and query it.

## Architecture Analysis

### Existing Infrastructure

- ✅ World.calendars field already exists (JSON field with calendar definitions)
- ✅ Version.validFrom/validTo track world time for bitemporal versioning
- ✅ All update operations accept optional worldTime parameter
- ✅ Services have `getEntityAsOf(id, branchId, worldTime, user)` methods
- ✅ Calendar structure defined in seed data (monthsPerYear, daysPerMonth, monthNames, epoch)

### What's Missing

- ❌ Campaign.currentWorldTime field to track current time
- ❌ WorldTimeService to manage time advancement
- ❌ advanceWorldTime mutation
- ❌ GraphQL types for world time results
- ❌ Integration with rules engine invalidation
- ❌ Time validation logic

## Implementation Stages

---

## Stage 1: Database Schema & Migration

**Goal**: Add currentWorldTime field to Campaign model
**Success Criteria**: Migration runs successfully, field is available in Prisma Client
**Tests**: Database migration applies without errors
**Status**: ✅ Complete
**Commit**: 3934e7c588bd5886d328721b2fd9244fa4c3e1da

### Tasks

- [x] Add `currentWorldTime DateTime?` field to Campaign model in schema.prisma
- [x] Add index on currentWorldTime for time-based queries
- [x] Create and name migration: `add_campaign_current_world_time`
- [x] Run migration in development environment
- [x] Verify Prisma Client regenerates with new field
- [x] Update seed.ts to set initial currentWorldTime for sample campaign

### Implementation Notes

- Added nullable `currentWorldTime` field to Campaign model for backward compatibility
- Field positioned after `srid` to group campaign-level state together
- Index created on `currentWorldTime` to support time-based queries
- Seed data initializes to '4707-03-15T12:00:00Z' (mid-day Pharast 4707 AR)
- Migration also dropped `Location_geom_gist_idx` (PostGIS spatial index) - appears to be from prior schema drift

**Technical Details**:

```prisma
model Campaign {
  // ... existing fields
  currentWorldTime DateTime? // Current world time for this campaign
  // ... rest of model

  @@index([currentWorldTime])
}
```

---

## Stage 2: GraphQL Types & Inputs

**Goal**: Define GraphQL types for world time operations
**Success Criteria**: Types compile, appear in generated schema
**Tests**: TypeScript compilation passes
**Status**: Not Started

### Tasks

- [ ] Create `WorldTimeResult` type in `packages/api/src/graphql/types/world-time.type.ts`
  - campaignId: ID
  - previousWorldTime: DateTime (nullable)
  - currentWorldTime: DateTime
  - affectedEntities: Int (count of entities with versions at this time)
  - message: String
- [ ] Create `AdvanceWorldTimeInput` in `packages/api/src/graphql/inputs/world-time.input.ts`
  - campaignId: ID!
  - to: DateTime!
  - branchId: ID (optional, defaults to main)
  - invalidateCache: Boolean (default true)
- [ ] Update `Campaign` type to include currentWorldTime field
- [ ] Export types from index files

**Technical Details**:
Follow existing patterns from `packages/api/src/graphql/types/campaign.type.ts` and input files.

---

## Stage 3: WorldTimeService - Core Logic

**Goal**: Create service to manage world time advancement and queries
**Success Criteria**: Service methods work correctly in isolation
**Tests**: Unit tests for all service methods
**Status**: Not Started

### Tasks

- [ ] Create `packages/api/src/graphql/services/world-time.service.ts`
- [ ] Implement constructor with PrismaService, AuditService, CampaignContextService dependencies
- [ ] Implement `advanceWorldTime(campaignId, to, branchId?, userId)` method
  - Validate campaign exists and user has permission
  - Validate new time is after current time (if current time exists)
  - Update Campaign.currentWorldTime
  - Create audit log entry
  - Invalidate campaign context cache
  - Return WorldTimeResult
- [ ] Implement `getCurrentWorldTime(campaignId)` query method
- [ ] Implement `validateTimeAdvancement(campaign, newTime)` helper
  - Check newTime >= currentWorldTime (if set)
  - Check newTime is valid date
  - Optional: Validate against calendar system if available
- [ ] Create comprehensive unit tests in `world-time.service.test.ts`
  - Test successful time advancement
  - Test validation errors (past time, invalid campaign, etc.)
  - Test permission checks
  - Test audit logging
  - Test cache invalidation

**Technical Details**:

```typescript
@Injectable()
export class WorldTimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly campaignContext: CampaignContextService
  ) {}

  async advanceWorldTime(
    campaignId: string,
    to: Date,
    userId: string,
    branchId?: string
  ): Promise<WorldTimeResult> {
    // Implementation
  }

  async getCurrentWorldTime(campaignId: string): Promise<Date | null> {
    // Implementation
  }

  private validateTimeAdvancement(currentTime: Date | null, newTime: Date): void {
    // Validation logic
  }
}
```

---

## Stage 4: GraphQL Resolver

**Goal**: Expose world time operations via GraphQL API
**Success Criteria**: Mutations and queries work via GraphQL playground
**Tests**: Integration tests for GraphQL operations
**Status**: Not Started

### Tasks

- [ ] Create `packages/api/src/graphql/resolvers/world-time.resolver.ts`
- [ ] Implement `@Query getCurrentWorldTime(campaignId: ID!)`
  - Add JwtAuthGuard
  - Validate user has access to campaign
  - Return current world time or null
- [ ] Implement `@Mutation advanceWorldTime(input: AdvanceWorldTimeInput!)`
  - Add JwtAuthGuard and RolesGuard
  - Require 'owner' or 'gm' role
  - Call WorldTimeService.advanceWorldTime
  - Return WorldTimeResult
- [ ] Add resolver to graphql.module.ts providers
- [ ] Add WorldTimeService to graphql.module.ts providers
- [ ] Create integration tests in `world-time.resolver.test.ts`
  - Test query returns correct time
  - Test mutation advances time successfully
  - Test authorization (unauthenticated, wrong role, not campaign member)
  - Test validation errors

**Technical Details**:

```typescript
@Resolver()
export class WorldTimeResolver {
  constructor(private readonly worldTimeService: WorldTimeService) {}

  @Query(() => Date, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async getCurrentWorldTime(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Date | null> {
    // Implementation
  }

  @Mutation(() => WorldTimeResult)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async advanceWorldTime(
    @Args('input') input: AdvanceWorldTimeInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<WorldTimeResult> {
    // Implementation
  }
}
```

---

## Stage 5: Campaign Service Integration

**Goal**: Update CampaignService to expose currentWorldTime in queries
**Success Criteria**: Campaign queries return currentWorldTime field
**Tests**: Existing campaign tests pass, new field is populated
**Status**: Not Started

### Tasks

- [ ] Update CampaignService.findById to include currentWorldTime in select
- [ ] Update CampaignService.findAll to include currentWorldTime
- [ ] Update CampaignService.findByWorldId to include currentWorldTime
- [ ] Update campaign tests to verify currentWorldTime is returned
- [ ] Test that campaign queries include the new field

**Technical Details**:
The currentWorldTime field should be automatically included in Prisma queries since it's a scalar field. Main task is ensuring it appears in GraphQL responses.

---

## Stage 6: Calendar System Support

**Goal**: Add calendar-aware time utilities and validation
**Success Criteria**: Can parse/format dates according to world calendars
**Tests**: Calendar utilities work correctly with various calendar systems
**Status**: Not Started

### Tasks

- [ ] Create `packages/api/src/graphql/utils/calendar.utils.ts`
- [ ] Implement `parseWorldDate(dateString, calendar)` function
  - Parse date string according to calendar definition
  - Return JavaScript Date object
- [ ] Implement `formatWorldDate(date, calendar)` function
  - Format Date according to calendar's month names and structure
  - Return formatted string
- [ ] Implement `validateWorldDate(date, calendar)` function
  - Check date is valid for calendar (valid month, day, etc.)
  - Return validation result
- [ ] Create unit tests in `calendar.utils.test.ts`
  - Test with Absalom Reckoning calendar from seed data
  - Test with edge cases (invalid months, days)
  - Test with null/undefined calendars (should use ISO format)

**Technical Details**:

```typescript
export interface CalendarDefinition {
  id: string;
  name: string;
  monthsPerYear: number;
  daysPerMonth: number[];
  monthNames: string[];
  epoch: string;
  notes?: string;
}

export function parseWorldDate(dateString: string, calendar?: CalendarDefinition): Date {
  // Implementation
}

export function formatWorldDate(date: Date, calendar?: CalendarDefinition): string {
  // Implementation
}
```

---

## Stage 7: Rules Engine Integration (Future Hook)

**Goal**: Add hook for rules engine invalidation on time advancement
**Success Criteria**: Time advancement triggers cache invalidation placeholder
**Tests**: Verify invalidation is called (mock for now)
**Status**: Not Started

### Tasks

- [ ] Update WorldTimeService.advanceWorldTime to call campaign context invalidation
- [ ] Add comment/TODO for future rules engine integration
- [ ] Ensure CampaignContextService.invalidateCache is called with correct params
- [ ] Add test verifying invalidation is called

**Technical Details**:

```typescript
// In advanceWorldTime method
await this.campaignContext.invalidateCache(campaignId, branchId);

// TODO: When rules engine is implemented (TICKET-020+):
// await this.rulesEngine.invalidate({ campaignId, worldTime: to, branchId });
```

---

## Stage 8: Documentation & Examples

**Goal**: Document world time system usage and update README
**Success Criteria**: Developers can understand and use the world time system
**Tests**: Documentation is clear and accurate
**Status**: Not Started

### Tasks

- [ ] Add GraphQL schema examples to ticket notes
- [ ] Update CLAUDE.md with world time service information
- [ ] Add example GraphQL queries/mutations to ticket
- [ ] Document calendar system JSON structure
- [ ] Update README.md if necessary

**Example Mutations**:

```graphql
mutation AdvanceTime {
  advanceWorldTime(
    input: { campaignId: "campaign-123", to: "4707-03-15T12:00:00Z", branchId: "main" }
  ) {
    campaignId
    previousWorldTime
    currentWorldTime
    affectedEntities
    message
  }
}

query GetCurrentTime {
  getCurrentWorldTime(campaignId: "campaign-123")
}
```

---

## Testing Strategy

### Unit Tests

- WorldTimeService methods (Stage 3)
- Calendar utilities (Stage 6)
- Input validation
- Time advancement logic

### Integration Tests

- GraphQL mutations/queries (Stage 4)
- Campaign service integration (Stage 5)
- Authorization and permissions
- End-to-end time advancement flow

### Test Data

- Use seed data calendar (Absalom Reckoning)
- Test with null calendar (defaults to ISO dates)
- Test with multiple campaigns at different times

---

## Dependencies & Risks

### Dependencies

- ✅ TICKET-006 (Entity CRUD) - Complete
- ✅ Existing versioning system - In place
- ✅ Campaign Context Service - Available
- ⏳ Rules Engine (future) - Will integrate later via TODO

### Risks

1. **Calendar complexity**: Custom calendars may have complex rules
   - Mitigation: Start with simple validation, enhance incrementally
2. **Time travel queries**: Versioning system already supports this
   - Low risk: Leverage existing `getEntityAsOf` methods
3. **Performance**: Many entities may have versions at a given time
   - Mitigation: Use indexed queries, return counts not full data

---

## Acceptance Criteria Mapping

| Acceptance Criteria                           | Implementation Stage               |
| --------------------------------------------- | ---------------------------------- |
| Can advance world time for a campaign         | Stage 3, 4                         |
| World time is stored per campaign             | Stage 1                            |
| Time advancement triggers rules recalculation | Stage 7 (placeholder)              |
| Can query entity state at specific world time | Stage 5 (uses existing versioning) |
| Calendar system supports custom definitions   | Stage 6                            |
| Time travel queries work correctly            | Stage 5 (already implemented)      |

---

## Completion Checklist

- [ ] All 8 stages completed
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Type checking passes
- [ ] Linting passes
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Acceptance criteria verified
- [ ] Ticket marked complete in EPIC.md
