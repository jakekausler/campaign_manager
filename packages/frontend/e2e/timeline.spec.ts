/**
 * Timeline View Tests
 *
 * Total: 12 tests (3 Critical, 8 High Priority, 1 Medium Priority)
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:9263';

async function setupTimelineView(page: Page) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
  await page.goto(`${BASE_URL}/timeline`);
  await page.waitForLoadState('networkidle');
}

test.describe('Timeline View', () => {
  test.describe('🔴 Critical Tests', () => {
    test('TC-TIME-001: Timeline Renders Successfully', { tag: '@critical' }, async ({ page }) => {
      await setupTimelineView(page);

      await expect(page.locator('[data-testid="timeline-visualization"]')).toBeVisible();

      const eventItems = await page.locator('[data-testid="timeline-event"]').count();
      expect(eventItems).toBeGreaterThan(0);

      await expect(page.locator('[data-testid="current-time-marker"]')).toBeVisible();
    });

    test('TC-TIME-002: Event Click', { tag: '@critical' }, async ({ page }) => {
      await setupTimelineView(page);

      await page.click('[data-testid="timeline-event"]');

      await expect(page.locator('[data-selected="true"]')).toBeVisible();
      await expect(page.locator('[data-testid="entity-inspector"]')).toBeVisible();
    });

    test('TC-TIME-003: Color Coding by Status', { tag: '@critical' }, async ({ page }) => {
      await setupTimelineView(page);

      const completedEvents = await page.locator('[data-status="completed"]').count();
      const scheduledEvents = await page.locator('[data-status="scheduled"]').count();

      expect(completedEvents + scheduledEvents).toBeGreaterThan(0);
    });
  });

  test.describe('🟡 High Priority Tests', () => {
    test('TC-TIME-004: Drag to Reschedule', { tag: '@high' }, async ({ page }) => {
      await setupTimelineView(page);

      const event = page.locator('[data-status="scheduled"]').first();
      const eventBounds = await event.boundingBox();

      if (eventBounds) {
        await event.dragTo(event, { targetPosition: { x: eventBounds.x + 100, y: eventBounds.y } });

        await expect(page.locator('[data-testid="confirmation-dialog"]')).toBeVisible();
        await page.click('button:has-text("Confirm")');
      }
    });

    test(
      'TC-TIME-005: Validation - Cannot Reschedule to Past',
      { tag: '@high' },
      async ({ page }) => {
        await setupTimelineView(page);

        // Try to drag event before current time marker
        const event = page.locator('[data-status="scheduled"]').first();
        await event.dragTo(event, { targetPosition: { x: 50, y: 0 } });

        await expect(page.locator('text=/Cannot schedule event in the past/i')).toBeVisible();
      }
    );

    test(
      'TC-TIME-006: Validation - Cannot Reschedule Completed',
      { tag: '@high' },
      async ({ page }) => {
        await setupTimelineView(page);

        const completedEvent = page.locator('[data-status="completed"]').first();
        const isDraggable = await completedEvent.getAttribute('draggable');

        expect(isDraggable).toBeFalsy();
      }
    );

    test('TC-TIME-007: Filter by Event Type', { tag: '@high' }, async ({ page }) => {
      await setupTimelineView(page);

      await page.click('[data-testid="filter-button"]');
      await page.uncheck('[data-testid="filter-encounters"]');

      const visibleEncounters = await page.locator('[data-type="encounter"]:visible').count();
      expect(visibleEncounters).toBe(0);
    });

    test('TC-TIME-008: Filter by Status', { tag: '@high' }, async ({ page }) => {
      await setupTimelineView(page);

      await page.click('[data-testid="filter-button"]');
      await page.check('[data-testid="filter-completed-only"]');

      const visibleItems = await page.locator('[data-testid="timeline-item"]:visible').count();
      const completedItems = await page.locator('[data-status="completed"]:visible').count();

      expect(visibleItems).toBe(completedItems);
    });

    test('TC-TIME-009: Group by Type', { tag: '@high' }, async ({ page }) => {
      await setupTimelineView(page);

      await page.click('[data-testid="settings-button"]');
      await page.check('[data-testid="group-by-type"]');

      await expect(page.locator('[data-testid="timeline-group"]')).toHaveCount(2);
    });

    test('TC-TIME-010: Zoom Controls', { tag: '@high' }, async ({ page }) => {
      await setupTimelineView(page);

      await page.click('[data-testid="zoom-in"]');
      await page.waitForTimeout(300);

      await page.click('[data-testid="zoom-out"]');
      await page.waitForTimeout(300);

      await page.click('[data-testid="zoom-fit"]');
      await page.waitForTimeout(300);
    });

    test('TC-TIME-011: Jump to Current Time', { tag: '@high' }, async ({ page }) => {
      await setupTimelineView(page);

      // Scroll away from current time
      await page.mouse.wheel(100, 0);

      // Press T key or click button
      await page.keyboard.press('t');

      // Should scroll to current time marker
      await expect(page.locator('[data-testid="current-time-marker"]')).toBeInViewport();
    });
  });

  test.describe('🟢 Medium Priority Tests', () => {
    test('TC-TIME-012: Keyboard Shortcuts', { tag: '@medium' }, async ({ page }) => {
      await setupTimelineView(page);

      await page.keyboard.press('+');
      await page.waitForTimeout(200);

      await page.keyboard.press('-');
      await page.waitForTimeout(200);

      await page.keyboard.press('0');
      await page.waitForTimeout(200);

      await page.keyboard.press('Escape');
    });
  });
});
