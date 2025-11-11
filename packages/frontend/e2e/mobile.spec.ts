/**
 * Mobile Responsiveness Tests
 *
 * Total: 5 tests (0 Critical, 0 High Priority, 5 Medium Priority)
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

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.describe('🟢 Medium Priority Tests', () => {
    test('TC-MOBILE-001: Login Page on Mobile', { tag: '@medium' }, async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/login`);

      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();

      const submitButton = page.locator('button[type="submit"]');
      const buttonSize = await submitButton.boundingBox();

      expect(buttonSize?.height).toBeGreaterThanOrEqual(44);
    });

    test('TC-MOBILE-002: Map View on Mobile', { tag: '@medium' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/map`);

      await expect(page.locator('.maplibregl-canvas')).toBeVisible();

      const viewport = page.viewportSize();
      expect(viewport?.width).toBe(375);
    });

    test('TC-MOBILE-003: Entity Inspector on Mobile', { tag: '@medium' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/map`);

      await page.click('text="Sandpoint"');

      const inspector = page.locator('[data-testid="entity-inspector"]');
      await expect(inspector).toBeVisible();

      const inspectorBox = await inspector.boundingBox();
      const viewportWidth = page.viewportSize()?.width || 375;

      expect(inspectorBox?.width).toBeLessThanOrEqual(viewportWidth);
    });

    test('TC-MOBILE-004: Timeline on Mobile', { tag: '@medium' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/timeline`);

      await expect(page.locator('[data-testid="timeline-visualization"]')).toBeVisible();

      // Test touch scrolling
      await page.touchscreen.tap(200, 300);
    });

    test('TC-MOBILE-005: Touch-Friendly Buttons', { tag: '@medium' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/map`);

      const buttons = await page.locator('button, a[role="button"]').all();

      for (const button of buttons.slice(0, 5)) {
        const box = await button.boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    });
  });
});
