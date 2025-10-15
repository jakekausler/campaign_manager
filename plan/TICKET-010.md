# TICKET-010: World Time System

## Status
- [ ] Completed
- **Commits**:

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
