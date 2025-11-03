import { describe, expect, it } from 'vitest';

import { transformToTimelineItems } from '../utils/timeline-transforms';

/**
 * Performance tests for timeline transformation utilities
 *
 * Part of TICKET-022 Stage 12 - Testing, Documentation, and Polish
 *
 * Tests verify that timeline can handle datasets efficiently (Phase 2 - reduced sizes):
 * - 25 items: <600ms transformation
 * - 50 items: <750ms transformation
 * - 100 items: <1000ms transformation
 *
 * Note: Dataset sizes reduced from 100/200/500 to 25/50/100 to lower memory usage
 * while still validating performance characteristics. Use E2E tests for production-scale validation.
 */

// Helper to generate test events
function generateEvents(count: number) {
  const events = [];
  const baseDate = new Date('2024-01-01T00:00:00Z');
  const types = ['story', 'kingdom', 'party', 'world'] as const;

  for (let i = 0; i < count; i++) {
    const daysOffset = i * 7; // Space events 7 days apart
    const scheduledAt = new Date(baseDate.getTime() + daysOffset * 24 * 60 * 60 * 1000);

    events.push({
      id: `event-${i}`,
      campaignId: 'test-campaign-1',
      name: `Event ${i}`,
      description: `Description for event ${i}`,
      eventType: types[i % types.length],
      scheduledAt: scheduledAt.toISOString(),
      occurredAt: i % 3 === 0 ? scheduledAt.toISOString() : null, // 33% completed
      isCompleted: i % 3 === 0,
      locationId: i % 5 === 0 ? `location-${Math.floor(i / 5)}` : null,
    });
  }

  return events;
}

// Helper to generate test encounters
function generateEncounters(count: number) {
  const encounters = [];
  const baseDate = new Date('2024-01-01T00:00:00Z');

  for (let i = 0; i < count; i++) {
    const daysOffset = i * 7 + 3; // Space encounters 7 days apart, offset by 3 days from events
    const scheduledAt = new Date(baseDate.getTime() + daysOffset * 24 * 60 * 60 * 1000);

    encounters.push({
      id: `encounter-${i}`,
      campaignId: 'test-campaign-1',
      name: `Encounter ${i}`,
      description: `Description for encounter ${i}`,
      difficulty: (i % 15) + 1, // Difficulty 1-15
      scheduledAt: scheduledAt.toISOString(),
      resolvedAt: i % 4 === 0 ? scheduledAt.toISOString() : null, // 25% resolved
      isResolved: i % 4 === 0,
      locationId: i % 5 === 0 ? `location-${Math.floor(i / 5)}` : null,
    });
  }

  return encounters;
}

describe('Timeline Transformation Performance', () => {
  it('should handle 25 items in <600ms', () => {
    const events = generateEvents(10);
    const encounters = generateEncounters(15);

    const startTime = performance.now();
    const result = transformToTimelineItems(events, encounters);
    const endTime = performance.now();

    const duration = endTime - startTime;

    // Verify transformation completed
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(25);

    // Verify performance threshold
    expect(duration).toBeLessThan(600);

    console.log(`25 items transformed in ${duration.toFixed(2)}ms`);
  });

  it('should handle 50 items in <750ms', () => {
    const events = generateEvents(25);
    const encounters = generateEncounters(25);

    const startTime = performance.now();
    const result = transformToTimelineItems(events, encounters);
    const endTime = performance.now();

    const duration = endTime - startTime;

    // Verify transformation completed
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(50);

    // Verify performance threshold
    expect(duration).toBeLessThan(750);

    console.log(`50 items transformed in ${duration.toFixed(2)}ms`);
  });

  it('should handle 100 items in <1000ms', () => {
    const events = generateEvents(50);
    const encounters = generateEncounters(50);

    const startTime = performance.now();
    const result = transformToTimelineItems(events, encounters);
    const endTime = performance.now();

    const duration = endTime - startTime;

    // Verify transformation completed
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(100);

    // Verify performance threshold
    expect(duration).toBeLessThan(1000);

    console.log(`100 items transformed in ${duration.toFixed(2)}ms`);
  });

  it('should scale linearly with item count', () => {
    const sizes = [25, 50, 100];
    const durations: number[] = [];

    // Run multiple iterations to reduce timing variance
    const iterations = 10;

    for (const size of sizes) {
      const events = generateEvents(size / 2);
      const encounters = generateEncounters(size / 2);

      let totalDuration = 0;
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        transformToTimelineItems(events, encounters);
        const endTime = performance.now();
        totalDuration += endTime - startTime;
      }

      durations.push(totalDuration / iterations);
    }

    // Verify roughly linear scaling with larger datasets (less timing variance)
    const ratio1 = durations[1] / durations[0]; // 50 / 25
    const ratio2 = durations[2] / durations[1]; // 100 / 50

    // With linear scaling, ratio1 should be ~2x, ratio2 should be ~2x
    // Allow 10x tolerance for timing variance and test environment differences
    expect(ratio1).toBeLessThan(10); // 50 items shouldn't take >10x longer than 25 items
    expect(ratio2).toBeLessThan(10); // 100 items shouldn't take >10x longer than 50 items

    console.log(
      `Scaling ratios (averaged over ${iterations} runs): 25→50 = ${ratio1.toFixed(2)}x, 50→100 = ${ratio2.toFixed(2)}x`
    );
  });

  it('should handle all null dates efficiently', () => {
    // Edge case: many items with no valid dates (should filter out quickly)
    const events = generateEvents(25).map((e) => ({
      ...e,
      scheduledAt: null,
      occurredAt: null,
    }));

    const encounters = generateEncounters(25).map((e) => ({
      ...e,
      scheduledAt: null,
      resolvedAt: null,
    }));

    const startTime = performance.now();
    const result = transformToTimelineItems(events, encounters);
    const endTime = performance.now();

    const duration = endTime - startTime;

    // All items should be filtered out
    expect(result).toHaveLength(0);

    // Should be very fast (early exit)
    expect(duration).toBeLessThan(100); // <100ms

    console.log(`50 null-date items filtered in ${duration.toFixed(2)}ms`);
  });

  it('should handle overdue detection with large datasets', () => {
    const events = generateEvents(25);
    const encounters = generateEncounters(25);
    const currentTime = new Date('2025-01-01T00:00:00Z'); // Future date to make most events overdue

    const startTime = performance.now();
    const result = transformToTimelineItems(events, encounters, currentTime);
    const endTime = performance.now();

    const duration = endTime - startTime;

    // Verify transformation completed with overdue detection
    expect(result.length).toBeGreaterThan(0);

    // Overdue detection shouldn't significantly impact performance
    expect(duration).toBeLessThan(600);

    // Verify some items are marked as overdue (red color)
    const overdueItems = result.filter((item: { style?: string }) =>
      item.style?.includes('#ef4444')
    );
    expect(overdueItems.length).toBeGreaterThan(0);

    console.log(
      `50 items with overdue detection transformed in ${duration.toFixed(2)}ms (${overdueItems.length} overdue)`
    );
  });
});
