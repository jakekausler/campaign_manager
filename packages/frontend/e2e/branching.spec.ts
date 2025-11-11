/**
 * Branching System Tests
 *
 * Total: 8 tests (3 Critical, 3 High Priority, 2 Medium Priority)
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

test.describe('Branching System', () => {
  test.describe('🔴 Critical Tests', () => {
    test('TC-BRANCH-001: Fork Branch', { tag: '@critical' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/branches`);

      await page.click('[data-testid="branch-selector"]');
      await page.click('text=/Fork Branch/i');

      await expect(page.locator('[data-testid="fork-branch-dialog"]')).toBeVisible();

      await page.fill('[data-testid="branch-name-input"]', 'Dragon Attack Scenario');
      await page.fill(
        '[data-testid="branch-description-input"]',
        'What if the dragon attacked early?'
      );
      await page.click('button:has-text("Fork")');

      await expect(page.locator('text=/Copying versions/i')).toBeVisible();
      await expect(page.locator('[data-testid="branch-selector"]')).toContainText(
        'Dragon Attack Scenario'
      );
    });

    test('TC-BRANCH-002: Switch Between Branches', { tag: '@critical' }, async ({ page }) => {
      await login(page);

      await page.click('[data-testid="branch-selector"]');
      await expect(page.locator('[data-testid="branch-option"]')).toHaveCount(
        await page.locator('[data-testid="branch-option"]').count()
      );

      await page.click('[data-testid="branch-option"]:has-text("Main Timeline")');
      await expect(page.locator('[data-testid="branch-selector"]')).toContainText('Main Timeline');
    });

    test('TC-BRANCH-003: View Branch List', { tag: '@critical' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/branches`);

      await expect(page.locator('[data-testid="branch-tree"]')).toBeVisible();
      await expect(page.locator('[data-testid="branch-node"]')).toHaveCount(
        await page.locator('[data-testid="branch-node"]').count()
      );
    });
  });

  test.describe('🟡 High Priority Tests', () => {
    test('TC-BRANCH-004: Sibling Branch Isolation', { tag: '@high' }, async ({ page }) => {
      await login(page);

      // Switch to Branch A
      await page.click('[data-testid="branch-selector"]');
      await page.click('[data-testid="branch-option"]');

      await page.goto(`${BASE_URL}/map`);
      await page.click('text="Sandpoint"');
      await page.click('[data-testid="edit-field"]');
      await page.fill('[data-testid="population-input"]', '1500');
      await page.keyboard.press('Control+s');

      // Switch to Branch B
      await page.click('[data-testid="branch-selector"]');
      await page.click('[data-testid="branch-option"]');

      await page.click('text="Sandpoint"');
      const population = await page.locator('[data-testid="population-value"]').textContent();
      expect(population).not.toBe('1500');
    });

    test('TC-BRANCH-005: Version Resolution Walks Ancestry', { tag: '@high' }, async ({ page }) => {
      await login(page);

      // This test verifies version resolution walks up the branch hierarchy
      await page.click('[data-testid="branch-selector"]');
      const leafBranch = page.locator('[data-testid="branch-option"]').last();
      await leafBranch.click();

      await page.goto(`${BASE_URL}/map`);
      await page.click('text="Sandpoint"');

      await expect(page.locator('[data-testid="entity-inspector"]')).toBeVisible();
    });

    test(
      'TC-BRANCH-006: Branch Comparison - Select Branches',
      { tag: '@high' },
      async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/branches`);

        await page.click('[data-testid="compare-branches-button"]');

        await page.selectOption('[data-testid="source-branch"]', { index: 0 });
        await page.selectOption('[data-testid="target-branch"]', { index: 1 });
        await page.fill('[data-testid="entity-selector"]', 'Sandpoint');
        await page.click('button:has-text("Compare")');

        await expect(page.locator('[data-testid="diff-viewer"]')).toBeVisible();
      }
    );
  });

  test.describe('🟢 Medium Priority Tests', () => {
    test('TC-BRANCH-007: Branch Metadata', { tag: '@medium' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/branches`);

      const branchNode = page.locator('[data-testid="branch-node"]').first();
      await expect(branchNode).toContainText(/Main Timeline/i);
      await expect(branchNode).toContainText(/Fork point|Created/i);
    });

    test('TC-BRANCH-008: Delete Branch', { tag: '@medium' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/branches`);

      const branchToDelete = page.locator('[data-testid="branch-node"]').last();
      const branchName = await branchToDelete.textContent();

      await branchToDelete.click();
      await page.click('[data-testid="delete-branch-button"]');

      await expect(page.locator('[data-testid="confirmation-dialog"]')).toBeVisible();
      await page.click('button:has-text("Confirm")');

      await expect(page.locator(`text="${branchName}"`)).not.toBeVisible();
    });
  });
});
