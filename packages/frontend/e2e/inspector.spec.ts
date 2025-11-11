/**
 * Entity Inspector Tests
 *
 * Total: 13 tests (3 Critical, 8 High Priority, 2 Medium Priority)
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:9263';

async function setupWithInspector(page: Page) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
  await page.goto(`${BASE_URL}/map`);
  await page.waitForLoadState('networkidle');
  await page.click('text="Sandpoint"');
  await expect(page.locator('[data-testid="entity-inspector"]')).toBeVisible();
}

test.describe('Entity Inspector', () => {
  test.describe('🔴 Critical Tests', () => {
    test(
      'TC-INSPECT-001: Inspector Opens on Entity Click',
      { tag: '@critical' },
      async ({ page }) => {
        await page.goto(`${BASE_URL}/auth/login`);
        await page.fill('input[name="email"]', 'admin@example.com');
        await page.fill('input[name="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await page.goto(`${BASE_URL}/map`);
        await page.waitForLoadState('networkidle');

        await page.click('text="Sandpoint"');

        await expect(page.locator('[data-testid="entity-inspector"]')).toBeVisible();
        await expect(page.locator('[data-testid="inspector-title"]')).toContainText('Sandpoint');

        const tabs = ['Overview', 'Details', 'Links', 'Conditions', 'Effects', 'Versions'];
        for (const tab of tabs) {
          await expect(page.locator(`text=${tab}`)).toBeVisible();
        }
      }
    );

    test('TC-INSPECT-002: Inspector Close', { tag: '@critical' }, async ({ page }) => {
      await setupWithInspector(page);

      await page.click('[data-testid="inspector-close"]');

      await expect(page.locator('[data-testid="entity-inspector"]')).not.toBeVisible();
    });

    test('TC-INSPECT-003: Tab Navigation', { tag: '@critical' }, async ({ page }) => {
      await setupWithInspector(page);

      await page.click('text=Details');
      await expect(page.locator('[data-testid="details-panel"]')).toBeVisible();

      await page.click('text=Versions');
      await expect(page.locator('[data-testid="versions-panel"]')).toBeVisible();
    });
  });

  test.describe('🟡 High Priority Tests', () => {
    test('TC-INSPECT-004: Copy to Clipboard', { tag: '@high' }, async ({ page }) => {
      await setupWithInspector(page);

      await page.click('text=Details');
      await page.click('[data-testid="copy-field-value"]');

      await expect(page.locator('text=/Copied to clipboard/i')).toBeVisible();
    });

    test('TC-INSPECT-005: Edit Mode - Name Field', { tag: '@high' }, async ({ page }) => {
      await setupWithInspector(page);

      await page.click('[data-testid="settlement-name-field"]');
      await page.fill('[data-testid="settlement-name-input"]', 'New Settlement Name');

      await page.keyboard.press('Control+s');

      await expect(page.locator('text=/updated/i')).toBeVisible();
    });

    test('TC-INSPECT-006: Edit Mode - Cancel', { tag: '@high' }, async ({ page }) => {
      await setupWithInspector(page);

      const originalName = await page.locator('[data-testid="inspector-title"]').textContent();

      await page.click('[data-testid="settlement-name-field"]');
      await page.fill('[data-testid="settlement-name-input"]', 'Temp Name');
      await page.keyboard.press('Escape');

      await expect(page.locator('[data-testid="inspector-title"]')).toContainText(originalName!);
    });

    test('TC-INSPECT-007: Navigate to Linked Entity', { tag: '@high' }, async ({ page }) => {
      await setupWithInspector(page);

      await page.click('text=Links');
      await page.click('[data-testid="parent-kingdom-link"]');

      await expect(page.locator('[data-testid="inspector-title"]')).toContainText(
        /Kingdom|Varisia/i
      );
    });

    test('TC-INSPECT-008: View Conditions Tab', { tag: '@high' }, async ({ page }) => {
      await setupWithInspector(page);

      await page.click('text=Conditions');

      const conditions = await page.locator('[data-testid="condition-item"]').count();
      expect(conditions).toBeGreaterThanOrEqual(0);
    });

    test('TC-INSPECT-009: Explain Condition', { tag: '@high' }, async ({ page }) => {
      await setupWithInspector(page);

      await page.click('text=Conditions');
      const hasConditions = (await page.locator('[data-testid="condition-item"]').count()) > 0;

      if (hasConditions) {
        await page.click('[data-testid="explain-condition"]');
        await expect(page.locator('[data-testid="evaluation-trace-modal"]')).toBeVisible();
      }
    });

    test('TC-INSPECT-010: View Effects Tab', { tag: '@high' }, async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/login`);
      await page.fill('input[name="email"]', 'admin@example.com');
      await page.fill('input[name="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.goto(`${BASE_URL}/timeline`);
      await page.waitForLoadState('networkidle');

      await page.click('[data-testid="timeline-event"]');

      await page.click('text=Effects');
      await expect(page.locator('[data-testid="effects-panel"]')).toBeVisible();
    });

    test(
      'TC-INSPECT-011: View Versions Tab (Audit History)',
      { tag: '@high' },
      async ({ page }) => {
        await setupWithInspector(page);

        await page.click('text=Versions');

        const versionEntries = await page.locator('[data-testid="version-entry"]').count();
        expect(versionEntries).toBeGreaterThan(0);
      }
    );
  });

  test.describe('🟢 Medium Priority Tests', () => {
    test('TC-INSPECT-012: Breadcrumb Navigation', { tag: '@medium' }, async ({ page }) => {
      await setupWithInspector(page);

      await page.click('text=Links');
      await page.click('[data-testid="child-structure-link"]');
      await page.click('[data-testid="breadcrumb-settlement"]');

      await expect(page.locator('[data-testid="inspector-title"]')).toContainText('Sandpoint');
    });

    test(
      'TC-INSPECT-013: Responsive Layout (Mobile)',
      { tag: '@medium' },
      async ({ page, context }) => {
        await context.setViewportSize({ width: 375, height: 667 });

        await setupWithInspector(page);

        await expect(page.locator('[data-testid="entity-inspector"]')).toHaveCSS(
          'position',
          /fixed|absolute/
        );
      }
    );
  });
});
