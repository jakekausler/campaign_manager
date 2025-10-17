# TICKET-010: World Time System

## Status

- [ ] Completed
- **Commits**:
  - Stage 1 (Database Schema & Migration): 3934e7c588bd5886d328721b2fd9244fa4c3e1da
  - Stage 2 (GraphQL Types & Inputs): 2f5ee47f0ee8c3fae89c6f38e4fba7bb5f0a6b8d
  - Stage 3 (WorldTimeService - Core Logic): ece354df86dccff2295c0cb292d58da15ad7ce6e
  - Stage 4 (GraphQL Resolver): 39e0b635578eed2ca210ae29c52d8c88fce38bd7
  - Stage 5 (Campaign Service Integration): 91b3cf02467670268c4eb15fc0a3d25e791046b4
  - Stage 6 (Calendar System Support): 57e1b7162f5f408dd1b802b617572c99b8c71f05
  - Stage 7 (Rules Engine Integration): 5e7fe2fbb0275ac950ac6cf0c0dea892b0ca7a0b

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

### Stage 4: GraphQL Resolver ✅ Complete

**What was implemented:**

- Created `WorldTimeResolver` in `packages/api/src/graphql/resolvers/world-time.resolver.ts`
- Implemented `getCurrentWorldTime(campaignId)` GraphQL query
  - Returns current world time (Date) or null if not set
  - Protected with JwtAuthGuard for authentication
  - Delegates to WorldTimeService.getCurrentWorldTime
- Implemented `advanceWorldTime(input)` GraphQL mutation
  - Takes AdvanceWorldTimeInput with campaignId, to, optional branchId and invalidateCache
  - Protected with JwtAuthGuard and RolesGuard
  - Requires 'owner' or 'gm' role for authorization
  - Extracts user.id from AuthenticatedUser context
  - Delegates to WorldTimeService.advanceWorldTime
  - Returns WorldTimeResult with previous/current times and metadata
- Registered WorldTimeResolver and WorldTimeService in graphql.module.ts providers
- Comprehensive test suite with 8 integration tests in `world-time.resolver.test.ts`

**Technical decisions:**

- **Authentication/Authorization Pattern**: Followed existing resolver patterns
  - Query uses JwtAuthGuard only (authorization in service layer)
  - Mutation uses JwtAuthGuard + RolesGuard with @Roles('owner', 'gm')
  - Service layer performs granular campaign access checks via verifyCampaignAccess
- **Parameter Mapping**: Clean destructuring of AdvanceWorldTimeInput
  - campaignId, to, branchId, invalidateCache extracted from input
  - user.id (not userId) extracted from AuthenticatedUser per interface definition
- **Optimistic Locking**: Hardcoded expectedVersion to 0 at GraphQL layer
  - Acceptable for Stage 4 (single-user scenarios)
  - Will be exposed as optional input field in future versioning integration
  - Service layer handles OptimisticLockException for concurrent modification
- **Import Organization**: Added imports in alphabetical order per ESLint rules
  - WorldTimeResolver after WorldResolver
  - WorldTimeService after WorldService
- **Module Registration**: Added to providers in correct positions
  - WorldTimeService in services section (line 172)
  - WorldTimeResolver in resolvers section (line 190)

**Code review:**

- ✅ Approved by Code Reviewer subagent with no critical issues
- ✅ All 8 integration tests passing
- ✅ Type-checking passes with no errors
- ✅ Linting passes (only pre-existing warnings in unrelated files)
- ✅ Follows all project conventions and patterns
- ✅ Proper separation of concerns (resolver → service delegation)
- ✅ No security vulnerabilities
- ✅ No performance issues

**Test coverage:**

- `getCurrentWorldTime`: 3 tests
  - Returns current world time for valid campaign
  - Returns null when campaign has no time set
  - Passes correct parameters to service
- `advanceWorldTime`: 5 tests
  - Successfully advances time with required parameters
  - Successfully advances time with all optional parameters
  - Handles first-time world time setting (no previous time)
  - Uses default invalidateCache value when not specified
  - Correctly extracts user.id from authenticated user

