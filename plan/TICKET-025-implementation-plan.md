# TICKET-025 Implementation Plan

## Stage 1: Create EventPanel and EncounterPanel Components

**Goal**: Build panel components for displaying Event and Encounter entity-specific details
**Success Criteria**: EventPanel and EncounterPanel render all metadata fields with proper formatting
**Tests**: Component unit tests verify field display, copy-to-clipboard, empty states, and accessibility
**Status**: Not Started

## Stage 2: Expand EntityInspector to Support Events and Encounters

**Goal**: Update EntityInspector to recognize and render Event/Encounter entity types
**Success Criteria**: EntityInspector opens with EventPanel/EncounterPanel in Details tab for event/encounter entities
**Tests**: EntityInspector tests verify correct panel rendering, tab navigation, and data passing for new entity types
**Status**: Not Started

## Stage 3: Integrate Event/Encounter Inspector with TimelinePage

**Goal**: Connect timeline item selection to EntityInspector for events and encounters
**Success Criteria**: Clicking timeline items opens EntityInspector with correct entity type and ID
**Tests**: Integration tests verify timeline → inspector flow, state management, and proper entity data loading
**Status**: Not Started

## Stage 4: Create Resolution Workflow UI

**Goal**: Build UI for marking events/encounters as resolved with confirmation
**Success Criteria**: Resolution button appears in inspector, confirmation dialog, triggers backend mutation
**Tests**: UI tests verify button states, confirmation flow, loading states, error handling
**Status**: Not Started

## Stage 5: Implement Pre/Post/OnResolve Effect Execution

**Goal**: Connect resolution workflow to effect execution system
**Success Criteria**: Resolving event/encounter triggers effects in correct order (PRE → ON_RESOLVE → POST)
**Tests**: Integration tests verify effect execution order, phase grouping, execution history creation
**Status**: Not Started

## Stage 6: Add Resolution Validation

**Goal**: Validate resolution preconditions (status checks, permissions, world state)
**Success Criteria**: Validation errors prevent invalid resolutions with helpful messages
**Tests**: Unit tests verify validation logic, error messages, edge cases
**Status**: Not Started

## Stage 7: Create Resolution History Tracking

**Goal**: Display resolution audit trail in Versions tab
**Success Criteria**: Versions tab shows resolution events with timestamps, user, effects executed
**Tests**: Component tests verify history display, chronological ordering, empty states
**Status**: Not Started

## Stage 8: Implement Rollback Capability

**Goal**: Allow undoing resolution and reverting effects (soft delete pattern)
**Success Criteria**: Rollback button appears for recent resolutions, reverses world state changes
**Tests**: Integration tests verify rollback workflow, state restoration, audit trail preservation
**Status**: Not Started

## Stage 9: Add Resolution Notifications

**Goal**: Create notification system for resolution events (toast messages)
**Success Criteria**: Success/error notifications appear on resolution, include summary of effects applied
**Tests**: UI tests verify notification display, timing, dismissal
**Status**: Not Started

## Stage 10: Testing and Documentation

**Goal**: Comprehensive testing, feature documentation, and polish
**Success Criteria**: All tests passing, feature documented in docs/features/, README updated
**Tests**: E2E tests verify complete resolution workflow from timeline to effects to audit trail
**Status**: Not Started
