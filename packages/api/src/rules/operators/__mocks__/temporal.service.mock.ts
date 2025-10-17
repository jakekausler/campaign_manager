/**
 * Mock Temporal Service for Testing
 * Simulates temporal queries without requiring actual database
 */

/**
 * Mock temporal service with test data
 */
export class MockTemporalService {
  private readonly events: Map<string, Date> = new Map();
  private currentWorldTime: Date = new Date();

  /**
   * Set the current world time for testing
   */
  setCurrentWorldTime(date: Date): void {
    this.currentWorldTime = date;
  }

  /**
   * Add a test event with its timestamp
   */
  addEvent(eventPath: string, timestamp: Date): void {
    this.events.set(eventPath, timestamp);
  }

  /**
   * Get the number of days since an event occurred
   * Returns null if event doesn't exist
   */
  daysSince(eventPath: string): number | null {
    const eventTime = this.events.get(eventPath);

    if (!eventTime) {
      return null;
    }

    const diffMs = this.currentWorldTime.getTime() - eventTime.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Clear all test data
   */
  clear(): void {
    this.events.clear();
    this.currentWorldTime = new Date();
  }
}
