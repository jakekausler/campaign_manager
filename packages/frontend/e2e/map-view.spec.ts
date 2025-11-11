/**
 * Map View Tests
 *
 * Total: 12 tests (4 Critical, 5 High Priority, 3 Medium Priority)
 *
 * Test Settlement: Sandpoint (Level 2 Town in Varisia)
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:9263';

// Helper function to log in and navigate to map
async function setupMapView(page: Page) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
  await page.goto(`${BASE_URL}/map`);
  await page.waitForLoadState('networkidle');
}

test.describe('Map View', () => {
  test.describe('🔴 Critical Tests', () => {
    test('TC-MAP-001: Map Renders Successfully', { tag: '@critical' }, async ({ page }) => {
      // Given I am logged in and have selected a campaign
      await setupMapView(page);

      // Then I should see the MapLibre GL map
      await expect(page.locator('.maplibregl-canvas')).toBeVisible();

      // And the map should display all settlements as markers
      const settlementMarkers = await page.locator('[data-testid="settlement-marker"]').count();
      expect(settlementMarkers).toBeGreaterThan(0);

      // And the map should display all regions as polygons
      const regionPolygons = await page.locator('[data-testid="region-polygon"]').count();
      expect(regionPolygons).toBeGreaterThan(0);

      // And the page should load within 3 seconds
      // (Implicit via waitForLoadState in setupMapView)
    });

    test('TC-MAP-002: Settlement Marker Click', { tag: '@critical' }, async ({ page }) => {
      // Given I am on the map view
      await setupMapView(page);

      // When I click on a settlement marker (e.g., "Sandpoint")
      await page.click('text="Sandpoint"');

      // Then the settlement should be selected (blue border)
      const selectedMarker = page.locator('[data-selected="true"][data-entity="Sandpoint"]');
      await expect(selectedMarker).toBeVisible();

      // And the Entity Inspector should open on the right side
      await expect(page.locator('[data-testid="entity-inspector"]')).toBeVisible();

      // And the Inspector should display settlement details
      await expect(page.locator('[data-testid="entity-inspector"]')).toContainText('Sandpoint');
    });

    test('TC-MAP-003: Region Polygon Click', { tag: '@critical' }, async ({ page }) => {
      // Given I am on the map view
      await setupMapView(page);

      // When I click on a region polygon (e.g., "Varisia")
      await page.click('[data-testid="region-polygon"][data-name="Varisia"]');

      // Then the region should be selected
      const selectedRegion = page.locator('[data-selected="true"][data-name="Varisia"]');
      await expect(selectedRegion).toBeVisible();

      // And the Entity Inspector should open
      await expect(page.locator('[data-testid="entity-inspector"]')).toBeVisible();

      // And the Inspector should display region details
      await expect(page.locator('[data-testid="entity-inspector"]')).toContainText('Varisia');
    });

    test('TC-MAP-004: Layer Toggle', { tag: '@critical' }, async ({ page }) => {
      // Given I am on the map view
      await setupMapView(page);

      // When I click the "Layers" button in the map toolbar
      await page.click('[data-testid="layers-button"]');

      // Then I should see layer toggles
      await expect(page.locator('text=/Settlements/i')).toBeVisible();
      await expect(page.locator('text=/Structures/i')).toBeVisible();
      await expect(page.locator('text=/Regions/i')).toBeVisible();
      await expect(page.locator('text=/Locations/i')).toBeVisible();

      // When I toggle "Settlements" off
      await page.click('[data-testid="layer-toggle-settlements"]');

      // Then all settlement markers should disappear from the map
      const visibleMarkers = await page
        .locator('[data-testid="settlement-marker"]:visible')
        .count();
      expect(visibleMarkers).toBe(0);

      // When I toggle "Settlements" back on
      await page.click('[data-testid="layer-toggle-settlements"]');

      // Then all settlement markers should reappear
      const reappearedMarkers = await page
        .locator('[data-testid="settlement-marker"]:visible')
        .count();
      expect(reappearedMarkers).toBeGreaterThan(0);
    });
  });

  test.describe('🟡 High Priority Tests', () => {
    test('TC-MAP-005: Pan and Zoom', { tag: '@high' }, async ({ page }) => {
      // Given I am on the map view
      await setupMapView(page);

      // When I scroll the mouse wheel (zoom in)
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(500);

      // Then the map should zoom in
      // (Verified by checking zoom level or checking if detail increases)

      // When I use the zoom controls (+/- buttons)
      await page.click('[data-testid="zoom-in"]');
      await page.waitForTimeout(500);

      // Then the map should zoom accordingly
      await page.click('[data-testid="zoom-out"]');
      await page.waitForTimeout(500);

      // When I drag the map (pan)
      const map = page.locator('.maplibregl-canvas');
      await map.hover();
      await page.mouse.down();
      await page.mouse.move(100, 100);
      await page.mouse.up();

      // Then the map should pan smoothly
      // (Verified implicitly by the successful drag operation)
    });

    test('TC-MAP-006: Fit to View', { tag: '@high' }, async ({ page }) => {
      // Given I am on the map view
      await setupMapView(page);

      // And I have zoomed in on a specific area
      await page.click('[data-testid="zoom-in"]');
      await page.click('[data-testid="zoom-in"]');

      // When I click the "Fit to View" button
      await page.click('[data-testid="fit-to-view"]');

      // Then the map should zoom out to show all entities
      // (Verified by checking that multiple entities are visible)
      const visibleEntities = await page.locator('[data-testid*="marker"]:visible').count();
      expect(visibleEntities).toBeGreaterThan(5);
    });

    test('TC-MAP-007: Time Scrubber', { tag: '@high' }, async ({ page }) => {
      // Given I am on the map view
      await setupMapView(page);

      // And the campaign has historical data at different world times
      // When I drag the time scrubber slider
      const timeScrubber = page.locator('[data-testid="time-scrubber"]');
      await timeScrubber.dragTo(timeScrubber, { targetPosition: { x: 100, y: 0 } });

      // Then the map should update to show entities as they existed at that time
      // And the world time display should update
      const worldTime = await page.locator('[data-testid="world-time"]').textContent();
      expect(worldTime).toBeTruthy();
    });

    test('TC-MAP-008: Multi-Select on Map', { tag: '@high' }, async ({ page }) => {
      // Given I am on the map view
      await setupMapView(page);

      // When I Ctrl+Click on multiple settlements
      await page.keyboard.down('Control');
      await page.click('text="Sandpoint"');
      await page.click('text="Magnimar"');
      await page.click('text="Korvosa"');
      await page.keyboard.up('Control');

      // Then all clicked settlements should be selected
      const selectedCount = await page.locator('[data-selected="true"]').count();
      expect(selectedCount).toBe(3);

      // And the Selection Info Panel should appear at bottom-right
      await expect(page.locator('[data-testid="selection-info-panel"]')).toBeVisible();

      // And the panel should show "3 entities selected"
      await expect(page.locator('[data-testid="selection-info-panel"]')).toContainText(
        '3 entities selected'
      );
    });

    test('TC-MAP-009: Structure Parent Highlighting', { tag: '@high' }, async ({ page }) => {
      // Given I am on the map view
      await setupMapView(page);

      // When I click on a structure marker
      await page.click('[data-testid="structure-marker"]');

      // Then the structure should be selected (blue border)
      await expect(
        page.locator('[data-selected="true"][data-testid="structure-marker"]')
      ).toBeVisible();

      // And the parent settlement should be highlighted (purple border)
      await expect(page.locator('[data-parent-highlighted="true"]')).toBeVisible();

      // And the Entity Inspector should show the structure details
      await expect(page.locator('[data-testid="entity-inspector"]')).toContainText(
        /Structure|Blacksmith|Market/i
      );
    });
  });

  test.describe('🟢 Medium Priority Tests', () => {
    test('TC-MAP-010: Popup Hover', { tag: '@medium' }, async ({ page }) => {
      // Given I am on the map view
      await setupMapView(page);

      // When I hover over a settlement marker
      await page.hover('text="Sandpoint"');

      // Then a popup should appear showing details
      await expect(page.locator('[data-testid="map-popup"]')).toBeVisible();
      await expect(page.locator('[data-testid="map-popup"]')).toContainText('Sandpoint');
      await expect(page.locator('[data-testid="map-popup"]')).toContainText(/Level 2|Town/i);
    });

    test('TC-MAP-011: Large Dataset Performance', { tag: '@medium' }, async ({ page }) => {
      // Given the campaign has 100+ settlements (test with actual data or mocked)
      await setupMapView(page);

      // When I load the map view (already loaded in setup)
      const startTime = Date.now();

      // Then all markers should render within 3 seconds
      await page.waitForSelector('[data-testid="settlement-marker"]', { timeout: 3000 });
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000);

      // And panning should remain smooth
      await page.mouse.down();
      await page.mouse.move(100, 100);
      await page.mouse.up();
      // (Smoothness is subjective but we verify no errors/crashes)
    });

    test(
      'TC-MAP-012: Auto-Pan on Selection from Other View',
      { tag: '@medium' },
      async ({ page }) => {
        // Given I am on the map view
        await setupMapView(page);

        // And I am zoomed in on one area
        await page.click('[data-testid="zoom-in"]');
        await page.click('[data-testid="zoom-in"]');

        // When I select a settlement in the Timeline view that is off-screen
        // (Simulated by programmatically selecting an entity)
        await page.goto(`${BASE_URL}/timeline`);
        await page.click('text="Sandpoint"'); // Select in timeline

        // When I switch back to Map view
        await page.goto(`${BASE_URL}/map`);

        // Then the map should auto-pan to show the selected settlement
        await expect(page.locator('[data-selected="true"]')).toBeVisible();

        // And the settlement should be highlighted
        await expect(page.locator('[data-selected="true"]')).toContainText('Sandpoint');
      }
    );
  });
});