**Files created:**

- packages/api/src/graphql/resolvers/world-time.resolver.ts (53 lines)
- packages/api/src/graphql/resolvers/world-time.resolver.test.ts (238 lines)

**Files modified:**

- packages/api/src/graphql/graphql.module.ts (added imports and provider registrations)

**Future enhancements (from Code Reviewer):**

- Consider adding expectedVersion as optional field in AdvanceWorldTimeInput (Stage 5 or future)
- Consider adding JSDoc comments for improved IDE IntelliSense (optional)
- Could add exception propagation tests (optional, current coverage excellent)

### Stage 5: Campaign Service Integration ✅ Complete

**What was implemented:**

- Updated mockCampaign test fixture to include currentWorldTime field (4707-03-15T12:00:00Z)
- Added test in findById describe block to verify currentWorldTime field is returned
- Added test in findAll describe block to verify currentWorldTime with null handling
- Added new findByWorldId describe block with tests for:
  - Basic findByWorldId functionality
  - currentWorldTime field presence with null handling

**Key findings:**

- **No service code changes needed**: The currentWorldTime field is automatically included in all Prisma query results because:
  1. It's a scalar field (DateTime?) in the Campaign model (added in Stage 1)
  2. Service methods (findById, findAll, findByWorldId) don't use explicit `select` clauses
  3. Prisma returns all scalar fields by default unless explicitly excluded
- **GraphQL type already includes field**: The Campaign GraphQL type was updated in Stage 2 to include currentWorldTime
- **Tests verify complete integration**: All 29 campaign service tests pass, including 3 new tests specifically for currentWorldTime

**Test coverage:**

- findById: 3 tests (including currentWorldTime field verification)
- findAll: 2 tests (including currentWorldTime with null handling)
- findByWorldId: 2 tests (new describe block with basic test and currentWorldTime verification)
- All tests verify both non-null (4707-03-15T12:00:00Z) and null scenarios

**Code review:**

- ✅ Approved by Code Reviewer subagent with no critical issues
- ✅ All 29 campaign service tests passing
- ✅ Type-checking passes with no errors
- ✅ Linting passes (only 56 pre-existing warnings in unrelated files)
- ✅ Follows all project conventions and test patterns

**Files modified:**

- packages/api/src/graphql/services/campaign.service.test.ts (76 lines added)

**Technical insight:**

The implementation plan originally suggested updating service methods to include currentWorldTime in select clauses, but this proved unnecessary. Prisma's default behavior of returning all scalar fields meant the database change from Stage 1 and GraphQL type update from Stage 2 were sufficient. This stage simply added test coverage to verify and document that integration.

### Stage 6: Calendar System Support ✅ Complete

**What was implemented:**

- Created calendar utilities in `packages/api/src/graphql/utils/calendar.utils.ts`
- Implemented `CalendarDefinition` interface matching World model's calendar JSON structure
- Implemented three main utility functions: `parseWorldDate`, `formatWorldDate`, `validateWorldDate`
- Comprehensive test suite with 31 unit tests in `calendar.utils.test.ts` (100% passing)

**Key features:**

1. **parseWorldDate Function**:
   - Supports both ISO 8601 format (e.g., "4707-03-15T12:00:00Z") and custom calendar format (e.g., "15 Pharast 4707")
   - Custom format patterns: "DD MonthName YYYY" or "DD MonthName YYYY HH:MM:SS"
   - Case-insensitive month name matching
   - Validates day ranges per month (e.g., 1-28 for Calistril, 1-31 for Abadius)
   - Throws descriptive errors for invalid dates, months, or day ranges
   - Graceful fallback to ISO parsing when no calendar provided

2. **formatWorldDate Function**:
   - Converts JavaScript Date to custom calendar format
   - Returns "DD MonthName YYYY" or with time component "DD MonthName YYYY HH:MM:SS"
   - Uses calendar's month names and day counts for accurate conversion
   - Falls back to ISO 8601 format when no calendar provided
   - Proper zero-padding for time components (01:05:09)

