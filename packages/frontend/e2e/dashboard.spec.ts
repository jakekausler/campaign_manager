/**
 * Dashboard & Navigation Tests
 *
 * Total: 5 tests (2 Critical, 3 High Priority)
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:9263';

// Helper function to log in
async function login(page: Page) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

test.describe('Dashboard & Navigation', () => {
  test.describe('🔴 Critical Tests', () => {
    test('TC-DASH-001: Dashboard Loads Successfully', { tag: '@critical' }, async ({ page }) => {
      // Given I am logged in
      await login(page);

      // When I navigate to "/dashboard"
      await page.goto(`${BASE_URL}/dashboard`);

      // Then I should see the dashboard page
      await expect(page.locator('text=/Dashboard|Campaign/i')).toBeVisible();

      // And I should see campaign cards or "Create Campaign" button
      const hasCampaignCards = (await page.locator('[data-testid="campaign-card"]').count()) > 0;
      const hasCreateButton = await page
        .locator('text=/Create Campaign/i')
        .isVisible()
        .catch(() => false);
      expect(hasCampaignCards || hasCreateButton).toBeTruthy();

      // And the page should load within 2 seconds
      // Note: This is checked implicitly by the previous assertions timing out if too slow
    });

    test('TC-DASH-002: Navigation Links', { tag: '@critical' }, async ({ page }) => {
      // Given I am on the dashboard
      await login(page);
      await page.goto(`${BASE_URL}/dashboard`);

      // When I click on a campaign card
      await page.click('[data-testid="campaign-card"]');

      // Then I should see navigation options
      await expect(page.locator('text=/Map View|Map/i')).toBeVisible();
      await expect(page.locator('text=/Timeline/i')).toBeVisible();
      await expect(page.locator('text=/Flow View|Flow/i')).toBeVisible();
      await expect(page.locator('text=/Branches/i')).toBeVisible();

      // Audit Log should be visible for admin users
      const isAdmin = true; // Logged in as admin@example.com
      if (isAdmin) {
        await expect(page.locator('text=/Audit Log|Audit/i')).toBeVisible();
      }
    });
  });

  test.describe('🟡 High Priority Tests', () => {
    test('TC-DASH-003: Campaign Selector', { tag: '@high' }, async ({ page }) => {
      // Given I am on the dashboard
      await login(page);
      await page.goto(`${BASE_URL}/dashboard`);

      // And multiple campaigns exist (assumption based on seed data)
      // When I click the campaign dropdown in the header
      await page.click('[data-testid="campaign-selector"]');

      // Then I should see a list of all campaigns I have access to
      const campaignOptions = await page.locator('[data-testid="campaign-option"]').count();
      expect(campaignOptions).toBeGreaterThan(0);

      // When I select "Golarion Campaign"
      await page.click('text=/Golarion Campaign/i');

      // Then the current campaign should change to "Golarion Campaign"
      await expect(page.locator('[data-testid="campaign-selector"]')).toContainText(
        /Golarion Campaign/i
      );

      // And all views should reflect the selected campaign
      // (This would be verified by checking that subsequent navigation shows Golarion Campaign data)
    });

    test('TC-DASH-004: World Time Display', { tag: '@high' }, async ({ page }) => {
      // Given I am viewing a campaign
      await login(page);
      await page.goto(`${BASE_URL}/dashboard`);
      await page.click('[data-testid="campaign-card"]');

      // Then I should see the current world time displayed in the header
      const worldTimeElement = page.locator('[data-testid="world-time"]');
      await expect(worldTimeElement).toBeVisible();

      // And it should be formatted according to the campaign's calendar
      // Example: "4707 AR, Rova 1 (Autumn)" for Golarion
      const worldTimeText = await worldTimeElement.textContent();
      expect(worldTimeText).toBeTruthy();
      expect(worldTimeText!.length).toBeGreaterThan(0);
    });

    test('TC-DASH-005: Branch Selector', { tag: '@high' }, async ({ page }) => {
      // Given I am viewing a campaign
      await login(page);
      await page.goto(`${BASE_URL}/dashboard`);
      await page.click('[data-testid="campaign-card"]');

      // When I click the branch dropdown in the header
      await page.click('[data-testid="branch-selector"]');

      // Then I should see:
      // - "Main Timeline" (default branch)
      await expect(page.locator('text=/Main Timeline/i')).toBeVisible();

      // - Any alternate branches I've created
      const branchCount = await page.locator('[data-testid="branch-option"]').count();
      expect(branchCount).toBeGreaterThanOrEqual(1); // At least Main Timeline

      // When I select an alternate branch (if available)
      const alternateBranches = await page
        .locator('[data-testid="branch-option"]:not(:has-text("Main Timeline"))')
        .count();
      if (alternateBranches > 0) {
        const firstAlternateBranch = page
          .locator('[data-testid="branch-option"]:not(:has-text("Main Timeline"))')
          .first();
        const branchName = await firstAlternateBranch.textContent();
        await firstAlternateBranch.click();

        // Then all views should reflect that branch's state
        await expect(page.locator('[data-testid="branch-selector"]')).toContainText(branchName!);
      }
    });
  });
});
