# TICKET-010: World Time System

## Status

- [ ] Completed
- **Commits**:
  - Stage 1 (Database Schema & Migration): 3934e7c588bd5886d328721b2fd9244fa4c3e1da

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
