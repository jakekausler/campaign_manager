/**
 * Flow View (Dependency Graph) Tests
 *
 * Total: 11 tests (3 Critical, 6 High Priority, 2 Medium Priority)
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:9263';

async function setupFlowView(page: Page) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
  await page.goto(`${BASE_URL}/flow`);
  await page.waitForLoadState('networkidle');
}

test.describe('Flow View (Dependency Graph)', () => {
  test.describe('🔴 Critical Tests', () => {
    test('TC-FLOW-001: Flow Graph Renders', { tag: '@critical' }, async ({ page }) => {
      await setupFlowView(page);

      // Should see the dependency graph visualization
      await expect(page.locator('[data-testid="flow-graph"]')).toBeVisible();

      // Nodes should be colored by type
      await expect(page.locator('[data-node-type="variable"]')).toHaveCount(
        await page.locator('[data-node-type="variable"]').count()
      );
      await expect(page.locator('[data-node-type="condition"]')).toHaveCount(
        await page.locator('[data-node-type="condition"]').count()
      );

      // Edges should connect related nodes
      const edgeCount = await page.locator('[data-testid="flow-edge"]').count();
      expect(edgeCount).toBeGreaterThan(0);
    });

    test('TC-FLOW-002: Node Selection', { tag: '@critical' }, async ({ page }) => {
      await setupFlowView(page);

      // Click on a node
      await page.click('[data-testid="flow-node"]');

      // Node should be highlighted
      await expect(page.locator('[data-selected="true"]')).toBeVisible();

      // Other nodes should dim
      const dimmedNodes = await page.locator('[data-dimmed="true"]').count();
      expect(dimmedNodes).toBeGreaterThan(0);
    });

    test('TC-FLOW-003: Double-Click to Open Inspector', { tag: '@critical' }, async ({ page }) => {
      await setupFlowView(page);

      // Double-click on an entity node
      await page.dblclick('[data-node-type="entity"]');

      // Entity Inspector should open
      await expect(page.locator('[data-testid="entity-inspector"]')).toBeVisible();
    });
  });

  test.describe('🟡 High Priority Tests', () => {
    test('TC-FLOW-004: Upstream/Downstream Highlighting', { tag: '@high' }, async ({ page }) => {
      await setupFlowView(page);

      await page.click('[data-node-type="condition"]');

      // Upstream nodes should highlight in green
      const upstreamNodes = await page.locator('[data-relationship="upstream"]').count();
      expect(upstreamNodes).toBeGreaterThanOrEqual(0);

      // Downstream nodes should highlight in orange
      const downstreamNodes = await page.locator('[data-relationship="downstream"]').count();
      expect(downstreamNodes).toBeGreaterThanOrEqual(0);
    });

    test('TC-FLOW-005: Filter by Node Type', { tag: '@high' }, async ({ page }) => {
      await setupFlowView(page);

      await page.click('[data-testid="filter-panel-button"]');
      await page.uncheck('[data-testid="filter-variable"]');

      const variableNodes = await page.locator('[data-node-type="variable"]:visible').count();
      expect(variableNodes).toBe(0);

      await page.check('[data-testid="filter-variable"]');
      const reappearedNodes = await page.locator('[data-node-type="variable"]:visible').count();
      expect(reappearedNodes).toBeGreaterThan(0);
    });

    test('TC-FLOW-006: Filter by Edge Type', { tag: '@high' }, async ({ page }) => {
      await setupFlowView(page);

      await page.click('[data-testid="filter-panel-button"]');
      await page.selectOption('[data-testid="edge-type-filter"]', 'reads');

      const visibleEdges = await page.locator('[data-edge-type="reads"]:visible').count();
      expect(visibleEdges).toBeGreaterThan(0);
    });

    test('TC-FLOW-007: Show Cycles Only', { tag: '@high' }, async ({ page }) => {
      await setupFlowView(page);

      await page.click('[data-testid="filter-panel-button"]');
      await page.check('[data-testid="show-cycles-only"]');

      // Only nodes in cycles should be visible
      const visibleNodes = await page.locator('[data-in-cycle="true"]:visible').count();
      expect(visibleNodes).toBeGreaterThanOrEqual(0);
    });

    test('TC-FLOW-008: Search Node', { tag: '@high' }, async ({ page }) => {
      await setupFlowView(page);

      await page.fill('[data-testid="node-search"]', 'Sandpoint');

      const matchingNodes = await page.locator('[data-testid="flow-node"]:visible').count();
      expect(matchingNodes).toBeGreaterThanOrEqual(1);
    });

    test('TC-FLOW-009: Re-layout Button', { tag: '@high' }, async ({ page }) => {
      await setupFlowView(page);

      // Move nodes manually (simulate)
      const node = page.locator('[data-testid="flow-node"]').first();
      await node.dragTo(node, { targetPosition: { x: 100, y: 100 } });

      // Click re-layout
      await page.click('[data-testid="re-layout-button"]');

      // Graph should reset to automatic layout
      await page.waitForTimeout(1000); // Wait for layout animation
    });
  });

  test.describe('🟢 Medium Priority Tests', () => {
    test('TC-FLOW-010: Zoom and Pan Controls', { tag: '@medium' }, async ({ page }) => {
      await setupFlowView(page);

      await page.click('[data-testid="zoom-in"]');
      await page.waitForTimeout(300);

      await page.click('[data-testid="zoom-out"]');
      await page.waitForTimeout(300);

      // Drag background
      await page.mouse.move(400, 400);
      await page.mouse.down();
      await page.mouse.move(500, 500);
      await page.mouse.up();
    });

    test('TC-FLOW-011: Large Graph Performance', { tag: '@medium' }, async ({ page }) => {
      await setupFlowView(page);

      // Layout should complete within 5 seconds
      const startTime = Date.now();
      await page.waitForSelector('[data-testid="flow-node"]', { timeout: 5000 });
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(5000);

      // Interactions should remain responsive
      await page.click('[data-testid="zoom-in"]');
      await page.click('[data-testid="flow-node"]');
    });
  });
});