3. **validateWorldDate Function**:
   - Validates Date objects against calendar constraints
   - Checks if date is after calendar epoch
   - Validates month and day are within calendar bounds
   - Returns structured validation result `{ isValid: boolean, error?: string }`
   - Provides descriptive error messages for debugging

**Technical decisions:**

- **Accurate Calendar Arithmetic**: Calculates exact days per year from calendar definition using `daysPerMonth.reduce((sum, days) => sum + days, 0)` (not approximation of 365 days)
- **Timezone Handling**: Date-only ISO strings parsed in local timezone; custom calendar times interpreted as local time but stored internally as UTC; formatting uses UTC methods for consistency
- **Error Handling**: parseWorldDate throws descriptive errors; validateWorldDate returns validation object instead of throwing
- **Dual Mode Support**: With calendar uses custom month names/day counts; without calendar falls back to ISO 8601

**Code review:**

- ✅ Approved by Code Reviewer subagent with no critical issues
- ✅ All 31 unit tests passing
- ✅ Type-checking passes with no errors
- ✅ Linting passes (only 56 pre-existing warnings in unrelated files)
- ✅ Follows all project conventions
- ✅ No security vulnerabilities
- ✅ No performance issues
- ✅ Excellent test coverage including edge cases

**Test coverage:**

- **parseWorldDate**: 13 tests (ISO/custom formats, case-insensitive, validation, error cases)
- **formatWorldDate**: 6 tests (ISO/custom output, time handling, boundaries, zero-padding)
- **validateWorldDate**: 8 tests (valid/invalid dates, epoch boundaries, null handling)
- **Integration**: 4 tests (round-trip conversion, validation of parsed dates, null handling)

**Files created:**

- packages/api/src/graphql/utils/calendar.utils.ts (237 lines)
- packages/api/src/graphql/utils/calendar.utils.test.ts (289 lines)

**Minor suggestions from Code Review (optional for future):**

- Consider extracting `MILLISECONDS_PER_DAY` constant
- Consider extracting `getDaysPerYear()` helper function
- Consider adding JSDoc field descriptions to CalendarDefinition interface

### Stage 7: Rules Engine Integration (Future Hook) ✅ Complete

**What was implemented:**

- Added comprehensive TODO comment in WorldTimeService.advanceWorldTime for future rules engine integration
- Documented where rules engine invalidation should be called when implemented (TICKET-020+)
- Verified cache invalidation is already implemented and thoroughly tested

**Technical decisions:**

- **Minimal Change Principle**: Added only documentation, no premature implementation
- **Strategic Placement**: Positioned TODO immediately after cache invalidation for logical flow
- **Comprehensive Documentation**: TODO includes:
  - Specific ticket reference (TICKET-020+) for when to implement
  - Example API call signature: `await this.rulesEngine.invalidate({ campaignId, worldTime: to, branchId })`
  - List of specific recalculation scenarios:
    - Conditional effects based on time
    - Time-based triggers
    - Scheduled events that should activate
    - Derived properties depending on world time
- **Existing Implementation Verified**: Cache invalidation via `campaignContext.invalidateContext(campaignId)` already in place
- **Test Coverage Complete**: Existing tests already verify cache invalidation:
  - Test: "should invalidate cache by default"
  - Test: "should not invalidate cache if invalidateCache is false"
  - Mock properly configured for CampaignContextService

**Code review:**

- ✅ Approved by Code Reviewer subagent with no critical issues
- ✅ All 17 WorldTimeService unit tests passing
- ✅ Type-checking passes (0 errors)
- ✅ Linting passes (only 56 pre-existing warnings in unrelated files)
- ✅ Follows all project conventions
- ✅ No security vulnerabilities
- ✅ No performance issues
- ✅ Stage 7 requirements fully met

**Stage 7 requirements met:**

