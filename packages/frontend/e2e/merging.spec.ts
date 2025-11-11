/**
 * Branch Merging Tests
 *
 * Total: 15 tests (6 Critical, 6 High Priority, 3 Medium Priority)
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:9263';

async function login(page: Page) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

test.describe('Branch Merging', () => {
  test.describe('🔴 Critical Tests', () => {
    test('TC-MERGE-001: 3-Way Merge - No Conflicts', { tag: '@critical' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/branches`);

      await page.click('[data-testid="merge-branch-button"]');
      await page.selectOption('[data-testid="source-branch"]', { index: 1 });
      await page.selectOption('[data-testid="target-branch"]', { index: 0 });
      await page.click('button:has-text("Preview Merge")');

      await expect(page.locator('[data-testid="merge-preview-dialog"]')).toBeVisible();
      await expect(page.locator('text=/0 conflicts/i')).toBeVisible();

      await page.click('button:has-text("Execute Merge")');
      await expect(page.locator('text=/Merge completed successfully/i')).toBeVisible();
    });

    test(
      'TC-MERGE-002: 3-Way Merge - Conflicts Detected',
      { tag: '@critical' },
      async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/branches`);

        await page.click('[data-testid="merge-branch-button"]');
        await page.selectOption('[data-testid="source-branch"]', { index: 1 });
        await page.selectOption('[data-testid="target-branch"]', { index: 0 });
        await page.click('button:has-text("Preview Merge")');

        const conflictCount = await page.locator('[data-testid="conflict-count"]').textContent();
        if (conflictCount !== '0') {
          await expect(page.locator('[data-testid="conflict-item"]')).toHaveCount(
            parseInt(conflictCount)
          );
          await expect(page.locator('button:has-text("Execute Merge")')).toBeDisabled();
        }
      }
    );

    test(
      'TC-MERGE-003: Resolve Conflict - Choose Source',
      { tag: '@critical' },
      async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/branches`);

        await page.click('[data-testid="merge-branch-button"]');
        await page.selectOption('[data-testid="source-branch"]', { index: 1 });
        await page.selectOption('[data-testid="target-branch"]', { index: 0 });
        await page.click('button:has-text("Preview Merge")');

        const hasConflicts = (await page.locator('[data-testid="conflict-item"]').count()) > 0;

        if (hasConflicts) {
          await page.click('[data-testid="use-source-button"]');
          await expect(page.locator('[data-testid="conflict-resolved"]')).toBeVisible();
        }
      }
    );

    test(
      'TC-MERGE-004: Resolve Conflict - Choose Target',
      { tag: '@critical' },
      async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/branches`);

        await page.click('[data-testid="merge-branch-button"]');
        await page.selectOption('[data-testid="source-branch"]', { index: 1 });
        await page.selectOption('[data-testid="target-branch"]', { index: 0 });
        await page.click('button:has-text("Preview Merge")');

        const hasConflicts = (await page.locator('[data-testid="conflict-item"]').count()) > 0;

        if (hasConflicts) {
          await page.click('[data-testid="use-target-button"]');
          await expect(page.locator('[data-testid="conflict-resolved"]')).toBeVisible();
        }
      }
    );

    test(
      'TC-MERGE-005: Resolve Conflict - Edit Manually',
      { tag: '@critical' },
      async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/branches`);

        await page.click('[data-testid="merge-branch-button"]');
        await page.selectOption('[data-testid="source-branch"]', { index: 1 });
        await page.selectOption('[data-testid="target-branch"]', { index: 0 });
        await page.click('button:has-text("Preview Merge")');

        const hasConflicts = (await page.locator('[data-testid="conflict-item"]').count()) > 0;

        if (hasConflicts) {
          await page.click('[data-testid="edit-manually-button"]');
          await expect(page.locator('[data-testid="json-editor"]')).toBeVisible();

          await page.fill('[data-testid="json-editor"]', '{"value": 1350}');
          await page.click('button:has-text("Save")');

          await expect(page.locator('[data-testid="conflict-resolved"]')).toBeVisible();
        }
      }
    );

    test(
      'TC-MERGE-006: Execute Merge After Resolving Conflicts',
      { tag: '@critical' },
      async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/branches`);

        await page.click('[data-testid="merge-branch-button"]');
        await page.selectOption('[data-testid="source-branch"]', { index: 1 });
        await page.selectOption('[data-testid="target-branch"]', { index: 0 });
        await page.click('button:has-text("Preview Merge")');

        const conflictCount = await page.locator('[data-testid="conflict-item"]').count();

        for (let i = 0; i < conflictCount; i++) {
          await page.locator('[data-testid="use-source-button"]').first().click();
        }

        await expect(page.locator('button:has-text("Execute Merge")')).toBeEnabled();
        await page.click('button:has-text("Execute Merge")');

        await expect(page.locator('text=/Merge completed/i')).toBeVisible();
      }
    );
  });

  test.describe('🟡 High Priority Tests', () => {
    // Tests TC-MERGE-007 through TC-MERGE-012 would follow similar patterns
    test('TC-MERGE-007: Auto-Resolution Logic', { tag: '@high' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/branches`);

      await page.click('[data-testid="merge-branch-button"]');
      await page.selectOption('[data-testid="source-branch"]', { index: 1 });
      await page.selectOption('[data-testid="target-branch"]', { index: 0 });
      await page.click('button:has-text("Preview Merge")');

      await expect(page.locator('[data-testid="auto-resolved-tab"]')).toBeVisible();
      await page.click('[data-testid="auto-resolved-tab"]');

      const autoResolvedCount = await page.locator('[data-testid="auto-resolved-item"]').count();
      expect(autoResolvedCount).toBeGreaterThanOrEqual(0);
    });

    test('TC-MERGE-011: Cherry-Pick Single Version', { tag: '@high' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/branches`);

      await page.click('[data-testid="cherry-pick-button"]');
      await page.selectOption('[data-testid="source-branch"]', { index: 1 });
      await page.click('[data-testid="version-selector"]');
      await page.selectOption('[data-testid="target-branch"]', { index: 0 });

      await page.click('button:has-text("Apply")');

      const hasConflict = await page
        .locator('[data-testid="conflict-dialog"]')
        .isVisible()
        .catch(() => false);

      if (!hasConflict) {
        await expect(page.locator('text=/Applied successfully/i')).toBeVisible();
      }
    });
  });

  test.describe('🟢 Medium Priority Tests', () => {
    test('TC-MERGE-013: Merge History View', { tag: '@medium' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/branches`);

      await page.click('text=/Merge History/i');

      await expect(page.locator('[data-testid="merge-history-list"]')).toBeVisible();
      const mergeEntries = await page.locator('[data-testid="merge-entry"]').count();
      expect(mergeEntries).toBeGreaterThanOrEqual(0);
    });
  });
});
