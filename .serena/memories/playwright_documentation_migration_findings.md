# Playwright Documentation Migration Findings

## Overview

Search completed for documentation files referencing the old Playwright test location (`docs/playwright-tests/`). The new location is `packages/frontend/e2e/`.

## Files Requiring Updates

### 1. Plan/Ticket Documents

**File**: `/storage/programs/campaign_manager/plan/TICKET-BUGFIX-MAP-INFINITE-LOOP.md`

- **Lines**: 283, 301-302
- **References**:
  - Line 283: `docs/playwright-tests/TEST_SESSION_2025-11-11.md`
  - Line 301: `docs/playwright-tests/README.md`
  - Line 302: `docs/playwright-tests/TEST_SESSION_2025-11-11.md`
- **Update to**: `packages/frontend/e2e/README.md` and `packages/frontend/e2e/TEST_SESSION_2025-11-11.md`

### 2. Frontend E2E Documentation

**File**: `/storage/programs/campaign_manager/packages/frontend/e2e/README.md`

- **Lines**: 612-613
- **References**:
  - Line 612: `` `docs/playwright-tests/PLAYWRIGHT_TESTING_CHECKLIST.md` ``
  - Line 613: `` `docs/playwright-tests/*.spec.ts` ``
- **Update to**: `packages/frontend/e2e/PLAYWRIGHT_TESTING_CHECKLIST.md` and `packages/frontend/e2e/*.spec.ts`

### 3. Test Session Report

**File**: `/storage/programs/campaign_manager/packages/frontend/e2e/TEST_SESSION_2025-11-11.md`

- **Lines**: 336
- **References**:
  - Line 336: `` `docs/playwright-tests/README.md` ``
- **Update to**: `packages/frontend/e2e/README.md` or `./README.md` (relative reference within same directory)

## Summary by Category

### Total Files with Old References: 3

1. `plan/TICKET-BUGFIX-MAP-INFINITE-LOOP.md` - 3 references
2. `packages/frontend/e2e/README.md` - 2 references
3. `packages/frontend/e2e/TEST_SESSION_2025-11-11.md` - 1 reference

### Total References to Update: 6

## Path Migration Mapping

| Old Path                                                | New Path                                                |
| ------------------------------------------------------- | ------------------------------------------------------- |
| `docs/playwright-tests/README.md`                       | `packages/frontend/e2e/README.md`                       |
| `docs/playwright-tests/TEST_SESSION_2025-11-11.md`      | `packages/frontend/e2e/TEST_SESSION_2025-11-11.md`      |
| `docs/playwright-tests/PLAYWRIGHT_TESTING_CHECKLIST.md` | `packages/frontend/e2e/PLAYWRIGHT_TESTING_CHECKLIST.md` |
| `docs/playwright-tests/*.spec.ts`                       | `packages/frontend/e2e/*.spec.ts`                       |

## Files NOT Needing Updates

The following files reference Playwright/E2E testing but use correct paths:

- `.serena/memories/frontend_comprehensive_testing_checklist.md`
- `docs/development/test-memory-mitigation-plan.md`
- `packages/frontend/docs/testing/mocking-guide.md`
- `docs/development/phase2-accumulation-analysis-results.md`
- `docs/ci/memory-debugging-saga.md`
- All other plan files and development guides
- `CLAUDE.md` - No references to Playwright location
- `README.md` - No references to Playwright location
- `CONTRIBUTING.md` - No references to Playwright location
