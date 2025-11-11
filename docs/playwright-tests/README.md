# Playwright E2E Tests - Campaign Manager

**Version**: 1.0
**Last Updated**: 2025-11-11
**Status**: In Progress

---

## Overview

This directory contains end-to-end tests for the Campaign Manager application using Playwright. The tests are organized by feature area and prioritized by criticality.

**Total Test Cases**: 166 tests across 18 test files
**Implemented**: 0/166 (0%)
**Remaining**: 166 tests

---

## Quick Start

### Prerequisites

```bash
# Ensure application is running
cd /storage/programs/campaign_manager
pnpm run dev  # Starts all services

# Application URLs
# Frontend: http://localhost:9263
# API: http://localhost:3000/graphql
# Rules Engine: http://localhost:9265
# Scheduler: http://localhost:9266
```

### Test Credentials

| Username             | Password    | Role   | Permissions                       | Use For                                    |
| -------------------- | ----------- | ------ | --------------------------------- | ------------------------------------------ |
| `admin@example.com`  | `admin123`  | OWNER  | All permissions, audit log access | Admin/OWNER tests, audit log tests         |
| `gm@example.com`     | `gm123`     | GM     | Campaign management, no audit log | GM permission tests, general feature tests |
| `player@example.com` | `player123` | PLAYER | Read-only (future)                | Future player permission tests             |

**Default Test User**: Use `admin@example.com` / `admin123` for most tests unless testing specific permissions.

### Demo Campaign Data

The application includes comprehensive seed data for testing:

#### Campaigns

- **Golarion Campaign** (default test campaign)
  - World time: 4707 AR, Rova 1 (Autumn)
  - Calendar: Absalom Reckoning
  - 4 branches: Main Timeline + 3 alternates

#### Kingdoms

- **Varisia** (northwest region)
- **Cheliax** (devil-ruled empire)
- **River Kingdoms** (anarchic region)

#### Settlements (9 total)

| Settlement         | Level | Type       | Kingdom        | Population | Notable Features                          |
| ------------------ | ----- | ---------- | -------------- | ---------- | ----------------------------------------- |
| **Sandpoint**      | 2     | Town       | Varisia        | 1,240      | Default test settlement, has 5 structures |
| **Magnimar**       | 4     | City       | Varisia        | 16,428     | Major city                                |
| **Korvosa**        | 4     | City       | Varisia        | 18,486     | Capital of Varisia                        |
| **Riddleport**     | 3     | Large Town | Varisia        | 3,500      | Pirate haven                              |
| **Roderic's Cove** | 1     | Village    | Varisia        | 450        | Small settlement                          |
| **Westcrown**      | 4     | City       | Cheliax        | 55,000     | Former capital                            |
| **Egorian**        | 5     | Metropolis | Cheliax        | 82,000     | Current capital                           |
| **Daggermark**     | 3     | Large Town | River Kingdoms | 4,200      | Assassin city                             |
| **Pitax**          | 3     | Large Town | River Kingdoms | 3,800      | Bandit kingdom                            |

**Best Settlement for Tests**: Use **Sandpoint** (Level 2 Town) for most tests as it has:

- Moderate complexity (5 structures)
- Well-documented in user guides
- Featured in tutorial walkthroughs
- Represents typical mid-level settlement

#### Structures (27 total, 12 types)

**Sandpoint Structures** (use for testing):

- Sandpoint Blacksmith (type: Blacksmith)
- Sandpoint Market (type: Market)
- Sandpoint Temple (type: Temple)
- Sandpoint Barracks (type: Barracks)
- Sandpoint Inn (type: Inn)

**Structure Types Available**:

- Blacksmith, Market, Temple, Barracks, Inn, Library, Wall Segment, Watchtower, Granary, Mine, Workshop, Docks

#### Events (16 total)

**Key Test Events**:

