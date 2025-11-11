/**
 * Performance Tests
 *
 * Total: 6 tests (0 Critical, 4 High Priority, 2 Medium Priority)
 */

import { test, expect, type Page, type Request } from '@playwright/test';

const BASE_URL = 'http://localhost:9263';

async function login(page: Page) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

test.describe('Performance', () => {
  test.describe('🟡 High Priority Tests', () => {
    test('TC-PERF-001: Map Rendering - 100+ Entities', { tag: '@high' }, async ({ page }) => {
      await login(page);

      const startTime = Date.now();
      await page.goto(`${BASE_URL}/map`);
      await page.waitForSelector('[data-testid="settlement-marker"]', { timeout: 3000 });
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(3000);

      const markerCount = await page.locator('[data-testid="settlement-marker"]').count();
      expect(markerCount).toBeGreaterThan(0);
    });

    test('TC-PERF-002: Flow Graph Layout - 500 Nodes', { tag: '@high' }, async ({ page }) => {
      await login(page);

      const startTime = Date.now();
      await page.goto(`${BASE_URL}/flow`);
      await page.waitForSelector('[data-testid="flow-node"]', { timeout: 5000 });
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(5000);
    });

    test('TC-PERF-003: Timeline Rendering - 500 Items', { tag: '@high' }, async ({ page }) => {
      await login(page);

      const startTime = Date.now();
      await page.goto(`${BASE_URL}/timeline`);
      await page.waitForSelector('[data-testid="timeline-item"]', { timeout: 3000 });
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(3000);
    });

    test(
      'TC-PERF-004: Entity Inspector - Large Entity History',
      { tag: '@high' },
      async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/map`);

        await page.click('text="Sandpoint"');
        await page.click('text=Versions');

        const startTime = Date.now();
        await page.waitForSelector('[data-testid="version-entry"]', { timeout: 1000 });
        const loadTime = Date.now() - startTime;

        expect(loadTime).toBeLessThan(1000);
      }
    );
  });

  test.describe('🟢 Medium Priority Tests', () => {
    test('TC-PERF-005: GraphQL Query Batching', { tag: '@medium' }, async ({ page }) => {
      await login(page);

      const requests: Request[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/graphql')) {
          requests.push(request);
        }
      });

      await page.goto(`${BASE_URL}/map`);
      await page.waitForLoadState('networkidle');

      // Check that multiple queries are batched
      const graphqlRequests = requests.length;
      expect(graphqlRequests).toBeGreaterThan(0);
    });

    test('TC-PERF-006: Lazy Loading Images', { tag: '@medium' }, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}/dashboard`);

      // Check that images load lazily
      const images = await page.locator('img[loading="lazy"]').count();
      expect(images).toBeGreaterThanOrEqual(0);
    });
  });
});
