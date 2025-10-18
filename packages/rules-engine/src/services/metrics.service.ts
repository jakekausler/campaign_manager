/**
 * Metrics Service
 * Collects and tracks performance metrics for the Rules Engine Worker
 */

import { Injectable } from '@nestjs/common';

export interface MetricsSummary {
  evaluations: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  };
  latency: {
    totalMs: number;
    averageMs: number;
    minMs: number;
    maxMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  timestamp: string;
  uptimeMs: number;
}

interface LatencyEntry {
  timestamp: number;
  durationMs: number;
}

@Injectable()
export class MetricsService {
  private readonly startTime: number;

  // Evaluation counters
  private totalEvaluations = 0;
  private successfulEvaluations = 0;
  private failedEvaluations = 0;

  // Latency tracking (circular buffer to limit memory usage)
  private readonly latencyBufferSize = 1000;
  private latencyEntries: LatencyEntry[] = [];

  // Cache metrics
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Record a successful evaluation
   */
  recordEvaluationSuccess(durationMs: number): void {
    this.totalEvaluations++;
    this.successfulEvaluations++;
    this.recordLatency(durationMs);
  }

  /**
   * Record a failed evaluation
   */
  recordEvaluationFailure(durationMs: number): void {
    this.totalEvaluations++;
    this.failedEvaluations++;
    this.recordLatency(durationMs);
  }

  /**
   * Record cache hit
   */
  recordCacheHit(): void {
    this.cacheHits++;
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  /**
   * Record latency measurement
   */
  private recordLatency(durationMs: number): void {
    const entry: LatencyEntry = {
      timestamp: Date.now(),
      durationMs,
    };

    // Add to buffer
    this.latencyEntries.push(entry);

    // Trim buffer if it exceeds size limit (circular buffer behavior)
    if (this.latencyEntries.length > this.latencyBufferSize) {
      this.latencyEntries.shift();
    }
  }

  /**
   * Get metrics summary
   */
  getSummary(): MetricsSummary {
    const successRate =
      this.totalEvaluations > 0 ? this.successfulEvaluations / this.totalEvaluations : 0;

    const cacheHitRate =
      this.cacheHits + this.cacheMisses > 0
        ? this.cacheHits / (this.cacheHits + this.cacheMisses)
        : 0;

    const latencyStats = this.calculateLatencyStats();

    return {
      evaluations: {
        total: this.totalEvaluations,
        successful: this.successfulEvaluations,
        failed: this.failedEvaluations,
        successRate,
      },
      latency: latencyStats,
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate: cacheHitRate,
      },
      timestamp: new Date().toISOString(),
      uptimeMs: Date.now() - this.startTime,
    };
  }

  /**
   * Calculate latency statistics
   */
  private calculateLatencyStats(): MetricsSummary['latency'] {
    if (this.latencyEntries.length === 0) {
      return {
        totalMs: 0,
        averageMs: 0,
        minMs: 0,
        maxMs: 0,
        p50Ms: 0,
        p95Ms: 0,
        p99Ms: 0,
      };
    }

    // Extract durations and sort for percentile calculation
    const durations = this.latencyEntries.map((e) => e.durationMs).sort((a, b) => a - b);

    const totalMs = durations.reduce((sum, d) => sum + d, 0);
    const averageMs = totalMs / durations.length;
    const minMs = durations[0];
    const maxMs = durations[durations.length - 1];

    // Calculate percentiles
    const p50Ms = this.getPercentile(durations, 0.5);
    const p95Ms = this.getPercentile(durations, 0.95);
    const p99Ms = this.getPercentile(durations, 0.99);

    return {
      totalMs,
      averageMs,
      minMs,
      maxMs,
      p50Ms,
      p95Ms,
      p99Ms,
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.totalEvaluations = 0;
    this.successfulEvaluations = 0;
    this.failedEvaluations = 0;
    this.latencyEntries = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get uptime in milliseconds
   */
  getUptimeMs(): number {
    return Date.now() - this.startTime;
  }
}
