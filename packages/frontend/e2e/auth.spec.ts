/**
 * Authentication & Authorization Tests
 *
 * Total: 7 tests (4 Critical, 3 High Priority)
 *
 * Test Users:
 * - admin@example.com / admin123 (OWNER role)
 * - gm@example.com / gm123 (GM role)
 * - player@example.com / player123 (PLAYER role)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:9263';

test.describe('Authentication & Authorization', () => {
  test.describe('🔴 Critical Tests', () => {
    test('TC-AUTH-001: Successful Login', { tag: '@critical' }, async ({ page }) => {
      // Given I am on the login page
      await page.goto(`${BASE_URL}/auth/login`);

      // When I enter valid credentials
      await page.fill('input[name="email"]', 'admin@example.com');
      await page.fill('input[name="password"]', 'admin123');

      // And I click the "Sign In" button
      await page.click('button[type="submit"]');

      // Then I should be redirected to "/dashboard"
      await expect(page).toHaveURL(/.*dashboard/);

      // And localStorage should contain "accessToken"
      const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
      expect(accessToken).toBeTruthy();

      // And I should see user info or welcome message
      await expect(page.locator('text=/Welcome back|Admin User|Dashboard/i')).toBeVisible();
    });

    test(
      'TC-AUTH-002: Failed Login - Invalid Credentials',
      { tag: '@critical' },
      async ({ page }) => {
        // Given I am on the login page
        await page.goto(`${BASE_URL}/auth/login`);

        // When I enter invalid credentials
        await page.fill('input[name="email"]', 'invalid@example.com');
        await page.fill('input[name="password"]', 'wrongpassword');

        // And I click the "Sign In" button
        await page.click('button[type="submit"]');

        // Then I should see an error message
        await expect(page.locator('text=/Invalid email or password/i')).toBeVisible();

        // And I should remain on the login page
        await expect(page).toHaveURL(/.*login/);

        // And localStorage should NOT contain "accessToken"
        const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
        expect(accessToken).toBeFalsy();
      }
    );

    test('TC-AUTH-003: Logout', { tag: '@critical' }, async ({ page }) => {
      // Given I am logged in as "admin@example.com"
      await page.goto(`${BASE_URL}/auth/login`);
      await page.fill('input[name="email"]', 'admin@example.com');
      await page.fill('input[name="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/.*dashboard/);

      // When I click the user menu in the top-right corner
      await page.click('[data-testid="user-menu"]');

      // And I click "Logout"
      await page.click('text=/Logout/i');

      // Then I should be redirected to "/auth/login"
      await expect(page).toHaveURL(/.*login/);

      // And localStorage should NOT contain "accessToken"
      const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
      expect(accessToken).toBeFalsy();
    });

    test(
      'TC-AUTH-004: Protected Route - Unauthorized Access',
      { tag: '@critical' },
      async ({ page }) => {
        // Given I am NOT logged in
        // Clear any existing auth tokens
        await page.goto(BASE_URL);
        await page.evaluate(() => localStorage.clear());

        // When I navigate to "/dashboard"
        await page.goto(`${BASE_URL}/dashboard`);

        // Then I should be redirected to "/auth/login"
        await expect(page).toHaveURL(/.*login/);
      }
    );
  });

  test.describe('🟡 High Priority Tests', () => {
    test('TC-AUTH-005: Remember Me Functionality', { tag: '@high' }, async ({ page, context }) => {
      // Given I am on the login page
      await page.goto(`${BASE_URL}/auth/login`);

      // When I enter valid credentials
      await page.fill('input[name="email"]', 'admin@example.com');
      await page.fill('input[name="password"]', 'admin123');

      // And I check the "Remember me" checkbox
      await page.check('input[name="remember"]');

      // And I click "Sign In"
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/.*dashboard/);

      // And I close the browser context
      await context.close();

      // When I reopen the browser and navigate to the app
      const newContext = await context.browser()!.newContext();
      const newPage = await newContext.newPage();
      await newPage.goto(BASE_URL);

      // Then I should still be logged in
      // Note: This test assumes persistent storage between contexts
      // Implementation may vary based on actual auth mechanism
      await expect(newPage).toHaveURL(/.*dashboard/);

      await newContext.close();
    });

    test('TC-AUTH-006: Session Expiration', { tag: '@high' }, async ({ page }) => {
      // Given I am logged in
      await page.goto(`${BASE_URL}/auth/login`);
      await page.fill('input[name="email"]', 'admin@example.com');
      await page.fill('input[name="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/.*dashboard/);

      // When the JWT token expires (simulated by clearing token)
      await page.evaluate(() => localStorage.removeItem('accessToken'));

      // And I attempt to make an API request
      await page.goto(`${BASE_URL}/map`);

      // Then I should be redirected to the login page
      await expect(page).toHaveURL(/.*login/);

      // And I should see a session expired message
      await expect(page.locator('text=/Session expired|Please log in again/i')).toBeVisible();
    });

    test('TC-AUTH-007: Permission-Based UI (Admin vs GM)', { tag: '@high' }, async ({ page }) => {
      // Given I am logged in as "admin@example.com" (OWNER role)
      await page.goto(`${BASE_URL}/auth/login`);
      await page.fill('input[name="email"]', 'admin@example.com');
      await page.fill('input[name="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/.*dashboard/);

      // When I navigate to "/audit"
      await page.goto(`${BASE_URL}/audit`);

      // Then I should see the Audit Log page
      await expect(page.locator('text=/Audit Log/i')).toBeVisible();

      // Log out
      await page.click('[data-testid="user-menu"]');
      await page.click('text=/Logout/i');

      // Given I log out and log in as "gm@example.com" (GM role)
      await page.goto(`${BASE_URL}/auth/login`);
      await page.fill('input[name="email"]', 'gm@example.com');
      await page.fill('input[name="password"]', 'gm123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/.*dashboard/);

      // When I navigate to "/audit"
      await page.goto(`${BASE_URL}/audit`);

      // Then I should see "Access Denied" or be redirected to "/dashboard"
      const currentUrl = page.url();
      const isAccessDenied = await page
        .locator('text=/Access Denied|Forbidden/i')
        .isVisible()
        .catch(() => false);
      const isRedirected = currentUrl.includes('/dashboard');

      expect(isAccessDenied || isRedirected).toBeTruthy();
    });
  });
});
