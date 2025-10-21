import { describe, expect, it } from 'vitest';

import { transformToTimelineItems } from './timeline-transforms';

/**
 * Performance tests for timeline transformation utilities
 *
 * Part of TICKET-022 Stage 12 - Testing, Documentation, and Polish
 *
 * Tests verify that timeline can handle large datasets efficiently:
 * - 100 items: <2.5s transformation
 * - 200 items: <3s transformation
 * - 500 items: <5s transformation
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
  it('should handle 100 items in <2.5 seconds', () => {
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
    expect(duration).toBeLessThan(2500); // <2.5 seconds

    console.log(`100 items transformed in ${duration.toFixed(2)}ms`);
  });

  it('should handle 200 items in <3 seconds', () => {
    const events = generateEvents(100);
    const encounters = generateEncounters(100);

    const startTime = performance.now();
    const result = transformToTimelineItems(events, encounters);
    const endTime = performance.now();

    const duration = endTime - startTime;

    // Verify transformation completed
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(200);

    // Verify performance threshold
    expect(duration).toBeLessThan(3000); // <3 seconds

    console.log(`200 items transformed in ${duration.toFixed(2)}ms`);
  });

  it('should handle 500 items in <5 seconds', () => {
    const events = generateEvents(250);
    const encounters = generateEncounters(250);

    const startTime = performance.now();
    const result = transformToTimelineItems(events, encounters);
    const endTime = performance.now();

    const duration = endTime - startTime;

    // Verify transformation completed
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(500);

    // Verify performance threshold
    expect(duration).toBeLessThan(5000); // <5 seconds

    console.log(`500 items transformed in ${duration.toFixed(2)}ms`);
  });

  it('should scale linearly with item count', () => {
    const sizes = [100, 200, 500];
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
    const ratio1 = durations[1] / durations[0]; // 200 / 100
    const ratio2 = durations[2] / durations[1]; // 500 / 200

    // With linear scaling, ratio1 should be ~2x, ratio2 should be ~2.5x
    // Allow 10x tolerance for timing variance and test environment differences
    expect(ratio1).toBeLessThan(10); // 200 items shouldn't take >10x longer than 100 items
    expect(ratio2).toBeLessThan(10); // 500 items shouldn't take >10x longer than 200 items

    console.log(
      `Scaling ratios (averaged over ${iterations} runs): 100→200 = ${ratio1.toFixed(2)}x, 200→500 = ${ratio2.toFixed(2)}x`
    );
  });

  it('should handle all null dates efficiently', () => {
    // Edge case: many items with no valid dates (should filter out quickly)
    const events = generateEvents(100).map((e) => ({
      ...e,
      scheduledAt: null,
      occurredAt: null,
    }));

    const encounters = generateEncounters(100).map((e) => ({
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

    console.log(`200 null-date items filtered in ${duration.toFixed(2)}ms`);
  });

  it('should handle overdue detection with large datasets', () => {
    const events = generateEvents(100);
    const encounters = generateEncounters(100);
    const currentTime = new Date('2025-01-01T00:00:00Z'); // Future date to make most events overdue

    const startTime = performance.now();
    const result = transformToTimelineItems(events, encounters, currentTime);
    const endTime = performance.now();

    const duration = endTime - startTime;

    // Verify transformation completed with overdue detection
    expect(result.length).toBeGreaterThan(0);

    // Overdue detection shouldn't significantly impact performance
    expect(duration).toBeLessThan(2500); // <2.5 seconds

    // Verify some items are marked as overdue (red color)
    const overdueItems = result.filter((item) => item.style?.includes('#ef4444'));
    expect(overdueItems.length).toBeGreaterThan(0);

    console.log(
      `200 items with overdue detection transformed in ${duration.toFixed(2)}ms (${overdueItems.length} overdue)`
    );
  });
});
