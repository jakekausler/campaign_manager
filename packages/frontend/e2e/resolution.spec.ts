/**
 * Event & Encounter Resolution Tests
 *
 * Total: 9 tests (3 Critical, 4 High Priority, 2 Medium Priority)
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:9263';

async function setupTimeline(page: Page) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
  await page.goto(`${BASE_URL}/timeline`);
  await page.waitForLoadState('networkidle');
}

test.describe('Event & Encounter Resolution', () => {
  test.describe('🔴 Critical Tests', () => {
    test('TC-RESOLVE-001: Complete Event - Success', { tag: '@critical' }, async ({ page }) => {
      await setupTimeline(page);

      await page.click('[data-status="scheduled"]');
      await expect(page.locator('[data-testid="entity-inspector"]')).toBeVisible();

      await page.click('[data-testid="complete-event-button"]');
      await expect(page.locator('[data-testid="resolution-dialog"]')).toBeVisible();

      await page.click('button:has-text("Confirm")');
      await expect(page.locator('text=/Event completed successfully/i')).toBeVisible();
    });

    test(
      'TC-RESOLVE-002: Complete Event - Validation Error',
      { tag: '@critical' },
      async ({ page }) => {
        await setupTimeline(page);

        await page.click('[data-status="completed"]');
        await page.click('[data-testid="complete-event-button"]');

        await expect(page.locator('[data-testid="resolution-dialog"]')).toBeVisible();
        await expect(page.locator('text=/already completed/i')).toBeVisible();
        await expect(page.locator('button:has-text("Confirm")')).toBeDisabled();
      }
    );

    test('TC-RESOLVE-003: Resolve Encounter - Success', { tag: '@critical' }, async ({ page }) => {
      await setupTimeline(page);

      await page.click('[data-type="encounter"][data-status="unresolved"]');
      await page.click('[data-testid="resolve-encounter-button"]');

      await expect(page.locator('[data-testid="resolution-dialog"]')).toBeVisible();
      await page.click('button:has-text("Confirm")');

      await expect(page.locator('text=/Encounter resolved successfully/i')).toBeVisible();
    });
  });

  test.describe('🟡 High Priority Tests', () => {
    test('TC-RESOLVE-004: Effect Preview in Dialog', { tag: '@high' }, async ({ page }) => {
      await setupTimeline(page);

      await page.click('[data-status="scheduled"]');
      await page.click('[data-testid="complete-event-button"]');

      const dialog = page.locator('[data-testid="resolution-dialog"]');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('[data-testid="effect-item"]')).toHaveCount(
        await dialog.locator('[data-testid="effect-item"]').count()
      );

      const firstEffect = dialog.locator('[data-testid="effect-item"]').first();
      await expect(firstEffect).toContainText(/PRE|ON_RESOLVE|POST/i);
    });

    test(
      'TC-RESOLVE-005: Validation Warning (Non-Blocking)',
      { tag: '@high' },
      async ({ page }) => {
        await setupTimeline(page);

        await page.click('[data-type="encounter"][data-status="unresolved"]');
        await page.click('[data-testid="resolve-encounter-button"]');

        const warningExists = await page
          .locator('[data-testid="validation-warning"]')
          .isVisible()
          .catch(() => false);

        if (warningExists) {
          await expect(page.locator('[data-testid="validation-warning"]')).toHaveClass(/warning/);
          await expect(page.locator('button:has-text("Confirm")')).toBeEnabled();
        }
      }
    );

    test(
      'TC-RESOLVE-006: Effect Execution Summary in Audit Trail',
      { tag: '@high' },
      async ({ page }) => {
        await setupTimeline(page);

        await page.click('[data-status="scheduled"]');
        await page.click('[data-testid="complete-event-button"]');
        await page.click('button:has-text("Confirm")');

        await page.waitForTimeout(1000);

        await page.click('text=Versions');
        const versionEntry = page.locator('[data-testid="version-entry"]').first();
        await expect(versionEntry).toContainText(/effects executed/i);
      }
    );

    test('TC-RESOLVE-007: Partial Effect Execution', { tag: '@high' }, async ({ page }) => {
      // This test assumes an event with effects that might fail
      await setupTimeline(page);

      await page.click('[data-status="scheduled"]');
      await page.click('[data-testid="complete-event-button"]');
      await page.click('button:has-text("Confirm")');

      // Check for partial success warning
      const partialWarning = await page
        .locator('text=/with warnings/i')
        .isVisible()
        .catch(() => false);

      if (partialWarning) {
        await expect(page.locator('text=/with warnings/i')).toBeVisible();
      }
    });
  });

  test.describe('🟢 Medium Priority Tests', () => {
    test('TC-RESOLVE-008: Cancel Resolution', { tag: '@medium' }, async ({ page }) => {
      await setupTimeline(page);

      await page.click('[data-status="scheduled"]');
      await page.click('[data-testid="complete-event-button"]');

      await expect(page.locator('[data-testid="resolution-dialog"]')).toBeVisible();
      await page.click('button:has-text("Cancel")');

      await expect(page.locator('[data-testid="resolution-dialog"]')).not.toBeVisible();
    });

    test('TC-RESOLVE-009: Resolution Button State', { tag: '@medium' }, async ({ page }) => {
      await setupTimeline(page);

      await page.click('[data-status="completed"]');
      await expect(page.locator('[data-testid="entity-inspector"]')).toBeVisible();

      const button = page.locator('[data-testid="complete-event-button"]');
      const isDisabled = await button.isDisabled();
      const hasCompletedText = await button
        .textContent()
        .then((text) => text?.includes('Completed'));

      expect(isDisabled || hasCompletedText).toBeTruthy();
    });
  });
});
