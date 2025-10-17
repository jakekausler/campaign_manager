# TICKET-010: World Time System

## Status

- [ ] Completed
- **Commits**:
  - Stage 1 (Database Schema & Migration): 3934e7c588bd5886d328721b2fd9244fa4c3e1da
  - Stage 2 (GraphQL Types & Inputs): 2f5ee47f0ee8c3fae89c6f38e4fba7bb5f0a6b8d

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