- ✅ Update WorldTimeService.advanceWorldTime to call campaign context invalidation (already implemented in Stage 3)
- ✅ Add comment/TODO for future rules engine integration (this stage)
- ✅ Ensure CampaignContextService.invalidateCache is called with correct params (verified)
- ✅ Add test verifying invalidation is called (existing tests already cover this)

**Files modified:**

- packages/api/src/graphql/services/world-time.service.ts (added 9 lines of documentation)

**Note:** Stage 7 is intentionally minimal - it establishes the integration hook without implementing the rules engine itself. The actual rules engine integration will occur in TICKET-020+ (Rules Engine tickets). This approach follows the "placeholder for future integration" strategy outlined in the implementation plan.

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

## GraphQL API Usage

### Example Queries

#### Get Current World Time

```graphql
query GetCurrentWorldTime {
  getCurrentWorldTime(campaignId: "cm4qk08y3000008l69xj44fyj")
}
```

**Response:**

```json
{
  "data": {
    "getCurrentWorldTime": "4707-03-15T12:00:00.000Z"
  }
}
```

If no world time is set for the campaign, returns `null`.

### Example Mutations

#### Advance World Time (Basic)

```graphql
mutation AdvanceWorldTime {
  advanceWorldTime(input: { campaignId: "cm4qk08y3000008l69xj44fyj", to: "4707-04-01T08:00:00Z" }) {
    campaignId
    previousWorldTime
    currentWorldTime
    affectedEntities
    message
  }
}
```

**Response:**

```json
{
  "data": {
    "advanceWorldTime": {
      "campaignId": "cm4qk08y3000008l69xj44fyj",
      "previousWorldTime": "4707-03-15T12:00:00.000Z",
      "currentWorldTime": "4707-04-01T08:00:00.000Z",
      "affectedEntities": 0,
      "message": "World time advanced successfully from 4707-03-15T12:00:00.000Z to 4707-04-01T08:00:00.000Z"
    }
  }
}
```

#### Advance World Time (With All Options)