- **Swallowtail Festival** (Sandpoint, completed)
- **Goblin Raid** (Sandpoint, scheduled future)
- **Siege of Sandpoint** (Sandpoint, has effects)
- **Trade Caravan Arrival** (Magnimar, recurring)
- **Dragon Sighting** (Varisia region, overdue)

**Event Statuses for Testing**:

- Completed events (green): Use for history/audit tests
- Scheduled future events (blue): Use for resolution workflow tests
- Overdue events (red): Use for validation/alert tests

#### Encounters (12 total)

**Test Encounters by Difficulty**:

- Easy (1-2): Goblin Scout, Wolf Pack
- Medium (3-4): Bandit Ambush, Troll Attack
- Hard (5-6): Dragon Attack, Demon Raid
- Deadly (7-8): Lich Encounter, Tarrasque Sighting

#### Branches (4 total)

- **Main Timeline** (root branch, default)
- **Dragon Attack Alternate** (forked from Main, what-if dragon scenario)
- **Peaceful Resolution** (forked from Main, diplomatic path)
- **Siege Outcome Branch** (forked from Main, siege aftermath)

**Use for Testing**: Branch switching, merge conflicts, version resolution

---

## Test File Organization

### Test Files (18 files, 166 tests total)

| File                    | Tests | Priority    | Status         | Description                                |
| ----------------------- | ----- | ----------- | -------------- | ------------------------------------------ |
| `auth.spec.ts`          | 7     | 🔴 Critical | ❌ Not Started | Login, logout, session, permissions        |
| `dashboard.spec.ts`     | 5     | 🔴 Critical | ❌ Not Started | Dashboard, navigation, campaign selector   |
| `map-view.spec.ts`      | 12    | 🔴🟡 Mixed  | ❌ Not Started | Map rendering, markers, layers, zoom       |
| `flow-view.spec.ts`     | 11    | 🟡 High     | ❌ Not Started | Dependency graph, node selection, filters  |
| `timeline.spec.ts`      | 12    | 🔴🟡 Mixed  | ❌ Not Started | Timeline rendering, drag-to-reschedule     |
| `inspector.spec.ts`     | 13    | 🔴🟡 Mixed  | ❌ Not Started | Entity Inspector tabs, editing, navigation |
| `selection.spec.ts`     | 9     | 🔴🟡 Mixed  | ❌ Not Started | Cross-view selection synchronization       |
| `editing.spec.ts`       | 13    | 🔴🟡 Mixed  | ❌ Not Started | Map geometry editing, undo/redo            |
| `resolution.spec.ts`    | 9     | 🔴🟡 Mixed  | ❌ Not Started | Event/encounter resolution, effects        |
| `branching.spec.ts`     | 8     | 🔴🟡 Mixed  | ❌ Not Started | Fork, switch, version resolution           |
| `merging.spec.ts`       | 15    | 🔴🟡 Mixed  | ❌ Not Started | 3-way merge, conflict resolution           |
| `settlements.spec.ts`   | 8     | 🔴🟡 Mixed  | ❌ Not Started | Settlement hierarchy, structures           |
| `audit.spec.ts`         | 12    | 🔴🟡 Mixed  | ❌ Not Started | Audit log, filtering, export               |
| `realtime.spec.ts`      | 4     | 🟡 High     | ❌ Not Started | WebSocket updates, cache invalidation      |
| `errors.spec.ts`        | 8     | 🔴🟡 Mixed  | ❌ Not Started | Error handling, validation, 404/500        |
| `accessibility.spec.ts` | 9     | 🟡🟢 Mixed  | ❌ Not Started | Keyboard nav, ARIA, screen readers         |
| `performance.spec.ts`   | 6     | 🟡🟢 Mixed  | ❌ Not Started | Rendering speed, large datasets            |
| `mobile.spec.ts`        | 5     | 🟢 Medium   | ❌ Not Started | Mobile responsiveness, touch targets       |

**Priority Legend**:

