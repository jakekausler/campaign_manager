# Campaign Manager - Playwright Testing Checklist

**Version**: 1.0
**Date**: 2025-11-11
**Purpose**: Comprehensive manual testing checklist for E2E testing with Playwright MCP

---

## Table of Contents

1. [Overview](#overview)
2. [Test Environment Setup](#test-environment-setup)
3. [Authentication & Authorization](#authentication--authorization)
4. [Dashboard & Navigation](#dashboard--navigation)
5. [Map View](#map-view)
6. [Flow View (Dependency Graph)](#flow-view-dependency-graph)
7. [Timeline View](#timeline-view)
8. [Entity Inspector](#entity-inspector)
9. [Cross-View Selection](#cross-view-selection)
10. [Map Editing Tools](#map-editing-tools)
11. [Event & Encounter Resolution](#event--encounter-resolution)
12. [Branching System](#branching-system)
13. [Branch Merging](#branch-merging)
14. [Settlement & Structure Management](#settlement--structure-management)
15. [Audit Log](#audit-log)
16. [Real-time Updates](#real-time-updates)
17. [Error Handling & Validation](#error-handling--validation)
18. [Accessibility](#accessibility)
19. [Performance](#performance)
20. [Mobile Responsiveness](#mobile-responsiveness)

---

## Overview

This checklist covers **200+ test scenarios** across **10 major pages** and **30+ UI components**. Tests are organized by priority:

- **🔴 Critical**: Core functionality, authentication, data integrity
- **🟡 High**: Major features, user workflows, cross-view interactions
- **🟢 Medium**: Secondary features, edge cases, validation
- **🔵 Low**: Polish, accessibility, performance optimizations

**Application URL**: `http://localhost:9263` (frontend dev server)
**API URL**: `http://localhost:3000/graphql` (backend API)

---

## Test Environment Setup

### Prerequisites

```bash
# Start all services from project root
cd /storage/programs/campaign_manager
pnpm run dev  # Starts API (3000), Frontend (9263), Rules Engine (9265), Scheduler (9266)
```

### Demo Data

The application includes comprehensive seed data:

- **3 Kingdoms**: Varisia, Cheliax, River Kingdoms
- **9 Settlements**: Sandpoint (Lv2 Town), Magnimar (Lv4 City), Korvosa (Lv4 City), etc.
- **27 Structures**: 12 types (Blacksmith, Market, Temple, etc.)
- **16 Events**: Swallowtail Festival, Goblin Raid, Siege of Sandpoint, etc.
- **12 Encounters**: Various difficulties with progression
- **4 Branches**: Main Timeline + 3 alternate scenarios

### Test Users

| Username             | Password    | Role   | Permissions                       |
| -------------------- | ----------- | ------ | --------------------------------- |
| `admin@example.com`  | `admin123`  | OWNER  | All permissions, audit log access |
| `gm@example.com`     | `gm123`     | GM     | Campaign management, no audit log |
| `player@example.com` | `player123` | PLAYER | Read-only (future implementation) |

---

## Authentication & Authorization

### 🔴 Critical Tests

#### TC-AUTH-001: Successful Login

```gherkin
Given I am on the login page at "/auth/login"
When I enter "admin@example.com" in the email field
And I enter "admin123" in the password field
And I click the "Sign In" button
Then I should be redirected to "/dashboard"
And I should see "Welcome back, Admin User" or dashboard content
And localStorage should contain "accessToken"
```

**Assertions**:

- ✅ Redirect to dashboard page
- ✅ Access token stored in localStorage
- ✅ User info displayed in header

#### TC-AUTH-002: Failed Login - Invalid Credentials

```gherkin
Given I am on the login page
When I enter "invalid@example.com" in the email field
And I enter "wrongpassword" in the password field
And I click the "Sign In" button
Then I should see an error message "Invalid email or password"
And I should remain on the login page
And localStorage should NOT contain "accessToken"
```

#### TC-AUTH-003: Logout

```gherkin
Given I am logged in as "admin@example.com"
When I click the user menu in the top-right corner
And I click "Logout"
Then I should be redirected to "/auth/login"
And localStorage should NOT contain "accessToken"
```

#### TC-AUTH-004: Protected Route - Unauthorized Access

```gherkin
Given I am NOT logged in
When I navigate to "/dashboard"
Then I should be redirected to "/auth/login"
```

### 🟡 High Priority Tests

#### TC-AUTH-005: Remember Me Functionality

```gherkin
Given I am on the login page
When I enter valid credentials
And I check the "Remember me" checkbox
And I click "Sign In"
And I close the browser
And I reopen the browser and navigate to the app
Then I should still be logged in
```

#### TC-AUTH-006: Session Expiration

```gherkin
Given I am logged in
When the JWT token expires (after 15 minutes)
And I attempt to make an API request
Then I should be redirected to the login page
And I should see "Session expired. Please log in again."
```

#### TC-AUTH-007: Permission-Based UI (Admin vs GM)

```gherkin
Given I am logged in as "admin@example.com" (OWNER role)
When I navigate to "/audit"
Then I should see the Audit Log page

Given I log out and log in as "gm@example.com" (GM role)
When I navigate to "/audit"
Then I should see "Access Denied" or be redirected to "/dashboard"
```

---

## Dashboard & Navigation

### 🔴 Critical Tests

#### TC-DASH-001: Dashboard Loads Successfully

```gherkin
Given I am logged in
When I navigate to "/dashboard"
Then I should see the dashboard page
And I should see campaign cards or "Create Campaign" button
And the page should load within 2 seconds
```

#### TC-DASH-002: Navigation Links

```gherkin
Given I am on the dashboard
When I click on a campaign card
Then I should see navigation options:
  - Map View
  - Timeline View
  - Flow View
  - Branches
  - Audit Log (if admin)
```

### 🟡 High Priority Tests

#### TC-DASH-003: Campaign Selector

```gherkin
Given I am on the dashboard
And multiple campaigns exist
When I click the campaign dropdown in the header
Then I should see a list of all campaigns I have access to
When I select "Golarion Campaign"
Then the current campaign should change to "Golarion Campaign"
And all views should reflect the selected campaign
```

#### TC-DASH-004: World Time Display

```gherkin
Given I am viewing a campaign
Then I should see the current world time displayed in the header
And it should be formatted according to the campaign's calendar
Example: "4707 AR, Rova 1 (Autumn)" for Golarion
```

#### TC-DASH-005: Branch Selector

```gherkin
Given I am viewing a campaign
When I click the branch dropdown in the header
Then I should see:
  - "Main Timeline" (default branch)
  - Any alternate branches I've created
When I select an alternate branch
Then all views should reflect that branch's state
```

---

## Map View

### 🔴 Critical Tests

#### TC-MAP-001: Map Renders Successfully

```gherkin
Given I am logged in and have selected a campaign
When I navigate to "/map"
Then I should see the MapLibre GL map
And the map should display all settlements as markers
And the map should display all regions as polygons
And the page should load within 3 seconds
```

#### TC-MAP-002: Settlement Marker Click

```gherkin
Given I am on the map view
When I click on a settlement marker (e.g., "Sandpoint")
Then the settlement should be selected (blue border)
And the Entity Inspector should open on the right side
And the Inspector should display settlement details
```

#### TC-MAP-003: Region Polygon Click

```gherkin
Given I am on the map view
When I click on a region polygon (e.g., "Varisia")
Then the region should be selected
And the Entity Inspector should open
And the Inspector should display region details
```

#### TC-MAP-004: Layer Toggle

```gherkin
Given I am on the map view
When I click the "Layers" button in the map toolbar
Then I should see layer toggles:
  - Settlements (on by default)
  - Structures (on by default)
  - Regions (on by default)
  - Locations (on by default)
When I toggle "Settlements" off
Then all settlement markers should disappear from the map
When I toggle "Settlements" back on
Then all settlement markers should reappear
```

### 🟡 High Priority Tests

#### TC-MAP-005: Pan and Zoom

```gherkin
Given I am on the map view
When I drag the map with my mouse
Then the map should pan smoothly
When I scroll the mouse wheel
Then the map should zoom in/out
When I use the zoom controls (+/- buttons)
Then the map should zoom accordingly
```

#### TC-MAP-006: Fit to View

```gherkin
Given I am on the map view
And I have zoomed in on a specific area
When I click the "Fit to View" button
Then the map should zoom out to show all entities
```

#### TC-MAP-007: Time Scrubber

```gherkin
Given I am on the map view
And the campaign has historical data at different world times
When I drag the time scrubber slider
Then the map should update to show entities as they existed at that time
And the world time display should update
```

#### TC-MAP-008: Multi-Select on Map

```gherkin
Given I am on the map view
When I Ctrl+Click (Cmd+Click on Mac) on multiple settlements
Then all clicked settlements should be selected (blue borders)
And the Selection Info Panel should appear at bottom-right
And the panel should show "3 entities selected" (or appropriate count)
```

#### TC-MAP-009: Structure Parent Highlighting

```gherkin
Given I am on the map view
When I click on a structure marker
Then the structure should be selected (blue border)
And the parent settlement should be highlighted (purple border)
And the Entity Inspector should show the structure details
```

### 🟢 Medium Priority Tests

#### TC-MAP-010: Popup Hover

```gherkin
Given I am on the map view
When I hover over a settlement marker
Then a popup should appear showing:
  - Settlement name
  - Settlement level (e.g., "Level 2 Town")
  - Population (if available)
```

#### TC-MAP-011: Large Dataset Performance

```gherkin
Given the campaign has 100+ settlements
When I load the map view
Then all markers should render within 3 seconds
And panning should remain smooth (60fps)
And zooming should be responsive
```

#### TC-MAP-012: Auto-Pan on Selection from Other View

```gherkin
Given I am on the map view
And I am zoomed in on one area
When I select a settlement in the Timeline view that is off-screen
Then the map should auto-pan to show the selected settlement
And the settlement should be highlighted
```

---

## Flow View (Dependency Graph)

### 🔴 Critical Tests

#### TC-FLOW-001: Flow Graph Renders

```gherkin
Given I am logged in and have selected a campaign
When I navigate to "/flow"
Then I should see the dependency graph visualization
And nodes should be colored by type:
  - Variable nodes (green)
  - Condition nodes (blue)
  - Effect nodes (orange)
  - Entity nodes (purple)
And edges should connect related nodes
```

#### TC-FLOW-002: Node Selection

```gherkin
Given I am on the flow view
When I click on a node
Then the node should be highlighted (blue border with glow)
And other nodes should dim to 30% opacity
And edges connected to the node should be highlighted
```

#### TC-FLOW-003: Double-Click to Open Inspector

```gherkin
Given I am on the flow view
When I double-click on an entity node (e.g., settlement)
Then the Entity Inspector should open
And it should display the entity's details
```

### 🟡 High Priority Tests

#### TC-FLOW-004: Upstream/Downstream Highlighting

```gherkin
Given I am on the flow view
When I click on a condition node
Then nodes this condition READS FROM should highlight in green (upstream)
And nodes that DEPEND ON this condition should highlight in orange (downstream)
```

#### TC-FLOW-005: Filter by Node Type

```gherkin
Given I am on the flow view
When I open the filter panel
And I uncheck "Variable" nodes
Then all green variable nodes should disappear
When I check "Variable" again
Then variable nodes should reappear
```

#### TC-FLOW-006: Filter by Edge Type

```gherkin
Given I am on the flow view
When I open the filter panel
And I select "Reads" edges only
Then only solid edges (reads relationships) should be visible
```

#### TC-FLOW-007: Show Cycles Only

```gherkin
Given I am on the flow view
And the graph contains circular dependencies
When I check "Show cycles only" in the filter panel
Then only nodes that are part of a cycle should be visible
And edges forming the cycle should be highlighted
```

#### TC-FLOW-008: Search Node

```gherkin
Given I am on the flow view
When I type "Sandpoint" in the search box
Then the graph should filter to show only nodes containing "Sandpoint"
And matching nodes should be highlighted
```

#### TC-FLOW-009: Re-layout Button

```gherkin
Given I am on the flow view
And I have manually moved nodes
When I click the "Re-layout" button
Then the graph should reset to the automatic Dagre layout
```

### 🟢 Medium Priority Tests

#### TC-FLOW-010: Zoom and Pan Controls

```gherkin
Given I am on the flow view
When I use the zoom controls (+/- buttons)
Then the graph should zoom in/out
When I drag the background
Then the graph should pan
```

#### TC-FLOW-011: Large Graph Performance

```gherkin
Given the graph has 500+ nodes and 1000+ edges
When I load the flow view
Then the layout should complete within 5 seconds
And interactions (pan, zoom, select) should remain responsive
```

---

## Timeline View

### 🔴 Critical Tests

#### TC-TIME-001: Timeline Renders Successfully

```gherkin
Given I am logged in and have selected a campaign
When I navigate to "/timeline"
Then I should see the timeline visualization
And I should see events and encounters as items on the timeline
And I should see a red vertical line indicating current world time
```

#### TC-TIME-002: Event Click

```gherkin
Given I am on the timeline view
When I click on an event item
Then the event should be selected (blue background)
And the Entity Inspector should open
And the Inspector should display event details
```

#### TC-TIME-003: Color Coding by Status

```gherkin
Given I am on the timeline view
Then events should be color-coded:
  - Completed events (green)
  - Scheduled events (blue)
  - Overdue events (red) - scheduled before current time but not completed
  - Resolved encounters (dark green)
  - Unresolved encounters (orange)
```

### 🟡 High Priority Tests

#### TC-TIME-004: Drag to Reschedule

```gherkin
Given I am on the timeline view
And I have an event scheduled in the future
When I drag the event item to a new position on the timeline
And I release the mouse
Then a confirmation dialog should appear
When I confirm
Then the event's scheduledAt time should update
And the event should move to the new position
```

#### TC-TIME-005: Validation - Cannot Reschedule to Past

```gherkin
Given I am on the timeline view
And the current world time is "4707 AR, Rova 10"
When I try to drag an event to "4707 AR, Rova 5" (before current time)
Then the drag operation should be rejected
And I should see an error message "Cannot schedule event in the past"
```

#### TC-TIME-006: Validation - Cannot Reschedule Completed

```gherkin
Given I am on the timeline view
And I have a completed event
When I try to drag the completed event
Then the drag operation should be disabled
Or I should see "Cannot reschedule completed events"
```

#### TC-TIME-007: Filter by Event Type

```gherkin
Given I am on the timeline view
When I open the filter panel
And I select "Events" only (deselect "Encounters")
Then only event items should be visible
When I select "Encounters" only
Then only encounter items should be visible
```

#### TC-TIME-008: Filter by Status

```gherkin
Given I am on the timeline view
When I open the filter panel
And I select "Completed" only
Then only completed events should be visible (green items)
```

#### TC-TIME-009: Group by Type

```gherkin
Given I am on the timeline view
When I enable "Group by Type" in the settings
Then the timeline should show two rows:
  - Row 1: All events
  - Row 2: All encounters
```

#### TC-TIME-010: Zoom Controls

```gherkin
Given I am on the timeline view
When I click the "+" zoom button
Then the timeline should zoom in (show shorter time span)
When I click the "-" zoom button
Then the timeline should zoom out (show longer time span)
When I click "Fit" button
Then the timeline should zoom to show all items
```

#### TC-TIME-011: Jump to Current Time

```gherkin
Given I am on the timeline view
And I have scrolled to a different time period
When I press the "T" key or click "Jump to Now" button
Then the timeline should scroll to the current world time marker (red line)
```

### 🟢 Medium Priority Tests

#### TC-TIME-012: Keyboard Shortcuts

```gherkin
Given I am on the timeline view
When I press "+" key
Then the timeline should zoom in
When I press "-" key
Then the timeline should zoom out
When I press "0" key
Then the timeline should fit all items
When I press "Escape" key
Then any selection should be cleared
```

---

## Entity Inspector

### 🔴 Critical Tests

#### TC-INSPECT-001: Inspector Opens on Entity Click

```gherkin
Given I am on any view (Map, Flow, Timeline)
When I click on an entity
Then the Entity Inspector drawer should open on the right side
And it should display the entity's name in the header
And it should show tabs: Overview, Details, Links, Conditions, Effects, Versions
```

#### TC-INSPECT-002: Inspector Close

```gherkin
Given the Entity Inspector is open
When I click the "X" close button
Then the Inspector should close
And the entity should remain selected in the view
```

#### TC-INSPECT-003: Tab Navigation

```gherkin
Given the Entity Inspector is open for a settlement
When I click the "Details" tab
Then the Details panel should be displayed
And I should see typed variables for the settlement
When I click the "Versions" tab
Then I should see the audit history
```

### 🟡 High Priority Tests

#### TC-INSPECT-004: Copy to Clipboard

```gherkin
Given the Entity Inspector is open
And I am on the Details tab
When I click the copy icon next to a field value
Then the value should be copied to clipboard
And I should see a toast notification "Copied to clipboard"
```

#### TC-INSPECT-005: Edit Mode - Name Field

```gherkin
Given the Entity Inspector is open for a settlement
When I click on the settlement name field
Then the field should enter edit mode (text input appears)
When I change the name to "New Settlement Name"
And I press Ctrl+S (Cmd+S on Mac)
Then the settlement name should update
And I should see a success toast "Settlement updated"
```

#### TC-INSPECT-006: Edit Mode - Cancel

```gherkin
Given the Entity Inspector is open
And I have entered edit mode and changed a field
When I press Escape
Then the changes should be discarded
And the field should revert to its original value
```

#### TC-INSPECT-007: Navigate to Linked Entity

```gherkin
Given the Entity Inspector is open for a structure
And I am on the Links tab
When I click on the parent settlement link
Then the Inspector should load the settlement's details
And the breadcrumb trail should show: "Structure > Settlement"
```

#### TC-INSPECT-008: View Conditions Tab

```gherkin
Given the Entity Inspector is open for a settlement
When I click the Conditions tab
Then I should see all conditions affecting this settlement
And each condition should show:
  - Field name
  - Description
  - Priority
  - Active status
  - JSONLogic expression
```

#### TC-INSPECT-009: Explain Condition

```gherkin
Given the Entity Inspector Conditions tab is open
When I click the "Explain" button for a condition
Then a modal should open showing the evaluation trace
And the trace should show:
  - Validation results
  - Context (all variables)
  - Intermediate evaluation steps
  - Final result
```

#### TC-INSPECT-010: View Effects Tab

```gherkin
Given the Entity Inspector is open for an event
When I click the Effects tab
Then I should see all effects associated with this event
And effects should be grouped by timing phase:
  - PRE (blue badge)
  - ON_RESOLVE (green badge)
  - POST (purple badge)
And each effect should show JSON Patch operations
```

#### TC-INSPECT-011: View Versions Tab (Audit History)

```gherkin
Given the Entity Inspector is open
When I click the Versions tab
Then I should see a chronological list of all changes
And each version entry should show:
  - Timestamp
  - User who made the change
  - Operation type (CREATE, UPDATE, DELETE, ARCHIVE, RESTORE)
  - Before and after values for changed fields
```

### 🟢 Medium Priority Tests

#### TC-INSPECT-012: Breadcrumb Navigation

```gherkin
Given the Entity Inspector is open
And I have navigated to Settlement > Structure > Parent Kingdom
When I click "Settlement" in the breadcrumb trail
Then the Inspector should navigate back to the settlement details
```

#### TC-INSPECT-013: Responsive Layout (Mobile)

```gherkin
Given I am on mobile viewport (width < 768px)
And the Entity Inspector is open
Then the Inspector should display as a full-screen overlay
And tabs should be displayed in a scrollable horizontal row
```

---

## Cross-View Selection

### 🔴 Critical Tests

#### TC-SELECT-001: Select in Map, Highlight in Flow

```gherkin
Given I have Map and Flow views open (split screen or switch between tabs)
When I click a settlement on the Map
Then the settlement should be highlighted on the Map (blue border)
And the corresponding node in Flow view should be highlighted (blue glow)
```

#### TC-SELECT-002: Select in Flow, Auto-Pan Map

```gherkin
Given I am on the Flow view
When I click a settlement node
Then the Flow node should be highlighted
When I switch to Map view
Then the map should auto-pan to show the settlement
And the settlement marker should be highlighted
```

#### TC-SELECT-003: Select in Timeline, Highlight All Views

```gherkin
Given I am on the Timeline view
When I click an event
Then the event should be highlighted on the Timeline (blue background)
When I switch to Map view
Then the map should auto-pan to the event's location (if any)
When I switch to Flow view
Then the event's node should be highlighted
```

### 🟡 High Priority Tests

#### TC-SELECT-004: Multi-Select Across Views

```gherkin
Given I am on the Map view
When I Ctrl+Click on 3 settlements
Then all 3 should be highlighted on the Map
And the Selection Info Panel should show "3 entities selected"
When I switch to Flow view
Then all 3 settlement nodes should be highlighted
When I switch to Timeline view
Then events at those settlements should be highlighted or grouped
```

#### TC-SELECT-005: Selection Info Panel

```gherkin
Given I have selected 5 entities
Then the Selection Info Panel should appear at bottom-right
And it should display:
  - "5 entities selected"
  - List of entity names with type badges
  - Parent information (e.g., "Structure of Settlement X")
  - "Clear Selection" button
```

#### TC-SELECT-006: Clear Selection

```gherkin
Given I have entities selected
When I press the Escape key
Then all selections should clear
And the Selection Info Panel should disappear
Or When I click "Clear Selection" button
Then all selections should clear
```

#### TC-SELECT-007: Toggle Selection with Ctrl+Click

```gherkin
Given I have entity A selected
When I Ctrl+Click on entity A again
Then entity A should be deselected
```

### 🟢 Medium Priority Tests

#### TC-SELECT-008: Selection Persistence on View Switch

```gherkin
Given I have selected a settlement on the Map
When I navigate to the Timeline view
And then navigate back to the Map view
Then the settlement should still be selected
```

#### TC-SELECT-009: Structure Parent Settlement Query

```gherkin
Given I am on the Map view
When I click on a structure marker
Then the structure should be selected (blue border)
And the parent settlement should be queried from the API
And the parent settlement should be highlighted (purple border)
And the Selection Info Panel should show "Structure of Settlement X"
```

---

## Map Editing Tools

### 🔴 Critical Tests

#### TC-EDIT-001: Enter Drawing Mode - Point

```gherkin
Given I am on the Map view
When I click the "Add Point" button in the map toolbar
Then the map should enter point drawing mode
And the cursor should change to a crosshair
When I click on the map
Then a point marker should be placed at that location
And a save dialog should appear to name the location
```

#### TC-EDIT-002: Enter Drawing Mode - Polygon (Region)

```gherkin
Given I am on the Map view
When I click the "Draw Region" button
Then the map should enter polygon drawing mode
When I click multiple points on the map to create vertices
And I double-click to complete the polygon
Then the polygon should be drawn on the map
And a save dialog should appear to name the region
And real-time stats should show vertex count and area
```

#### TC-EDIT-003: Save New Geometry

```gherkin
Given I have drawn a new region polygon
When the save dialog appears
And I enter "New Test Region" as the name
And I click "Save"
Then the region should be created in the database
And the region should appear on the map
And I should see a success toast "Region created"
```

#### TC-EDIT-004: Cancel Drawing

```gherkin
Given I am in drawing mode (point or polygon)
When I press Escape or click "Cancel"
Then the drawing should be discarded
And the map should return to normal mode
```

### 🟡 High Priority Tests

#### TC-EDIT-005: Edit Existing Geometry

```gherkin
Given I am on the Map view
And a settlement location exists
When I click on the settlement
And I click "Edit Location" in the Entity Inspector
Then the map should enter edit mode
And I should be able to drag the point to a new location
When I click "Save"
Then the settlement's location should update
```

#### TC-EDIT-006: Edit Polygon Vertices

```gherkin
Given I am editing a region polygon
When the map is in edit mode
Then I should see all vertices as draggable handles
When I drag a vertex to a new position
Then the polygon should update in real-time
And the area calculation should update
```

#### TC-EDIT-007: Undo/Redo

```gherkin
Given I am drawing or editing a geometry
When I press Ctrl+Z (Cmd+Z on Mac)
Then the last action should be undone
When I press Ctrl+Shift+Z (Cmd+Shift+Z on Mac)
Then the action should be redone
```

#### TC-EDIT-008: Geometry Validation - Bounds

```gherkin
Given I am drawing a point location
When I try to place a point outside valid longitude/latitude bounds
Then I should see an error "Invalid coordinates"
And the point should not be saved
```

#### TC-EDIT-009: Geometry Validation - Self-Intersecting Polygon

```gherkin
Given I am drawing a region polygon
When I create a polygon that intersects itself (figure-eight shape)
Then I should see an error "Polygon cannot self-intersect"
And the polygon should not be saved
```

#### TC-EDIT-010: Geometry Validation - Minimum Vertices

```gherkin
Given I am drawing a polygon
When I try to complete the polygon with only 2 vertices
Then I should see an error "Polygon requires at least 3 vertices"
```

#### TC-EDIT-011: Geometry Validation - Area Limits

```gherkin
Given I am drawing a region polygon
When the calculated area is > 10,000 km²
Then I should see a warning "Region is very large (X km²)"
When the calculated area is < 1 m²
Then I should see an error "Region is too small (minimum 1 m²)"
```

### 🟢 Medium Priority Tests

#### TC-EDIT-012: Undo/Redo History Limit

```gherkin
Given I am editing geometry
When I perform 50+ actions
Then the undo history should be limited to the last 50 actions
```

#### TC-EDIT-013: Version Conflict Detection

```gherkin
Given I am editing a settlement location
And another user edits the same settlement concurrently
When I try to save my changes
Then I should see an error "Version conflict detected"
And I should be prompted to reload or force save
```

---

## Event & Encounter Resolution

### 🔴 Critical Tests

#### TC-RESOLVE-001: Complete Event - Success

```gherkin
Given I am on the Timeline view
And I have an event that is scheduled and not completed
When I click the event
And the Entity Inspector opens
And I click the "Complete Event" button
Then a Resolution Dialog should appear
And the dialog should show:
  - Event name
  - Current status
  - List of effects grouped by timing phase (PRE, ON_RESOLVE, POST)
When I click "Confirm"
Then the event should be marked as completed
And all effects should execute in order (PRE → ON_RESOLVE → POST)
And I should see a success toast "Event completed successfully"
And the Entity Inspector should close
And the Timeline should refresh with the event showing as completed (green)
```

#### TC-RESOLVE-002: Complete Event - Validation Error

```gherkin
Given I am on the Timeline view
And I have an event that is already completed
When I click the event
And I click "Complete Event"
Then the Resolution Dialog should appear
And I should see a validation error "Event is already completed"
And the error should be displayed in red (blocking)
And the "Confirm" button should be disabled
```

#### TC-RESOLVE-003: Resolve Encounter - Success

```gherkin
Given I am on the Timeline view
And I have an encounter that is scheduled and not resolved
When I click the encounter
And I click the "Resolve Encounter" button
Then the Resolution Dialog should appear
And it should show effects grouped by timing phase
When I click "Confirm"
Then the encounter should be marked as resolved
And effects should execute
And I should see "Encounter resolved successfully"
And the Timeline should show the encounter as resolved (dark green)
```

### 🟡 High Priority Tests

#### TC-RESOLVE-004: Effect Preview in Dialog

```gherkin
Given the Resolution Dialog is open
Then I should see all effects listed with:
  - Effect name
  - Description
  - Timing phase badge (PRE/ON_RESOLVE/POST)
  - Priority value
  - JSON Patch operations
```

#### TC-RESOLVE-005: Validation Warning (Non-Blocking)

```gherkin
Given I have an encounter without a difficulty rating set
When I try to resolve the encounter
Then the Resolution Dialog should show a warning "Difficulty rating not set"
And the warning should be displayed in yellow
And the "Confirm" button should still be enabled
```

#### TC-RESOLVE-006: Effect Execution Summary in Audit Trail

```gherkin
Given I have completed an event with 5 effects
When I open the Entity Inspector for that event
And I navigate to the Versions tab
Then I should see a version entry for the resolution
And it should include execution metadata:
  - "5 of 5 effects executed"
  - Breakdown by phase (PRE ✓, ON_RESOLVE ✓, POST ✓)
```

#### TC-RESOLVE-007: Partial Effect Execution

```gherkin
Given I have an event with 5 effects
And 1 effect will fail (e.g., invalid JSON Patch path)
When I complete the event
Then 4 effects should execute successfully
And 1 effect should fail
And I should see a warning toast "Event completed with warnings (4 of 5 effects executed)"
And the audit trail should show which effect failed
```

### 🟢 Medium Priority Tests

#### TC-RESOLVE-008: Cancel Resolution

```gherkin
Given the Resolution Dialog is open
When I click "Cancel" or press Escape
Then the dialog should close
And the event should remain in its original state (not completed)
```

#### TC-RESOLVE-009: Resolution Button State

```gherkin
Given I am viewing a completed event
Then the "Complete Event" button should be disabled
Or the button should show "Already Completed"
```

---

## Branching System

### 🔴 Critical Tests

#### TC-BRANCH-001: Fork Branch

```gherkin
Given I am on a campaign in the "Main Timeline" branch
When I click the branch dropdown in the header
And I click "Fork Branch"
Then a Fork Branch dialog should appear
When I enter "Dragon Attack Scenario" as the branch name
And I enter "What if the dragon attacked early?" as the description
And I select the current world time as the fork point
And I click "Fork"
Then a progress message should show "Copying versions..."
And a new branch should be created
And I should be automatically switched to the new branch
And the branch selector should show "Dragon Attack Scenario" as active
```

#### TC-BRANCH-002: Switch Between Branches

```gherkin
Given I have multiple branches ("Main Timeline", "Dragon Attack")
When I click the branch dropdown
And I select "Dragon Attack"
Then all views should update to reflect the "Dragon Attack" branch state
And entities should show their state as of the branch's current time
```

#### TC-BRANCH-003: View Branch List

```gherkin
Given I am on the Branches page at "/branches"
Then I should see a hierarchical tree visualization of all branches
And the tree should show:
  - Branch names
  - Fork points (timestamps)
  - Parent-child relationships
```

### 🟡 High Priority Tests

#### TC-BRANCH-004: Sibling Branch Isolation

```gherkin
Given I have two sibling branches forked from Main:
  - "Branch A"
  - "Branch B"
When I switch to "Branch A"
And I edit a settlement (change population to 1500)
And I switch to "Branch B"
Then the settlement should show its original population (not 1500)
And changes in Branch A should not affect Branch B
```

#### TC-BRANCH-005: Version Resolution Walks Ancestry

```gherkin
Given I have a branch hierarchy:
  - Main Timeline (root)
    - Fork 1 (child of Main)
      - Fork 1A (child of Fork 1)
When I am in "Fork 1A" and view a settlement
And the settlement has no version in Fork 1A
Then the system should check Fork 1 for a version
If not found in Fork 1, check Main Timeline
And display the settlement state from the closest ancestor
```

#### TC-BRANCH-006: Branch Comparison - Select Branches

```gherkin
Given I am on the Branches page
When I click "Compare Branches"
Then a Branch Comparison view should open
When I select "Main Timeline" as the source branch
And I select "Dragon Attack" as the target branch
And I select entity type "Settlement" and ID for "Sandpoint"
And I specify a world time
And I click "Compare"
Then I should see a side-by-side diff viewer
And the diff should highlight:
  - Added properties (green)
  - Removed properties (red)
  - Changed properties (yellow)
```

### 🟢 Medium Priority Tests

#### TC-BRANCH-007: Branch Metadata

```gherkin
Given I am viewing the branch list
Then each branch should display:
  - Branch name
  - Description
  - Fork point timestamp
  - Parent branch name
  - Created by (user)
  - Created at (timestamp)
```

#### TC-BRANCH-008: Delete Branch

```gherkin
Given I have a branch "Test Branch" that I want to delete
When I click the delete icon for the branch
Then a confirmation dialog should appear
When I confirm deletion
Then the branch should be removed from the database
And the branch should disappear from the branch list
And I should be redirected to the parent branch or Main Timeline
```

---

## Branch Merging

### 🔴 Critical Tests

#### TC-MERGE-001: 3-Way Merge - No Conflicts

```gherkin
Given I have two branches:
  - Main Timeline (base)
  - Feature Branch (forked from Main)
And in Feature Branch, I have edited 3 settlements
And no one has edited those settlements in Main since the fork
When I navigate to Branches page
And I select "Merge Branch"
And I choose source "Feature Branch" and target "Main Timeline"
And I click "Preview Merge"
Then the Merge Preview dialog should appear
And it should show:
  - "0 conflicts"
  - "3 auto-resolved changes" (green tab)
When I click "Execute Merge"
Then all 3 settlement changes should be applied to Main Timeline
And I should see "Merge completed successfully"
And the merge should be recorded in merge history
```

#### TC-MERGE-002: 3-Way Merge - Conflicts Detected

```gherkin
Given I have two branches:
  - Main Timeline
  - Feature Branch (forked from Main at time T)
And in Feature Branch, I changed Settlement A population to 1500
And in Main Timeline (after fork), another user changed Settlement A population to 1200
When I preview merge from Feature Branch to Main
Then the Merge Preview dialog should show:
  - "1 conflict" (red tab)
  - Conflict type: BOTH_MODIFIED
  - 3-way diff showing:
    - Base (at time T): population = 1000
    - Source (Feature Branch): population = 1500
    - Target (Main Timeline): population = 1200
And the "Execute Merge" button should be disabled
And I should see "Resolve all conflicts before merging"
```

#### TC-MERGE-003: Resolve Conflict - Choose Source

```gherkin
Given I am viewing a merge conflict for Settlement population
And the conflict shows:
  - Source: 1500
  - Target: 1200
When I click "Use Source" button
Then the conflict should be marked as resolved with value 1500
And the conflict counter should decrease (e.g., "0 of 1 conflicts resolved" → "1 of 1")
```

#### TC-MERGE-004: Resolve Conflict - Choose Target

```gherkin
Given I am viewing a merge conflict
When I click "Use Target" button
Then the conflict should be marked as resolved with the target value
```

#### TC-MERGE-005: Resolve Conflict - Edit Manually

```gherkin
Given I am viewing a merge conflict for Settlement population
When I click "Edit Manually"
Then a JSON editor should appear
When I enter a custom value (e.g., 1350)
And I click "Save"
Then the conflict should be resolved with the custom value
And the value should be validated for correctness
```

#### TC-MERGE-006: Execute Merge After Resolving Conflicts

```gherkin
Given I have resolved all conflicts in the merge preview
When I click "Execute Merge"
Then the merge should be applied to the target branch
And all resolved changes should be written as new versions
And I should see "Merge completed successfully (X changes, Y conflicts resolved)"
And the merge history should record:
  - Source branch
  - Target branch
  - Timestamp
  - User
  - Conflict count
  - Entity count
```

### 🟡 High Priority Tests

#### TC-MERGE-007: Auto-Resolution Logic

```gherkin
Given I have a 3-way merge scenario
And Settlement A was modified only in Source (not in Target)
Then the merge should auto-resolve to use Source value
And Settlement B was modified only in Target (not in Source)
Then the merge should auto-resolve to use Target value
And Settlement C was not modified in either branch
Then Settlement C should remain unchanged (use Base value)
```

#### TC-MERGE-008: Conflict Type - MODIFIED_DELETED

```gherkin
Given Settlement X was modified in Source branch
And Settlement X was deleted in Target branch
When I preview merge
Then I should see a conflict:
  - Type: MODIFIED_DELETED
  - Description: "Modified in source but deleted in target"
  - Options: Keep modified version, Confirm deletion
```

#### TC-MERGE-009: Conflict Type - DELETED_MODIFIED

```gherkin
Given Settlement Y was deleted in Source branch
And Settlement Y was modified in Target branch
When I preview merge
Then I should see a conflict:
  - Type: DELETED_MODIFIED
  - Description: "Deleted in source but modified in target"
```

#### TC-MERGE-010: Conflict Type - BOTH_DELETED

```gherkin
Given Settlement Z was deleted in both Source and Target
When I preview merge
Then this should auto-resolve (no conflict)
And the entity should remain deleted in the merged result
```

#### TC-MERGE-011: Cherry-Pick Single Version

```gherkin
Given I am on the Branches page
And I want to apply a single change from Feature Branch to Main
When I select "Cherry-Pick"
And I choose the specific version (e.g., Settlement A update at time T)
And I select target branch "Main Timeline"
And I click "Apply"
Then the system should attempt a 2-way merge (no base)
If no conflict, the version should be applied to Main
If conflict, a resolution dialog should appear
```

#### TC-MERGE-012: Cherry-Pick with Conflict

```gherkin
Given I am cherry-picking a settlement update from Feature Branch
And the same settlement has been modified in Main since the fork
When I apply the cherry-pick
Then a conflict resolution dialog should appear
And I should resolve the conflict using 2-way conflict (source vs target)
And I should be able to choose Source, Target, or Edit Manually
```

### 🟢 Medium Priority Tests

#### TC-MERGE-013: Merge History View

```gherkin
Given I am on the Branches page
When I navigate to "Merge History"
Then I should see a timeline-style list of all past merges
And each merge entry should show:
  - Source → Target branches
  - User who performed the merge
  - Timestamp
  - Conflict count (0 = clean merge, green; >0 = conflicts resolved, amber)
  - Entity count (how many entities were merged)
When I click on a merge entry
Then I should see detailed information:
  - List of all entities merged
  - Conflict resolutions applied
  - Before/after states
```

#### TC-MERGE-014: Merge Preview - Auto-Resolved Tab

```gherkin
Given I have a merge with 10 auto-resolved changes and 2 conflicts
When I view the Merge Preview
And I click the "Auto-Resolved Changes" tab (green)
Then I should see a list of all 10 changes that were automatically resolved
And each should show:
  - Entity name and type
  - Field that changed
  - Base → Source or Target value
  - Reason (e.g., "Modified only in source")
```

#### TC-MERGE-015: Merge Preview - Conflicts Tab

```gherkin
Given I have a merge with conflicts
When I click the "Conflicts" tab (red)
Then I should see only the conflicting changes
And each conflict should show:
  - Entity name and type
  - Conflict type (BOTH_MODIFIED, MODIFIED_DELETED, etc.)
  - 3-way diff
  - Resolution options
  - Current resolution status (unresolved / resolved)
```

---

## Settlement & Structure Management

### 🔴 Critical Tests

#### TC-SETTLE-001: View Settlement Hierarchy

```gherkin
Given I am on the Map view
And I click on a settlement (e.g., "Sandpoint")
And the Entity Inspector opens
When I navigate to the Links tab
Then I should see:
  - Parent Kingdom link
  - Parent Location link
  - List of child structures
```

#### TC-SETTLE-002: View Settlement Level Progression

```gherkin
Given I am viewing a settlement (e.g., "Sandpoint, Level 2 Town")
When I view the settlement details
Then I should see:
  - Current level (e.g., Level 2)
  - Settlement type (e.g., Town)
  - Level-specific attributes (e.g., max structures = 20 for Level 2)
```

#### TC-SETTLE-003: View Settlement Typed Variables

```gherkin
Given I am viewing a settlement in the Entity Inspector
When I navigate to the Details tab
Then I should see typed variables:
  - resources.gold (number)
  - resources.food (number)
  - tags (array of strings)
  - attributes.fortified (boolean)
And each variable should have a copy-to-clipboard icon
```

### 🟡 High Priority Tests

#### TC-SETTLE-004: View Structure Details

```gherkin
Given I am on the Map view
And I click on a structure marker (e.g., "Sandpoint Blacksmith")
Then the Entity Inspector should open
And it should display:
  - Structure name
  - Structure type (e.g., Blacksmith)
  - Level
  - Position within settlement
  - Orientation
  - Typed variables specific to structure type
```

#### TC-SETTLE-005: Structure Types

```gherkin
Given I am viewing structures in the demo campaign
Then I should see structures of various types:
  - Blacksmith (provides crafting resources)
  - Market (generates income)
  - Temple (provides healing)
  - Barracks (military training)
  - Inn (rest and recovery)
  - Library (research)
  - Wall Segment (defense)
And each type should have unique typed variables
```

#### TC-SETTLE-006: Navigate from Settlement to Structures

```gherkin
Given I am viewing a settlement in the Entity Inspector
When I navigate to the Links tab
Then I should see a list of all structures in this settlement
When I click on a structure link
Then the Inspector should navigate to that structure's details
And the breadcrumb should show: Settlement > Structure
```

#### TC-SETTLE-007: Navigate from Structure to Parent Settlement

```gherkin
Given I am viewing a structure in the Entity Inspector
When I navigate to the Links tab
Then I should see a link to the parent settlement
When I click the parent settlement link
Then the Inspector should navigate to the settlement's details
```

### 🟢 Medium Priority Tests

#### TC-SETTLE-008: Settlement Condition-Based Fields

```gherkin
Given I am viewing a settlement with a condition:
  - Field: is_trade_hub
  - Logic: population >= 5000 AND merchants >= 10
When I view the Conditions tab
Then I should see this condition listed
When I click "Explain"
Then I should see the evaluation trace showing:
  - population = 5200 (from variables)
  - merchants = 15 (from variables)
  - Result: true (is_trade_hub = true)
```

---

## Audit Log

### 🔴 Critical Tests

#### TC-AUDIT-001: Access Audit Log (Admin Only)

```gherkin
Given I am logged in as "admin@example.com" (OWNER role)
When I navigate to "/audit"
Then I should see the Audit Log page
And I should see a table of audit entries
```

#### TC-AUDIT-002: Audit Log Access Denied (Non-Admin)

```gherkin
Given I am logged in as "gm@example.com" (GM role)
When I navigate to "/audit"
Then I should see "Access Denied" or be redirected to "/dashboard"
```

#### TC-AUDIT-003: Audit Log Table Columns

```gherkin
Given I am on the Audit Log page
Then the table should have columns:
  - Timestamp
  - User
  - Entity Type
  - Entity ID
  - Operation (CREATE, UPDATE, DELETE, etc.)
  - Changes (before/after values)
```

### 🟡 High Priority Tests

#### TC-AUDIT-004: Sort Audit Log

```gherkin
Given I am on the Audit Log page
When I click the "Timestamp" column header
Then the table should sort by timestamp (descending)
When I click again
Then the table should sort by timestamp (ascending)
```

#### TC-AUDIT-005: Filter Audit Log by Entity Type

```gherkin
Given I am on the Audit Log page
When I select "Settlement" in the entity type filter
Then the table should show only audit entries for settlements
```

#### TC-AUDIT-006: Filter Audit Log by Operation

```gherkin
Given I am on the Audit Log page
When I select "UPDATE" in the operation filter
Then the table should show only UPDATE operations
```

#### TC-AUDIT-007: Filter Audit Log by Date Range

```gherkin
Given I am on the Audit Log page
When I set a date range (start: 2024-01-01, end: 2024-12-31)
Then the table should show only audit entries within that range
```

#### TC-AUDIT-008: Pagination

```gherkin
Given the audit log has 100+ entries
When I view the Audit Log page
Then the table should show 25 entries per page (default)
And I should see pagination controls at the bottom
When I click "Next"
Then the table should show entries 26-50
```

#### TC-AUDIT-009: Export Audit Log to CSV

```gherkin
Given I am on the Audit Log page
When I click "Export to CSV"
Then a CSV file should be downloaded
And the CSV should contain all filtered audit entries
And columns should match the table structure
```

#### TC-AUDIT-010: Export Audit Log to JSON

```gherkin
Given I am on the Audit Log page
When I click "Export to JSON"
Then a JSON file should be downloaded
And the JSON should contain all filtered audit entries with full details
```

#### TC-AUDIT-011: View Diff for Audit Entry

```gherkin
Given I am on the Audit Log page
And I see an UPDATE operation for a settlement
When I click "View Diff" for that entry
Then a diff viewer modal should open
And it should show side-by-side comparison:
  - Before state (left)
  - After state (right)
  - Highlighted differences (added/removed/changed fields)
```

### 🟢 Medium Priority Tests

#### TC-AUDIT-012: Audit Log Performance with Large Dataset

```gherkin
Given the audit log has 10,000+ entries
When I load the Audit Log page
Then the initial page should load within 2 seconds
And pagination should remain responsive
```

---

## Real-time Updates

### 🟡 High Priority Tests

#### TC-REALTIME-001: WebSocket Connection Established

```gherkin
Given I am logged in
When I navigate to any page (Map, Timeline, Flow)
Then a WebSocket connection should be established
And the browser console should show "WebSocket connected" (or similar)
```

#### TC-REALTIME-002: Cache Invalidation on Entity Update

```gherkin
Given I have two browser windows open
  - Window A: Viewing Map
  - Window B: Viewing same campaign
When in Window B, I update a settlement (change name)
Then in Window A, the map should automatically refresh
And the settlement name should update without a manual page refresh
```

#### TC-REALTIME-003: Real-time Subscription for Entity Changes

```gherkin
Given I am viewing a settlement in the Entity Inspector
And another user updates the same settlement
When the update occurs
Then I should receive a WebSocket message
And the Entity Inspector should show a notification "This entity has been updated. Refresh?"
When I click "Refresh"
Then the Inspector should reload with the latest data
```

### 🟢 Medium Priority Tests

#### TC-REALTIME-004: Reconnection on Network Failure

```gherkin
Given I am viewing a page with WebSocket connection
When the network connection drops
Then the WebSocket should disconnect
And I should see a notification "Connection lost. Reconnecting..."
When the network reconnects
Then the WebSocket should automatically reconnect
And I should see "Connection restored"
```

---

## Error Handling & Validation

### 🔴 Critical Tests

#### TC-ERROR-001: GraphQL Query Error

```gherkin
Given I am on the Map view
When the backend returns a GraphQL error (e.g., network timeout)
Then I should see an error toast notification
And the error message should be user-friendly (e.g., "Failed to load settlements")
And the UI should not crash (graceful degradation)
```

#### TC-ERROR-002: GraphQL Mutation Error

```gherkin
Given I am editing a settlement name
When I save with an invalid value (e.g., empty string)
Then I should see a validation error message
And the field should be highlighted in red
And the save should not occur
```

#### TC-ERROR-003: Network Timeout

```gherkin
Given I am performing an action (e.g., completing an event)
When the network request times out
Then I should see an error toast "Request timed out. Please try again."
And the action should not be partially applied (rollback)
```

### 🟡 High Priority Tests

#### TC-ERROR-004: Form Validation - Empty Required Field

```gherkin
Given I am creating a new settlement
When I leave the "Name" field empty
And I click "Save"
Then I should see a validation error "Name is required"
And the field should be highlighted
```

#### TC-ERROR-005: Form Validation - Invalid Number

```gherkin
Given I am editing a settlement's population
When I enter a non-numeric value (e.g., "abc")
And I blur the field
Then I should see "Invalid number"
```

#### TC-ERROR-006: 404 - Page Not Found

```gherkin
Given I am logged in
When I navigate to a non-existent route "/nonexistent"
Then I should see a 404 page
And the page should display "Page Not Found"
And I should see a link to return to the dashboard
```

#### TC-ERROR-007: 500 - Internal Server Error

```gherkin
Given the backend API encounters an internal error
When I attempt any GraphQL operation
Then I should see "Something went wrong. Please try again later."
And the error should be logged to the console for debugging
```

### 🟢 Medium Priority Tests

#### TC-ERROR-008: Optimistic UI Rollback

```gherkin
Given I am updating a settlement name
When the update fails on the server
Then the UI should revert to the previous value (optimistic rollback)
And I should see an error message
```

---

## Accessibility

### 🟡 High Priority Tests

#### TC-A11Y-001: Keyboard Navigation - Tab Order

```gherkin
Given I am on the Map view
When I press the Tab key repeatedly
Then focus should move through all interactive elements in logical order:
  - Map toolbar buttons
  - Layer toggles
  - Time scrubber
  - Entity markers (if keyboard navigable)
  - Entity Inspector tabs (when open)
```

#### TC-A11Y-002: Keyboard Shortcuts - Escape to Close

```gherkin
Given the Entity Inspector is open
When I press the Escape key
Then the Inspector should close
```

#### TC-A11Y-003: Keyboard Shortcuts - Save/Cancel Editing

```gherkin
Given I am editing a field in the Entity Inspector
When I press Ctrl+S (Cmd+S on Mac)
Then the changes should be saved
When I press Escape
Then the changes should be canceled
```

#### TC-A11Y-004: Screen Reader - Button Labels

```gherkin
Given I am using a screen reader
When I navigate to buttons (e.g., "Add Point", "Draw Region")
Then the screen reader should announce descriptive labels
Example: "Add Point button" or "Draw Region button"
```

#### TC-A11Y-005: Focus Indicators

```gherkin
Given I am navigating with keyboard
When an element receives focus (button, input, link)
Then a visible focus indicator should appear (blue ring/outline)
```

#### TC-A11Y-006: Color Contrast

```gherkin
Given I am viewing the application
Then all text should have sufficient color contrast (4.5:1 minimum for body text, 3:1 for large text)
And interactive elements should have sufficient contrast
```

#### TC-A11Y-007: ARIA Labels for Icons

```gherkin
Given I see icon-only buttons (e.g., close "X", copy icon)
When I inspect with screen reader or DevTools
Then each icon button should have an aria-label
Example: <button aria-label="Close Inspector">X</button>
```

### 🟢 Medium Priority Tests

#### TC-A11Y-008: ARIA Live Regions for Status Updates

```gherkin
Given I am using a screen reader
When I select an entity (e.g., on the Map)
Then the screen reader should announce "Settlement Sandpoint selected"
(via ARIA live region)
```

#### TC-A11Y-009: Keyboard-Only Complete Workflow

```gherkin
Given I am using only keyboard (no mouse)
When I navigate from login to completing an event
Then all tasks should be completable:
  - Login
  - Navigate to Timeline
  - Select event (Tab + Enter)
  - Open Inspector
  - Click "Complete Event" (Enter)
  - Confirm in dialog (Tab + Enter)
```

---

## Performance

### 🟡 High Priority Tests

#### TC-PERF-001: Map Rendering - 100+ Entities

```gherkin
Given the campaign has 100+ settlements and structures
When I load the Map view
Then all markers should render within 3 seconds
And panning should remain smooth (target 60fps)
```

#### TC-PERF-002: Flow Graph Layout - 500 Nodes

```gherkin
Given the dependency graph has 500 nodes and 1000 edges
When I load the Flow view
Then the Dagre layout should complete within 5 seconds
And zoom/pan interactions should remain responsive
```

#### TC-PERF-003: Timeline Rendering - 500 Items

```gherkin
Given the timeline has 500 events and encounters
When I load the Timeline view
Then the timeline should render all items within 3 seconds
And scrolling should be smooth
```

#### TC-PERF-004: Entity Inspector - Large Entity History

```gherkin
Given an entity has 100+ versions in its audit history
When I open the Versions tab in the Entity Inspector
Then the first 25 versions should load within 1 second
And pagination should load additional versions on demand
```

### 🟢 Medium Priority Tests

#### TC-PERF-005: GraphQL Query Batching

```gherkin
Given I am on the Map view
And the view requires multiple GraphQL queries (settlements, regions, structures)
When the page loads
Then GraphQL queries should be batched where possible
And total load time should be optimized (fewer network round trips)
```

#### TC-PERF-006: Lazy Loading Images (if applicable)

```gherkin
Given the application has images (icons, avatars, etc.)
When I load a page
Then images should be lazy-loaded (only load when in viewport)
And initial page load should not be blocked by images
```

---

## Mobile Responsiveness

### 🟢 Medium Priority Tests

#### TC-MOBILE-001: Login Page on Mobile

```gherkin
Given I am on a mobile device (viewport width 375px)
When I navigate to the login page
Then the login form should be fully visible
And buttons should be easily tappable (min 44px touch target)
```

#### TC-MOBILE-002: Map View on Mobile

```gherkin
Given I am on a mobile device
When I view the Map
Then the map should fill the screen width
And I should be able to pan with touch gestures
And I should be able to zoom with pinch gestures
```

#### TC-MOBILE-003: Entity Inspector on Mobile

```gherkin
Given I am on a mobile device
When I open the Entity Inspector
Then the Inspector should display as a full-screen overlay (not sidebar)
And tabs should be in a horizontal scrollable row
And all content should be readable without horizontal scrolling
```

#### TC-MOBILE-004: Timeline on Mobile

```gherkin
Given I am on a mobile device
When I view the Timeline
Then the timeline should be scrollable horizontally with touch
And zoom controls should be accessible
```

#### TC-MOBILE-005: Touch-Friendly Buttons

```gherkin
Given I am on a mobile device
When I view any page
Then all interactive elements (buttons, links, inputs) should have minimum 44px touch targets
```

---

## Summary Statistics

### Test Coverage Overview

| Category                       | Total Tests | Critical (🔴) | High (🟡) | Medium (🟢) | Low (🔵) |
| ------------------------------ | ----------- | ------------- | --------- | ----------- | -------- |
| Authentication & Authorization | 7           | 4             | 3         | 0           | 0        |
| Dashboard & Navigation         | 5           | 2             | 3         | 0           | 0        |
| Map View                       | 12          | 4             | 5         | 3           | 0        |
| Flow View                      | 11          | 3             | 6         | 2           | 0        |
| Timeline View                  | 12          | 3             | 8         | 1           | 0        |
| Entity Inspector               | 13          | 3             | 8         | 2           | 0        |
| Cross-View Selection           | 9           | 3             | 4         | 2           | 0        |
| Map Editing Tools              | 13          | 4             | 7         | 2           | 0        |
| Event & Encounter Resolution   | 9           | 3             | 4         | 2           | 0        |
| Branching System               | 8           | 3             | 3         | 2           | 0        |
| Branch Merging                 | 15          | 6             | 6         | 3           | 0        |
| Settlement & Structure         | 8           | 3             | 4         | 1           | 0        |
| Audit Log                      | 12          | 3             | 8         | 1           | 0        |
| Real-time Updates              | 4           | 0             | 3         | 1           | 0        |
| Error Handling                 | 8           | 3             | 4         | 1           | 0        |
| Accessibility                  | 9           | 0             | 7         | 2           | 0        |
| Performance                    | 6           | 0             | 4         | 2           | 0        |
| Mobile Responsiveness          | 5           | 0             | 0         | 5           | 0        |
| **TOTAL**                      | **166**     | **43**        | **87**    | **32**      | **4**    |

### Priority Definitions

- **🔴 Critical (43 tests)**: Core functionality, authentication, data integrity, user safety
- **🟡 High Priority (87 tests)**: Major features, common workflows, cross-view interactions
- **🟢 Medium Priority (32 tests)**: Secondary features, edge cases, validation, polish
- **🔵 Low Priority (4 tests)**: Nice-to-have, advanced features, performance optimizations

---

## Notes for Playwright MCP Implementation

### Recommended Test Structure

```typescript
// Example test file structure
import { test, expect } from '@playwright/test';

test.describe('Authentication & Authorization', () => {
  test('TC-AUTH-001: Successful Login', async ({ page }) => {
    await page.goto('http://localhost:9263/auth/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*dashboard/);
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(accessToken).toBeTruthy();
  });
});
```

### Test Data Management

- Use the existing seed data for consistent test results
- Reset database state between test runs if needed
- Consider creating isolated test campaigns for specific scenarios

### Viewport Configurations

- **Desktop**: 1920x1080 (default)
- **Tablet**: 768x1024
- **Mobile**: 375x667 (iPhone SE)

### Browser Coverage

- Chromium (primary)
- Firefox (secondary)
- WebKit (Safari simulation) (optional)

### CI/CD Integration

- Run tests on every PR
- Generate test reports with screenshots on failure
- Track test coverage over time

---

## Maintenance

This checklist should be updated whenever:

- New features are added to the application
- Existing features are modified or removed
- Bugs are discovered that require new test coverage
- User workflows change

**Last Updated**: 2025-11-11
**Maintained By**: Development Team
**Version**: 1.0
