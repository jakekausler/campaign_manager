# TICKET-022: Timeline View Implementation

## Status

- [ ] Completed
- **Commits**: 3273623 (Stage 1), 466e13e (Stage 2), 0e8b1ef (Stage 3), 0673f47 (Stage 4), 347b057 (Stage 5), fd8f766 (Stage 6), 5f7a863 (Stage 7), 0e8b1ef (Stage 8 - completed proactively in Stage 3), 3fd3bbb (Stage 9)

## Description

Implement timeline view showing events and encounters over world-time with availability overlays and drag-to-reschedule functionality.

## Scope of Work

1. Install vis-timeline or react-calendar-timeline
2. Create Timeline component
3. Implement event/encounter visualization
4. Add availability overlay colors
5. Implement drag to reschedule
6. Add zoom and pan controls
7. Create lane grouping (by type, region, etc.)
8. Add time marker for "current" world time

## Acceptance Criteria

- [ ] Timeline shows events/encounters
- [ ] Time range is adjustable
- [ ] Dragging updates valid_from/valid_to
- [ ] Availability shown with color coding
- [ ] Current time marker visible
- [ ] Lanes group related items

## Dependencies

- Requires: TICKET-007, TICKET-018

## Estimated Effort

4-5 days

## Implementation Notes

### Stage 8: Availability Color Coding (Completed Proactively)

**Status**: Completed in Stage 3 (commit 0e8b1ef)

Stage 8 was completed proactively during Stage 3 when the timeline transformation utilities were created. All color coding logic was implemented in `getEventColor()` and `getEncounterColor()` functions in `timeline-transforms.ts`.

**Color Scheme Implemented**:

- Completed events: #10b981 (green-500)
- Scheduled events: #3b82f6 (blue-500)
- Overdue events: #ef4444 (red-500)
- Resolved encounters: #059669 (green-600)
- Unresolved encounters: #f97316 (orange-500)

**Test Coverage**: 19/19 tests passing in timeline-transforms.test.ts, including:

- Completed event color test (line 33)
- Scheduled event color test (line 59)
- Overdue event color test (line 79)
- Resolved encounter color test (line 167)
- Status tooltips for all states

Documentation updated in commit 2a2cefb.

---

### Stage 9: Backend Support for Encounter Scheduling

**Status**: Completed (commit 3fd3bbb)

Implemented scheduledAt field for Encounter model, enabling unresolved encounters to appear on the timeline at their scheduled date/time.

**Backend Changes**:

- Added `scheduledAt DateTime?` field to Encounter Prisma model with index for query optimization
- Created migration `20251020015036_add_encounter_scheduled_at`
- Updated Encounter GraphQL type to expose scheduledAt field
- Modified CreateEncounterInput and UpdateEncounterInput to accept optional scheduledAt parameter
- Updated UpdateEncounterData interface for type consistency
- Enhanced EncounterService.create() to handle scheduledAt field
- Enhanced EncounterService.update() to handle scheduledAt field updates
- Added scheduledAt to audit logs for change tracking
- All TypeScript compilation checks passed

**Frontend Changes**:

- Updated Encounter TypeScript interface to include scheduledAt field
- Modified transformEncounterToTimelineItem() to prioritize resolvedAt for resolved encounters, otherwise use scheduledAt
- Updated GET_ENCOUNTERS_BY_CAMPAIGN GraphQL query to fetch scheduledAt
- Removed TODO comments noting Stage 9 implementation

**Timeline Behavior**:

- Resolved encounters display at resolvedAt timestamp (unchanged)
- Scheduled encounters now display at scheduledAt timestamp (new)
- Encounters without any valid date are filtered out (return null)
- Resolved encounters remain non-editable (editable: false)

**Testing**:

- Type-check passed with no compilation errors
- All pre-commit hooks (formatting, linting) passed
- Integration testing verified create/update/query operations work correctly with scheduledAt

**Next Steps**:

This completes the foundation for drag-to-reschedule functionality planned for Stage 10.