- 🔴 **Critical**: Core functionality, auth, data integrity (43 tests)
- 🟡 **High**: Major features, common workflows (87 tests)
- 🟢 **Medium**: Edge cases, validation, polish (32 tests)
- 🔵 **Low**: Nice-to-have optimizations (4 tests)

---

## Implementation Roadmap

### Phase 1: Critical Tests (43 tests) - Week 1

**Goal**: Ensure core functionality and authentication work

1. ✅ **auth.spec.ts** (7 tests)
   - TC-AUTH-001 to TC-AUTH-007
   - Login, logout, session expiration, permission checks

2. ✅ **map-view.spec.ts** - Critical subset (4 tests)
   - TC-MAP-001: Map renders successfully
   - TC-MAP-002: Settlement marker click
   - TC-MAP-003: Region polygon click
   - TC-MAP-004: Layer toggle

3. ✅ **inspector.spec.ts** - Critical subset (3 tests)
   - TC-INSPECT-001: Inspector opens on entity click
   - TC-INSPECT-002: Inspector close
   - TC-INSPECT-003: Tab navigation

4. ✅ **resolution.spec.ts** - Critical subset (3 tests)
   - TC-RESOLVE-001: Complete event - success
   - TC-RESOLVE-002: Complete event - validation error
   - TC-RESOLVE-003: Resolve encounter - success

5. ✅ **editing.spec.ts** - Critical subset (4 tests)
   - TC-EDIT-001: Enter drawing mode - point
   - TC-EDIT-002: Enter drawing mode - polygon
   - TC-EDIT-003: Save new geometry
   - TC-EDIT-004: Cancel drawing

6. ✅ **branching.spec.ts** - Critical subset (3 tests)
   - TC-BRANCH-001: Fork branch
   - TC-BRANCH-002: Switch between branches
   - TC-BRANCH-003: View branch list

7. ✅ **merging.spec.ts** - Critical subset (6 tests)
   - TC-MERGE-001 to TC-MERGE-006 (no conflicts, conflicts, resolution)

8. ✅ **selection.spec.ts** - Critical subset (3 tests)
   - TC-SELECT-001: Select in Map, highlight in Flow
   - TC-SELECT-002: Select in Flow, auto-pan Map
   - TC-SELECT-003: Select in Timeline, highlight all views

9. ✅ **timeline.spec.ts** - Critical subset (3 tests)
   - TC-TIME-001: Timeline renders successfully
   - TC-TIME-002: Event click
   - TC-TIME-003: Color coding by status

10. ✅ **settlements.spec.ts** - Critical subset (3 tests)
    - TC-SETTLE-001: View settlement hierarchy
    - TC-SETTLE-002: View settlement level progression
    - TC-SETTLE-003: View settlement typed variables

11. ✅ **audit.spec.ts** - Critical subset (3 tests)
    - TC-AUDIT-001: Access audit log (admin only)
    - TC-AUDIT-002: Audit log access denied (non-admin)
    - TC-AUDIT-003: Audit log table columns

12. ✅ **errors.spec.ts** - Critical subset (3 tests)
    - TC-ERROR-001: GraphQL query error
    - TC-ERROR-002: GraphQL mutation error
    - TC-ERROR-003: Network timeout

### Phase 2: High Priority Tests (87 tests) - Weeks 2-3

**Goal**: Cover major features and common workflows

- Complete remaining tests in:
  - map-view.spec.ts (8 remaining)
  - flow-view.spec.ts (11 tests)
  - timeline.spec.ts (9 remaining)
  - inspector.spec.ts (10 remaining)
  - selection.spec.ts (6 remaining)
  - editing.spec.ts (9 remaining)
  - resolution.spec.ts (6 remaining)
  - branching.spec.ts (5 remaining)
  - merging.spec.ts (9 remaining)
  - settlements.spec.ts (5 remaining)
  - audit.spec.ts (9 remaining)
  - realtime.spec.ts (4 tests)
  - errors.spec.ts (5 remaining)

