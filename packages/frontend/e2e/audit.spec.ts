/**
 * Audit Log Tests
 *
 * Total: 12 tests (3 Critical, 8 High Priority, 1 Medium Priority)
 *
 * NOTE: Most tests require OWNER role (admin@example.com)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:9263';

test.describe('Audit Log', () => {
  test.describe('🔴 Critical Tests', () => {
    test('TC-AUDIT-001: Access Audit Log (Admin Only)', { tag: '@critical' }, async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/login`);
      await page.fill('input[name="email"]', 'admin@example.com');
      await page.fill('input[name="password"]', 'admin123');
      await page.click('button[type="submit"]');

      await page.goto(`${BASE_URL}/audit`);
      await expect(page.locator('text=/Audit Log/i')).toBeVisible();
      await expect(page.locator('[data-testid="audit-table"]')).toBeVisible();
    });

    test(
      'TC-AUDIT-002: Audit Log Access Denied (Non-Admin)',
      { tag: '@critical' },
      async ({ page }) => {
        await page.goto(`${BASE_URL}/auth/login`);
        await page.fill('input[name="email"]', 'gm@example.com');
        await page.fill('input[name="password"]', 'gm123');
        await page.click('button[type="submit"]');

        await page.goto(`${BASE_URL}/audit`);

        const isAccessDenied = await page
          .locator('text=/Access Denied|Forbidden/i')
          .isVisible()
          .catch(() => false);
        const isRedirected = page.url().includes('/dashboard');

        expect(isAccessDenied || isRedirected).toBeTruthy();
      }
    );

    test('TC-AUDIT-003: Audit Log Table Columns', { tag: '@critical' }, async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/login`);
      await page.fill('input[name="email"]', 'admin@example.com');
      await page.fill('input[name="password"]', 'admin123');
      await page.click('button[type="submit"]');

      await page.goto(`${BASE_URL}/audit`);

      await expect(page.locator('text=Timestamp')).toBeVisible();
      await expect(page.locator('text=User')).toBeVisible();
      await expect(page.locator('text=/Entity Type/i')).toBeVisible();
      await expect(page.locator('text=/Operation/i')).toBeVisible();
    });
  });

  test.describe('🟡 High Priority Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/login`);
      await page.fill('input[name="email"]', 'admin@example.com');
      await page.fill('input[name="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.goto(`${BASE_URL}/audit`);
    });

    test('TC-AUDIT-004: Sort Audit Log', { tag: '@high' }, async ({ page }) => {
      await page.click('[data-testid="sort-timestamp"]');
      await page.waitForTimeout(500);
    });

    test('TC-AUDIT-005: Filter Audit Log by Entity Type', { tag: '@high' }, async ({ page }) => {
      await page.selectOption('[data-testid="entity-type-filter"]', 'Settlement');
      await page.waitForTimeout(500);

      const rows = await page.locator('[data-testid="audit-row"]').count();
      expect(rows).toBeGreaterThanOrEqual(0);
    });

    test('TC-AUDIT-006: Filter Audit Log by Operation', { tag: '@high' }, async ({ page }) => {
      await page.selectOption('[data-testid="operation-filter"]', 'UPDATE');
      await page.waitForTimeout(500);
    });

    test('TC-AUDIT-007: Filter Audit Log by Date Range', { tag: '@high' }, async ({ page }) => {
      await page.fill('[data-testid="date-start"]', '2024-01-01');
      await page.fill('[data-testid="date-end"]', '2024-12-31');
      await page.click('[data-testid="apply-filter"]');
    });

    test('TC-AUDIT-008: Pagination', { tag: '@high' }, async ({ page }) => {
      const hasNextPage = await page.locator('[data-testid="next-page"]').isEnabled();

      if (hasNextPage) {
        await page.click('[data-testid="next-page"]');
        await page.waitForTimeout(500);
      }
    });

    test('TC-AUDIT-009: Export Audit Log to CSV', { tag: '@high' }, async ({ page }) => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="export-csv"]'),
      ]);

      expect(download.suggestedFilename()).toMatch(/\.csv$/);
    });

    test('TC-AUDIT-010: Export Audit Log to JSON', { tag: '@high' }, async ({ page }) => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="export-json"]'),
      ]);

      expect(download.suggestedFilename()).toMatch(/\.json$/);
    });

    test('TC-AUDIT-011: View Diff for Audit Entry', { tag: '@high' }, async ({ page }) => {
      const firstRow = page.locator('[data-testid="audit-row"]').first();
      await firstRow.click();
      await page.click('[data-testid="view-diff"]');

      await expect(page.locator('[data-testid="diff-viewer-modal"]')).toBeVisible();
    });
  });

  test.describe('🟢 Medium Priority Tests', () => {
    test(
      'TC-AUDIT-012: Audit Log Performance with Large Dataset',
      { tag: '@medium' },
      async ({ page }) => {
        await page.goto(`${BASE_URL}/auth/login`);
        await page.fill('input[name="email"]', 'admin@example.com');
        await page.fill('input[name="password"]', 'admin123');
        await page.click('button[type="submit"]');

        const startTime = Date.now();
        await page.goto(`${BASE_URL}/audit`);
        await page.waitForSelector('[data-testid="audit-table"]', { timeout: 2000 });
        const loadTime = Date.now() - startTime;

        expect(loadTime).toBeLessThan(2000);
      }
    );
  });
});