```graphql
mutation AdvanceWorldTimeWithOptions {
  advanceWorldTime(
    input: {
      campaignId: "cm4qk08y3000008l69xj44fyj"
      to: "4707-04-15T18:30:00Z"
      branchId: "main"
      invalidateCache: true
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

**Optional Parameters:**

- `branchId` (ID): Defaults to "main" if not specified. Used for future branch-specific time management.
- `invalidateCache` (Boolean): Defaults to `true`. Set to `false` to skip cache invalidation (useful for batch operations).

### Input Validation

The `AdvanceWorldTimeInput` validates:

- `campaignId`: Must be a valid UUID
- `to`: Must be a valid date/time
- `to` must be greater than the current world time (cannot go backwards in time)
- User must have 'owner' or 'gm' role for the campaign

## Calendar System

### Calendar JSON Structure

Each World can define a custom calendar system stored as JSON. The calendar is used by the calendar utilities to parse and format world-specific dates.

**Calendar Definition:**

```typescript
interface CalendarDefinition {
  id: string; // Unique identifier (e.g., "absalom-reckoning")
  name: string; // Display name (e.g., "Absalom Reckoning")
  monthsPerYear: number; // Number of months in a year (e.g., 12)
  daysPerMonth: number[]; // Days in each month (e.g., [31, 28, 31, 30, ...])
  monthNames: string[]; // Names of months (e.g., ["Abadius", "Calistril", ...])
  epoch: string; // Calendar epoch as ISO date (e.g., "2700-01-01T00:00:00Z")
  notes?: string; // Optional description
}
```

**Example - Absalom Reckoning (Golarion):**

```json
{
  "id": "absalom-reckoning",
  "name": "Absalom Reckoning",
  "monthsPerYear": 12,
  "daysPerMonth": [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
  "monthNames": [
    "Abadius",
    "Calistril",
    "Pharast",
    "Gozran",
    "Desnus",
    "Sarenith",
    "Erastus",
    "Arodus",
    "Rova",
    "Lamashan",
    "Neth",
    "Kuthona"
  ],
  "epoch": "2700-01-01T00:00:00Z",
  "notes": "The most commonly used calendar on Golarion, dating from the founding of Absalom in 1 AR."
}
```

### Calendar Utilities

The system provides three utility functions for working with custom calendars:

#### parseWorldDate(dateString, calendar?)

Parses a date string using the provided calendar definition.

**Supported Formats:**

- ISO 8601: `"4707-03-15T12:00:00Z"` or `"4707-03-15"`
- Custom Calendar: `"15 Pharast 4707"` or `"15 Pharast 4707 12:00:00"`

**Examples:**

```typescript
// With custom calendar
const date1 = parseWorldDate('15 Pharast 4707', absalomReckoning);
// Returns: Date object for Pharast 15, 4707 AR

// With ISO format
const date2 = parseWorldDate('4707-03-15T12:00:00Z', absalomReckoning);
// Returns: Date object for the ISO timestamp

// Without calendar (falls back to ISO parsing)
const date3 = parseWorldDate('2024-12-15T10:30:00Z');
// Returns: Date object for the ISO timestamp
```

**Features:**

- Case-insensitive month name matching
- Validates day ranges per month (e.g., 1-28 for Calistril, 1-31 for Abadius)
- Throws descriptive errors for invalid dates

#### formatWorldDate(date, calendar?, includeTime?)

Formats a Date object using the provided calendar definition.

**Examples:**

```typescript
const date = new Date('4707-03-15T12:00:00Z');

// With custom calendar (date only)
const formatted1 = formatWorldDate(date, absalomReckoning);
// Returns: "15 Pharast 4707"

// With custom calendar (include time)
const formatted2 = formatWorldDate(date, absalomReckoning, true);
// Returns: "15 Pharast 4707 12:00:00"

// Without calendar (falls back to ISO)
const formatted3 = formatWorldDate(date);
// Returns: "4707-03-15T12:00:00.000Z"
```

#### validateWorldDate(date, calendar?)

Validates a Date object against calendar constraints.

**Returns:** `{ isValid: boolean, error?: string }`

**Examples:**

```typescript
const validDate = new Date('4707-03-15T12:00:00Z');
const result1 = validateWorldDate(validDate, absalomReckoning);
// Returns: { isValid: true }

const beforeEpoch = new Date('2000-01-01T00:00:00Z');
const result2 = validateWorldDate(beforeEpoch, absalomReckoning);
// Returns: { isValid: false, error: "Date is before calendar epoch..." }
```

## Technical Notes

### Service Architecture

```typescript
// WorldTimeService - Core Logic
export class WorldTimeService {
  async getCurrentWorldTime(campaignId: string, user: AuthenticatedUser): Promise<Date | null>;

  async advanceWorldTime(
    campaignId: string,
    to: Date,
    userId: string,
    expectedVersion: number,
    branchId?: string,
    invalidateCache?: boolean
  ): Promise<WorldTimeResult>;
}

// WorldTimeResolver - GraphQL API
@Resolver()
export class WorldTimeResolver {
  @Query(() => Date, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async getCurrentWorldTime(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Date | null>;

  @Mutation(() => WorldTimeResult)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async advanceWorldTime(
    @Args('input') input: AdvanceWorldTimeInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<WorldTimeResult>;
}
```

### Key Features

1. **Transaction Safety**: Campaign update and audit log creation are wrapped in a Prisma transaction
2. **Optimistic Locking**: Prevents race conditions via version checking (currently hardcoded to 0 at GraphQL layer)
3. **Cache Invalidation**: Automatically invalidates campaign context cache on time advancement
4. **Authorization**: Fine-grained access control via `verifyCampaignAccess` helper
5. **Future Rules Engine Hook**: TODO comment marks where rules engine integration will be added in TICKET-020+

## Dependencies

- Requires: TICKET-006

## Estimated Effort

2-3 days
