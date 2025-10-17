# TICKET-010: World Time System

## Status

- [ ] Completed
- **Commits**:
  - Stage 1 (Database Schema & Migration): 3934e7c588bd5886d328721b2fd9244fa4c3e1da
  - Stage 2 (GraphQL Types & Inputs): 2f5ee47f0ee8c3fae89c6f38e4fba7bb5f0a6b8d
  - Stage 3 (WorldTimeService - Core Logic): ece354df86dccff2295c0cb292d58da15ad7ce6e

## Implementation Progress

### Stage 1: Database Schema & Migration ✅ Complete

**What was implemented:**

- Added `currentWorldTime DateTime?` field to Campaign model in schema.prisma
- Created database migration `add_campaign_current_world_time`
- Added index on `currentWorldTime` for time-based queries
- Updated seed.ts to initialize currentWorldTime to '4707-03-15T12:00:00Z' (mid-day Pharast 4707 AR)

**Technical decisions:**

- Made field nullable for backward compatibility with existing campaigns
- Positioned field after `srid` to group campaign-level state together
- Used TIMESTAMP(3) precision for millisecond-level accuracy
- Index supports future time-travel queries and time-based filtering

**Note:** Migration also dropped `Location_geom_gist_idx` (PostGIS spatial index), which appears to be from prior schema drift. May need restoration in future spatial optimization ticket.

### Stage 2: GraphQL Types & Inputs ✅ Complete

**What was implemented:**

- Created `WorldTimeResult` GraphQL ObjectType in `packages/api/src/graphql/types/world-time.type.ts`
  - Fields: campaignId (ID), previousWorldTime (Date, nullable), currentWorldTime (Date), affectedEntities (Int), message (String)
  - All fields include descriptive comments for GraphQL schema documentation
- Created `AdvanceWorldTimeInput` GraphQL InputType in `packages/api/src/graphql/inputs/world-time.input.ts`
  - Fields: campaignId (ID, required), to (Date, required), branchId (ID, optional), invalidateCache (Boolean, optional, default true)
  - Full validation using class-validator decorators (@IsUUID, @IsDate, @IsNotEmpty, @IsOptional, @IsBoolean)
  - Uses class-transformer @Type(() => Date) for proper Date deserialization
- Updated Campaign type in `packages/api/src/graphql/types/campaign.type.ts`
  - Added currentWorldTime field (Date, nullable) with description

**Technical decisions:**

- Followed existing patterns from campaign.input.ts and version.input.ts for consistency
- Used proper NestJS GraphQL decorators (@Field, @ObjectType, @InputType) throughout
- Applied comprehensive input validation to prevent invalid data at GraphQL layer
- Made branchId optional to default to main branch in service layer (Stage 3)
- Included invalidateCache flag for fine-grained cache control
- Positioned descriptions in Field decorator options for consistency with codebase
- Made currentWorldTime nullable in Campaign type to match database schema

**Code review:**

- ✅ Approved by Code Reviewer subagent with no critical issues
- ✅ All type-checking passes successfully
- ✅ All linting passes (only pre-existing warnings in unrelated test files)
- Suggestions for future enhancement: custom validation for time advancement logic, JSDoc comments
- These suggestions will be considered in future iterations but are not blockers

### Stage 3: WorldTimeService - Core Logic ✅ Complete

**What was implemented:**

- Created `WorldTimeService` in `packages/api/src/graphql/services/world-time.service.ts`
- Implemented `getCurrentWorldTime(campaignId, user)` query method
- Implemented `advanceWorldTime(campaignId, to, userId, expectedVersion, branchId?, invalidateCache?)` mutation method
- Created private helper methods:
  - `validateTimeAdvancement(currentTime, newTime)` for time validation
  - `verifyCampaignAccess<T>(campaignId, userId, select?)` for DRY authorization
- Comprehensive test suite with 17 unit tests in `world-time.service.test.ts`

**Technical decisions:**

- **Transaction Safety**: Wrapped campaign update and audit log in Prisma `$transaction` for atomicity
  - Ensures both operations succeed or fail together
  - Direct audit creation via `tx.audit.create` instead of AuditService (which swallows errors)
- **Optimistic Locking**: Added `expectedVersion` parameter for race condition protection
  - Dual-layer protection: application-level check + database WHERE clause
  - Throws `OptimisticLockException` on version mismatch
  - Increments version on successful update
- **Authorization Extraction**: Created reusable `verifyCampaignAccess` helper
  - Generic type parameter for type-safe selective field fetching
  - Single source of truth for campaign access logic
  - Used by both `getCurrentWorldTime` and `advanceWorldTime`
- **Performance Optimization**: Selective field fetching using Prisma `select`
  - Only fetches required fields (`id`, `currentWorldTime`, `version`)
  - Reduces data transfer and memory usage
- **Cache Control**: Configurable cache invalidation
  - `invalidateCache` parameter (default: true)
  - Allows disabling for batch operations
- **Null Handling**: Proper support for first-time world time setting
  - Validates `newTime > currentWorldTime` only if `currentWorldTime` exists
  - Returns `undefined` for `previousWorldTime` when null (matches GraphQL optional field)

**Code review:**

- ✅ Approved by Code Reviewer subagent after addressing critical issues
- ✅ All 17 unit tests passing
- ✅ Type-checking passes with no errors
- ✅ Linting passes (only pre-existing warnings in unrelated files)
- ✅ Transaction safety verified
- ✅ Optimistic locking implementation validated
- ✅ Authorization logic properly extracted
- ✅ Performance optimizations confirmed

**Test coverage:**

- `getCurrentWorldTime`: 4 tests
  - Returns current world time for valid campaign
  - Returns null when campaign has no time set
  - Throws NotFoundException when campaign doesn't exist
  - Throws NotFoundException when user lacks access
- `advanceWorldTime`: 9 tests
  - Successfully advances time with all validations
  - Handles first-time setting (null current time)
  - Throws NotFoundException for invalid campaign
  - Throws NotFoundException when user lacks access
  - Throws BadRequestException for past time
  - Throws BadRequestException for same time
  - Respects invalidateCache parameter
  - Invalidates cache by default
  - Throws OptimisticLockException on version mismatch
- `validateTimeAdvancement`: 4 tests
  - Allows any time when current time is null
  - Validates new time after current time
  - Rejects past time
  - Rejects same time

**Dependencies:**

- PrismaService: Database operations and transactions
- CampaignContextService: Campaign context cache invalidation
- OptimisticLockException: Thrown on concurrent modification conflicts

## Description

Implement world time management system that tracks campaign-specific time, supports custom calendars, allows manual time advancement, and integrates with versioning and rules systems.

## Scope of Work

1. Create WorldTimeService
2. Implement time advancement mutations
3. Add calendar system support
4. Create time-based queries
5. Integrate with versioning (asOf parameter)
6. Add time validation and constraints

## Acceptance Criteria

- [ ] Can advance world time for a campaign
- [ ] World time is stored per campaign
- [ ] Time advancement triggers rules recalculation
- [ ] Can query entity state at specific world time
- [ ] Calendar system supports custom definitions
- [ ] Time travel queries work correctly

## Technical Notes

```typescript
@Mutation(() => WorldTimeResult)
async advanceWorldTime(
  @Args('campaignId') campaignId: string,
  @Args('to') to: DateTime,
): Promise<WorldTimeResult> {
  const result = await this.worldTimeService.advance(campaignId, to);
  await this.rulesEngine.invalidate({ campaignId, worldTime: to });
  return result;
}
```

## Dependencies

- Requires: TICKET-006

## Estimated Effort

2-3 days