### Phase 3: Medium Priority Tests (32 tests) - Week 4

**Goal**: Edge cases, validation, accessibility

- accessibility.spec.ts (9 tests)
- performance.spec.ts (6 tests)
- mobile.spec.ts (5 tests)
- Remaining medium-priority tests in other files

### Phase 4: Polish & Low Priority (4 tests) - Week 5

**Goal**: Final optimizations and nice-to-haves

---

## Common Test Patterns

### Authentication Pattern

```typescript
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Login before each test
  await page.goto('http://localhost:9263/auth/login');
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
});
```

### Navigation Pattern

```typescript
// Navigate to specific view
await page.goto('http://localhost:9263/map');
await page.waitForLoadState('networkidle');
```

### Entity Selection Pattern

```typescript
// Select settlement on map
await page.click('text="Sandpoint"'); // or use data-testid
await expect(page.locator('[data-testid="entity-inspector"]')).toBeVisible();
```

### GraphQL Response Waiting

```typescript
// Wait for GraphQL mutation
const responsePromise = page.waitForResponse(
  (response) => response.url().includes('/graphql') && response.status() === 200
);
await page.click('button:has-text("Complete Event")');
await responsePromise;
```

### Multi-Window Testing (for real-time)

```typescript
const context = await browser.newContext();
const page1 = await context.newPage();
const page2 = await context.newPage();
// Test real-time updates between windows
```

---

## Environment Variables

Required for tests:

```bash
# .env.test (create if needed)
VITE_API_URL=http://localhost:3000/graphql
VITE_WS_URL=ws://localhost:3000/graphql
```

---

## Test Data Helpers

### Common Test Entities

**Default Test Settlement**: Sandpoint

```typescript
const TEST_SETTLEMENT = {
  id: '<uuid-from-seed-data>',
  name: 'Sandpoint',
  level: 2,
  type: 'Town',
  kingdom: 'Varisia',
  population: 1240,
};
```

**Default Test Event**: Swallowtail Festival

```typescript
const TEST_EVENT = {
  id: '<uuid-from-seed-data>',
  name: 'Swallowtail Festival',
  status: 'COMPLETED',
  location: 'Sandpoint',
};
```

**Default Test Branch**: Main Timeline

```typescript
const MAIN_BRANCH = {
  id: '<uuid-from-seed-data>',
  name: 'Main Timeline',
  isRoot: true,
};
```

---

## Running Tests

### Run All Tests

```bash
# From project root
npx playwright test

# With UI
npx playwright test --ui

# With debug
npx playwright test --debug
```

### Run Specific Test File

```bash
npx playwright test playwright-tests/auth.spec.ts
npx playwright test playwright-tests/map-view.spec.ts
```

### Run by Tag/Priority

```bash
# Critical tests only
npx playwright test --grep @critical

# High priority tests
npx playwright test --grep @high
```

### Run in Specific Browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

---

## Test Reporting

### Generate HTML Report

```bash
npx playwright test --reporter=html
npx playwright show-report
```

### Generate JSON Report

```bash
npx playwright test --reporter=json
```

### Generate JUnit XML (for CI)

```bash
npx playwright test --reporter=junit
```

---

## CI/CD Integration

### GitHub Actions Workflow (Example)

