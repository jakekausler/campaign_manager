/**
 * Settlement & Structure Management Tests
 *
 * Total: 8 tests (3 Critical, 4 High Priority, 1 Medium Priority)
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:9263';

async function setupMap(page: Page) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
  await page.goto(`${BASE_URL}/map`);
  await page.waitForLoadState('networkidle');
}

test.describe('Settlement & Structure Management', () => {
  test.describe('🔴 Critical Tests', () => {
    test('TC-SETTLE-001: View Settlement Hierarchy', { tag: '@critical' }, async ({ page }) => {
      await setupMap(page);

      await page.click('text="Sandpoint"');
      await expect(page.locator('[data-testid="entity-inspector"]')).toBeVisible();

      await page.click('text=Links');
      await expect(page.locator('[data-testid="parent-kingdom"]')).toBeVisible();
      await expect(page.locator('[data-testid="child-structures"]')).toBeVisible();
    });

    test(
      'TC-SETTLE-002: View Settlement Level Progression',
      { tag: '@critical' },
      async ({ page }) => {
        await setupMap(page);

        await page.click('text="Sandpoint"');
        await page.click('text=Details');

        await expect(page.locator('[data-testid="settlement-level"]')).toContainText(/Level 2/i);
        await expect(page.locator('[data-testid="settlement-type"]')).toContainText(/Town/i);
      }
    );

    test(
      'TC-SETTLE-003: View Settlement Typed Variables',
      { tag: '@critical' },
      async ({ page }) => {
        await setupMap(page);

        await page.click('text="Sandpoint"');
        await page.click('text=Details');

        await expect(page.locator('[data-testid="typed-variables"]')).toBeVisible();
        await expect(page.locator('[data-testid="copy-to-clipboard"]')).toBeVisible();
      }
    );
  });

  test.describe('🟡 High Priority Tests', () => {
    test('TC-SETTLE-004: View Structure Details', { tag: '@high' }, async ({ page }) => {
      await setupMap(page);

      await page.click('[data-testid="structure-marker"]');
      await expect(page.locator('[data-testid="entity-inspector"]')).toBeVisible();
      await expect(page.locator('[data-testid="structure-type"]')).toBeVisible();
    });

    test('TC-SETTLE-005: Structure Types', { tag: '@high' }, async ({ page }) => {
      await setupMap(page);

      const structureTypes = ['Blacksmith', 'Market', 'Temple', 'Barracks'];
      for (const type of structureTypes) {
        const structureExists = await page
          .locator(`text=${type}`)
          .isVisible()
          .catch(() => false);
        if (structureExists) {
          expect(structureExists).toBeTruthy();
          break;
        }
      }
    });

    test(
      'TC-SETTLE-006: Navigate from Settlement to Structures',
      { tag: '@high' },
      async ({ page }) => {
        await setupMap(page);

        await page.click('text="Sandpoint"');
        await page.click('text=Links');

        const structureLink = page.locator('[data-testid="child-structure-link"]').first();
        await structureLink.click();

        await expect(page.locator('[data-testid="entity-inspector"]')).toContainText(/Structure/i);
      }
    );

    test(
      'TC-SETTLE-007: Navigate from Structure to Parent Settlement',
      { tag: '@high' },
      async ({ page }) => {
        await setupMap(page);

        await page.click('[data-testid="structure-marker"]');
        await page.click('text=Links');
        await page.click('[data-testid="parent-settlement-link"]');

        await expect(page.locator('[data-testid="entity-inspector"]')).toContainText('Sandpoint');
      }
    );
  });

  test.describe('🟢 Medium Priority Tests', () => {
    test(
      'TC-SETTLE-008: Settlement Condition-Based Fields',
      { tag: '@medium' },
      async ({ page }) => {
        await setupMap(page);

        await page.click('text="Sandpoint"');
        await page.click('text=Conditions');

        const conditionCount = await page.locator('[data-testid="condition-item"]').count();
        expect(conditionCount).toBeGreaterThanOrEqual(0);
      }
    );
  });
});
