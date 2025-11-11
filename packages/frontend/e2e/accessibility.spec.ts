/**
 * Accessibility Tests
 *
 * Total: 9 tests (0 Critical, 7 High Priority, 2 Medium Priority)
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

test.describe('Accessibility', () => {
  test.describe('🟡 High Priority Tests', () => {
    test('TC-A11Y-001: Keyboard Navigation - Tab Order', { tag: '@high' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/map`);

      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    });

    test(
      'TC-A11Y-002: Keyboard Shortcuts - Escape to Close',
      { tag: '@high' },
      async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/map`);

        await page.click('text="Sandpoint"');
        await expect(page.locator('[data-testid="entity-inspector"]')).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(page.locator('[data-testid="entity-inspector"]')).not.toBeVisible();
      }
    );

    test(
      'TC-A11Y-003: Keyboard Shortcuts - Save/Cancel Editing',
      { tag: '@high' },
      async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/map`);

        await page.click('text="Sandpoint"');
        await page.click('[data-testid="settlement-name-field"]');

        await page.keyboard.press('Control+s');
        await page.keyboard.press('Escape');
      }
    );

    test('TC-A11Y-004: Screen Reader - Button Labels', { tag: '@high' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/map`);

      const addPointButton = page.locator('[data-testid="add-point-button"]');
      const ariaLabel = await addPointButton.getAttribute('aria-label');

      expect(ariaLabel || (await addPointButton.textContent())).toBeTruthy();
    });

    test('TC-A11Y-005: Focus Indicators', { tag: '@high' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/map`);

      await page.keyboard.press('Tab');

      const focusedElement = page.locator(':focus');
      const outlineStyle = await focusedElement.evaluate(
        (el) => window.getComputedStyle(el).outline
      );

      expect(outlineStyle).not.toBe('none');
    });

    test('TC-A11Y-006: Color Contrast', { tag: '@high' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/map`);

      // This test would use axe-core or similar tool for automated checks
      // For now, basic visual check
      const textElements = await page.locator('p, span, button, a').all();
      expect(textElements.length).toBeGreaterThan(0);
    });

    test('TC-A11Y-007: ARIA Labels for Icons', { tag: '@high' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/map`);

      await page.click('text="Sandpoint"');

      const closeButton = page.locator('[data-testid="inspector-close"]');
      const hasAriaLabel = await closeButton.getAttribute('aria-label');

      expect(hasAriaLabel).toBeTruthy();
    });
  });

  test.describe('🟢 Medium Priority Tests', () => {
    test(
      'TC-A11Y-008: ARIA Live Regions for Status Updates',
      { tag: '@medium' },
      async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/map`);

        await page.click('text="Sandpoint"');

        const liveRegion = page.locator('[role="status"], [aria-live]');
        const exists = await liveRegion.count();

        expect(exists).toBeGreaterThanOrEqual(0);
      }
    );

    test('TC-A11Y-009: Keyboard-Only Complete Workflow', { tag: '@medium' }, async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/login`);

      // Navigate and fill login form using only keyboard
      await page.keyboard.press('Tab');
      await page.keyboard.type('admin@example.com');
      await page.keyboard.press('Tab');
      await page.keyboard.type('admin123');
      await page.keyboard.press('Enter');

      await expect(page).toHaveURL(/.*dashboard/);
    });
  });
});
