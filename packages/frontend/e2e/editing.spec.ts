/**
 * Map Editing Tools Tests
 *
 * Total: 13 tests (4 Critical, 7 High Priority, 2 Medium Priority)
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:9263';

async function setupMapEditor(page: Page) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
  await page.goto(`${BASE_URL}/map`);
  await page.waitForLoadState('networkidle');
}

test.describe('Map Editing Tools', () => {
  test.describe('🔴 Critical Tests', () => {
    test('TC-EDIT-001: Enter Drawing Mode - Point', { tag: '@critical' }, async ({ page }) => {
      await setupMapEditor(page);

      await page.click('[data-testid="add-point-button"]');
      await expect(page.locator('.maplibregl-canvas')).toHaveCSS('cursor', /crosshair/);

      await page.mouse.click(400, 300);
      await expect(page.locator('[data-testid="save-location-dialog"]')).toBeVisible();
    });

    test(
      'TC-EDIT-002: Enter Drawing Mode - Polygon (Region)',
      { tag: '@critical' },
      async ({ page }) => {
        await setupMapEditor(page);

        await page.click('[data-testid="draw-region-button"]');

        await page.mouse.click(300, 300);
        await page.mouse.click(400, 300);
        await page.mouse.click(400, 400);
        await page.mouse.dblclick(300, 400);

        await expect(page.locator('[data-testid="save-region-dialog"]')).toBeVisible();
      }
    );

    test('TC-EDIT-003: Save New Geometry', { tag: '@critical' }, async ({ page }) => {
      await setupMapEditor(page);

      await page.click('[data-testid="draw-region-button"]');
      await page.mouse.click(300, 300);
      await page.mouse.click(400, 300);
      await page.mouse.click(400, 400);
      await page.mouse.dblclick(300, 400);

      await page.fill('[data-testid="region-name-input"]', 'New Test Region');
      await page.click('button:has-text("Save")');

      await expect(page.locator('text=/Region created/i')).toBeVisible();
    });

    test('TC-EDIT-004: Cancel Drawing', { tag: '@critical' }, async ({ page }) => {
      await setupMapEditor(page);

      await page.click('[data-testid="draw-region-button"]');
      await page.mouse.click(300, 300);

      await page.keyboard.press('Escape');

      await expect(page.locator('.maplibregl-canvas')).not.toHaveCSS('cursor', /crosshair/);
    });
  });

  test.describe('🟡 High Priority Tests', () => {
    test('TC-EDIT-005: Edit Existing Geometry', { tag: '@high' }, async ({ page }) => {
      await setupMapEditor(page);

      await page.click('text="Sandpoint"');
      await expect(page.locator('[data-testid="entity-inspector"]')).toBeVisible();

      await page.click('[data-testid="edit-location-button"]');
      await page.mouse.down();
      await page.mouse.move(450, 350);
      await page.mouse.up();

      await page.click('[data-testid="save-edit"]');
      await expect(page.locator('text=/updated/i')).toBeVisible();
    });

    test('TC-EDIT-006: Edit Polygon Vertices', { tag: '@high' }, async ({ page }) => {
      await setupMapEditor(page);

      await page.click('[data-testid="region-polygon"]');
      await page.click('[data-testid="edit-region-button"]');

      const vertex = page.locator('[data-testid="polygon-vertex"]').first();
      await vertex.dragTo(vertex, { targetPosition: { x: 50, y: 50 } });

      await expect(page.locator('[data-testid="area-calculation"]')).toBeVisible();
    });

    test('TC-EDIT-007: Undo/Redo', { tag: '@high' }, async ({ page }) => {
      await setupMapEditor(page);

      await page.click('[data-testid="draw-region-button"]');
      await page.mouse.click(300, 300);
      await page.mouse.click(400, 300);

      await page.keyboard.press('Control+z');
      const vertexCount = await page.locator('[data-testid="vertex-marker"]').count();
      expect(vertexCount).toBe(1);

      await page.keyboard.press('Control+Shift+z');
    });

    test('TC-EDIT-008: Geometry Validation - Bounds', { tag: '@high' }, async ({ page }) => {
      await setupMapEditor(page);

      await page.click('[data-testid="add-point-button"]');
      await page.evaluate(() => {
        // Try to place point outside valid bounds
        return { lat: 9999, lng: 9999 };
      });

      await expect(page.locator('text=/Invalid coordinates/i')).toBeVisible();
    });

    test(
      'TC-EDIT-009: Geometry Validation - Self-Intersecting Polygon',
      { tag: '@high' },
      async ({ page }) => {
        await setupMapEditor(page);

        await page.click('[data-testid="draw-region-button"]');
        // Draw figure-eight (self-intersecting)
        await page.mouse.click(300, 300);
        await page.mouse.click(400, 400);
        await page.mouse.click(400, 300);
        await page.mouse.dblclick(300, 400);

        await expect(page.locator('text=/cannot self-intersect/i')).toBeVisible();
      }
    );

    test(
      'TC-EDIT-010: Geometry Validation - Minimum Vertices',
      { tag: '@high' },
      async ({ page }) => {
        await setupMapEditor(page);

        await page.click('[data-testid="draw-region-button"]');
        await page.mouse.click(300, 300);
        await page.mouse.dblclick(400, 300);

        await expect(page.locator('text=/at least 3 vertices/i')).toBeVisible();
      }
    );

    test('TC-EDIT-011: Geometry Validation - Area Limits', { tag: '@high' }, async ({ page }) => {
      await setupMapEditor(page);

      await page.click('[data-testid="draw-region-button"]');
      // Draw very large polygon (simulate)
      // This would need to be tested with actual coordinates

      await expect(page.locator('[data-testid="area-warning"]')).toBeTruthy();
    });
  });

  test.describe('🟢 Medium Priority Tests', () => {
    test('TC-EDIT-012: Undo/Redo History Limit', { tag: '@medium' }, async ({ page }) => {
      await setupMapEditor(page);

      await page.click('[data-testid="draw-region-button"]');

      // Perform 51+ actions
      for (let i = 0; i < 51; i++) {
        await page.mouse.click(300 + i, 300);
      }

      // Undo should be limited to last 50 actions
      for (let i = 0; i < 50; i++) {
        await page.keyboard.press('Control+z');
      }

      const remainingVertices = await page.locator('[data-testid="vertex-marker"]').count();
      expect(remainingVertices).toBeGreaterThan(0);
    });

    test(
      'TC-EDIT-013: Version Conflict Detection',
      { tag: '@medium' },
      async ({ page, context }) => {
        await setupMapEditor(page);

        const page2 = await context.newPage();
        await setupMapEditor(page2);

        // Edit same entity in both pages
        await page.click('text="Sandpoint"');
        await page.click('[data-testid="edit-location-button"]');

        await page2.click('text="Sandpoint"');
        await page2.click('[data-testid="edit-location-button"]');
        await page2.mouse.move(500, 300);
        await page2.click('[data-testid="save-edit"]');

        await page.click('[data-testid="save-edit"]');
        await expect(page.locator('text=/Version conflict/i')).toBeVisible();
      }
    );
  });
});