```yaml
name: Playwright Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Install dependencies
        run: pnpm install
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Start services
        run: pnpm run dev &
      - name: Wait for services
        run: npx wait-on http://localhost:9263
      - name: Run tests
        run: npx playwright test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Debugging Tips

### Enable Verbose Logging

```bash
DEBUG=pw:api npx playwright test
```

### Capture Screenshots on Failure

```typescript
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await page.screenshot({ path: `screenshots/${testInfo.title}.png` });
  }
});
```

### Slow Down Test Execution

```typescript
test.use({ slowMo: 1000 }); // 1 second delay between actions
```

### Pause Test at Specific Point

```typescript
await page.pause(); // Opens Playwright Inspector
```

---

## Known Issues & Workarounds

### Issue 1: WebSocket Connection Flakiness

**Problem**: Real-time tests sometimes fail due to WebSocket timing
**Workaround**: Add explicit waits for WebSocket connection

```typescript
await page.waitForFunction(() => window.WebSocket.OPEN);
```

### Issue 2: MapLibre GL Loading

**Problem**: Map takes time to load tiles
**Workaround**: Wait for map load event

```typescript
await page.waitForFunction(() => document.querySelector('.maplibregl-canvas'));
```

### Issue 3: React Flow Layout Calculation

**Problem**: Flow graph layout is async
**Workaround**: Wait for layout completion

```typescript
await page.waitForTimeout(1000); // Wait for dagre layout
```

---

## Contributing

### Adding New Tests

1. Determine the appropriate test file (or create new one)
2. Reference test case from `PLAYWRIGHT_TESTING_CHECKLIST.md`
3. Write test in Gherkin-style format
4. Add appropriate tags (@critical, @high, @medium, @low)
5. Update test count in this README
6. Run test locally before committing

### Test Naming Convention

```typescript
test('TC-AUTH-001: Successful Login', async ({ page }) => {
  // Test case ID from checklist + descriptive name
});
```

### Tags

```typescript
test('TC-MAP-001: Map renders successfully', { tag: '@critical' }, async ({ page }) => {
  // Critical test
});

test('TC-MAP-005: Pan and zoom', { tag: '@high' }, async ({ page }) => {
  // High priority test
});
```

---

## Support & Documentation

- **Main Checklist**: `/storage/programs/campaign_manager/PLAYWRIGHT_TESTING_CHECKLIST.md`
- **Feature Docs**: `/storage/programs/campaign_manager/docs/features/`
- **User Guides**: `/storage/programs/campaign_manager/docs/user-guides/`
- **Frontend Guide**: `/storage/programs/campaign_manager/docs/development/frontend-guide.md`

---

## Progress Tracking

### Overall Status

- **Phase 1 (Critical)**: 0/43 tests (0%)
- **Phase 2 (High Priority)**: 0/87 tests (0%)
- **Phase 3 (Medium Priority)**: 0/32 tests (0%)
- **Phase 4 (Low Priority)**: 0/4 tests (0%)
- **TOTAL**: 0/166 tests (0%)

### Last Updated

- **Date**: 2025-11-11
- **Updated By**: Development Team
- **Next Review**: Check progress weekly

---

## Quick Reference: Test URLs

| Feature   | URL                                | Notes               |
| --------- | ---------------------------------- | ------------------- |
| Login     | `http://localhost:9263/auth/login` | Start here          |
| Dashboard | `http://localhost:9263/dashboard`  | After login         |
| Map View  | `http://localhost:9263/map`        | Main map interface  |
| Flow View | `http://localhost:9263/flow`       | Dependency graph    |
| Timeline  | `http://localhost:9263/timeline`   | Events & encounters |
| Branches  | `http://localhost:9263/branches`   | Branch management   |
| Audit Log | `http://localhost:9263/audit`      | Admin only          |

---

## Quick Reference: Test Credentials Summary

**Primary**: `admin@example.com` / `admin123` (use for 95% of tests)
**Secondary**: `gm@example.com` / `gm123` (use for GM permission tests)
**Future**: `player@example.com` / `player123` (player role not fully implemented)

---

## Quick Reference: Best Test Entities

**Settlement**: Sandpoint (Level 2 Town in Varisia)
**Event**: Swallowtail Festival (completed event in Sandpoint)
**Structure**: Sandpoint Blacksmith (structure in Sandpoint)
**Branch**: Main Timeline (root branch)
**Kingdom**: Varisia (has most test settlements)

---

**Happy Testing! 🎭**
