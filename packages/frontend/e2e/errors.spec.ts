/**
 * Error Handling & Validation Tests
 *
 * Total: 8 tests (3 Critical, 4 High Priority, 1 Medium Priority)
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

test.describe('Error Handling & Validation', () => {
  test.describe('🔴 Critical Tests', () => {
    test('TC-ERROR-001: GraphQL Query Error', { tag: '@critical' }, async ({ page }) => {
      await login(page);

      // Simulate network timeout or GraphQL error
      await page.route('**/graphql', (route) => route.abort('timedout'));

      await page.goto(`${BASE_URL}/map`);

      await expect(page.locator('text=/Failed to load|Error/i')).toBeVisible();
    });

    test('TC-ERROR-002: GraphQL Mutation Error', { tag: '@critical' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/map`);
      await page.waitForLoadState('networkidle');

      await page.click('text="Sandpoint"');
      await page.click('[data-testid="settlement-name-field"]');
      await page.fill('[data-testid="settlement-name-input"]', '');

      await page.keyboard.press('Control+s');

      await expect(page.locator('text=/validation error|required/i')).toBeVisible();
    });

    test('TC-ERROR-003: Network Timeout', { tag: '@critical' }, async ({ page }) => {
      await login(page);

      await page.route('**/graphql', (route) => {
        return new Promise(() => setTimeout(() => route.abort('timedout'), 5000));
      });

      await page.goto(`${BASE_URL}/map`);

      await expect(page.locator('text=/timed out|try again/i')).toBeVisible();
    });
  });

  test.describe('🟡 High Priority Tests', () => {
    test(
      'TC-ERROR-004: Form Validation - Empty Required Field',
      { tag: '@high' },
      async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/map`);

        // Simulate creating a new settlement
        await page.click('[data-testid="create-settlement-button"]');
        await page.click('button:has-text("Save")');

        await expect(page.locator('text=/Name is required/i')).toBeVisible();
      }
    );

    test('TC-ERROR-005: Form Validation - Invalid Number', { tag: '@high' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/map`);

      await page.click('text="Sandpoint"');
      await page.click('[data-testid="population-field"]');
      await page.fill('[data-testid="population-input"]', 'abc');

      await expect(page.locator('text=/Invalid number/i')).toBeVisible();
    });

    test('TC-ERROR-006: 404 - Page Not Found', { tag: '@high' }, async ({ page }) => {
      await login(page);

      await page.goto(`${BASE_URL}/nonexistent-page`);

      await expect(page.locator('text=/404|Page Not Found/i')).toBeVisible();
    });

    test('TC-ERROR-007: 500 - Internal Server Error', { tag: '@high' }, async ({ page }) => {
      await login(page);

      await page.route('**/graphql', (route) => {
        route.fulfill({ status: 500, body: 'Internal Server Error' });
      });

      await page.goto(`${BASE_URL}/map`);

      await expect(page.locator('text=/Something went wrong|try again later/i')).toBeVisible();
    });
  });

  test.describe('🟢 Medium Priority Tests', () => {
    test('TC-ERROR-008: Optimistic UI Rollback', { tag: '@medium' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/map`);
      await page.waitForLoadState('networkidle');

      await page.click('text="Sandpoint"');
      const originalName = await page.locator('[data-testid="inspector-title"]').textContent();

      await page.click('[data-testid="settlement-name-field"]');
      await page.fill('[data-testid="settlement-name-input"]', 'New Name');

      // Intercept and fail the mutation
      await page.route('**/graphql', (route) => {
        route.fulfill({ status: 500 });
      });

      await page.keyboard.press('Control+s');

      // Should revert to original value
      await expect(page.locator('[data-testid="inspector-title"]')).toContainText(originalName!);
    });
  });
});
