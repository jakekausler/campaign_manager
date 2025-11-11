/**
 * Cross-View Selection Tests
 *
 * Total: 9 tests (3 Critical, 4 High Priority, 2 Medium Priority)
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

test.describe('Cross-View Selection', () => {
  test.describe('🔴 Critical Tests', () => {
    test(
      'TC-SELECT-001: Select in Map, Highlight in Flow',
      { tag: '@critical' },
      async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/map`);
        await page.waitForLoadState('networkidle');

        await page.click('text="Sandpoint"');
        await expect(page.locator('[data-selected="true"]')).toContainText('Sandpoint');

        await page.goto(`${BASE_URL}/flow`);
        await expect(page.locator('[data-selected="true"][data-entity="Sandpoint"]')).toBeVisible();
      }
    );

    test('TC-SELECT-002: Select in Flow, Auto-Pan Map', { tag: '@critical' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/flow`);
      await page.waitForLoadState('networkidle');

      await page.click('[data-node-type="entity"][data-name="Sandpoint"]');

      await page.goto(`${BASE_URL}/map`);
      await expect(page.locator('[data-selected="true"]')).toContainText('Sandpoint');
      await expect(page.locator('[data-selected="true"]')).toBeInViewport();
    });

    test(
      'TC-SELECT-003: Select in Timeline, Highlight All Views',
      { tag: '@critical' },
      async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/timeline`);
        await page.waitForLoadState('networkidle');

        await page.click('[data-testid="timeline-event"]');

        await page.goto(`${BASE_URL}/map`);
        await expect(page.locator('[data-selected="true"]')).toBeVisible();

        await page.goto(`${BASE_URL}/flow`);
        await expect(page.locator('[data-selected="true"]')).toBeVisible();
      }
    );
  });

  test.describe('🟡 High Priority Tests', () => {
    test('TC-SELECT-004: Multi-Select Across Views', { tag: '@high' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/map`);
      await page.waitForLoadState('networkidle');

      await page.keyboard.down('Control');
      await page.click('text="Sandpoint"');
      await page.click('text="Magnimar"');
      await page.click('text="Korvosa"');
      await page.keyboard.up('Control');

      await expect(page.locator('[data-testid="selection-info-panel"]')).toContainText(
        '3 entities selected'
      );

      await page.goto(`${BASE_URL}/flow`);
      const selectedNodes = await page.locator('[data-selected="true"]').count();
      expect(selectedNodes).toBe(3);
    });

    test('TC-SELECT-005: Selection Info Panel', { tag: '@high' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/map`);
      await page.waitForLoadState('networkidle');

      await page.keyboard.down('Control');
      for (let i = 0; i < 5; i++) {
        await page.click(`[data-testid="settlement-marker"]:nth-child(${i + 1})`);
      }
      await page.keyboard.up('Control');

      await expect(page.locator('[data-testid="selection-info-panel"]')).toBeVisible();
      await expect(page.locator('[data-testid="selection-info-panel"]')).toContainText(
        '5 entities selected'
      );
      await expect(page.locator('[data-testid="clear-selection"]')).toBeVisible();
    });

    test('TC-SELECT-006: Clear Selection', { tag: '@high' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/map`);
      await page.waitForLoadState('networkidle');

      await page.click('text="Sandpoint"');
      await expect(page.locator('[data-selected="true"]')).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(page.locator('[data-selected="true"]')).not.toBeVisible();
    });

    test('TC-SELECT-007: Toggle Selection with Ctrl+Click', { tag: '@high' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/map`);
      await page.waitForLoadState('networkidle');

      await page.click('text="Sandpoint"');
      await expect(page.locator('[data-selected="true"]')).toContainText('Sandpoint');

      await page.keyboard.down('Control');
      await page.click('text="Sandpoint"');
      await page.keyboard.up('Control');

      await expect(page.locator('[data-selected="true"]')).not.toBeVisible();
    });
  });

  test.describe('🟢 Medium Priority Tests', () => {
    test(
      'TC-SELECT-008: Selection Persistence on View Switch',
      { tag: '@medium' },
      async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/map`);
        await page.waitForLoadState('networkidle');

        await page.click('text="Sandpoint"');
        await page.goto(`${BASE_URL}/timeline`);
        await page.goto(`${BASE_URL}/map`);

        await expect(page.locator('[data-selected="true"]')).toContainText('Sandpoint');
      }
    );

    test(
      'TC-SELECT-009: Structure Parent Settlement Query',
      { tag: '@medium' },
      async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/map`);
        await page.waitForLoadState('networkidle');

        await page.click('[data-testid="structure-marker"]');

        await expect(page.locator('[data-selected="true"][data-type="structure"]')).toBeVisible();
        await expect(page.locator('[data-parent-highlighted="true"]')).toBeVisible();
        await expect(page.locator('[data-testid="selection-info-panel"]')).toContainText(
          /Structure of/i
        );
      }
    );
  });
});
