/**
 * Expression Cache
 * LRU (Least Recently Used) caching for parsed JSONLogic expressions
 *
 * This cache improves performance by avoiding re-parsing of frequently used expressions.
 * It uses an LRU eviction policy to maintain a bounded memory footprint.
 */

import { Injectable } from '@nestjs/common';

import type { Expression } from '../types/expression.types';

/**
 * Cache configuration options
 * Used for testing purposes to create cache instances with custom settings
 */
export interface ExpressionCacheOptions {
  /**
   * Maximum number of expressions to cache
   * Default: 100
   */
  maxSize?: number;
}

/**
 * Cache statistics for monitoring and debugging
 */
export interface CacheStats {
  /**
   * Current number of cached expressions
   */
  size: number;

  /**
   * Maximum cache size (capacity)
   */
  maxSize: number;

  /**
   * All cached keys (ordered from most to least recently used)
   */
  keys: string[];

  /**
   * Number of cache hits
   */
  hits: number;

  /**
   * Number of cache misses
   */
  misses: number;

  /**
   * Cache hit rate (hits / total accesses)
   */
  hitRate: number;
}

/**
 * ExpressionCache
 * Implements an LRU cache for JSONLogic expressions using a Map and manual eviction
 *
 * The LRU behavior is achieved by:
 * 1. Tracking insertion/access order using Map (ES6 Maps maintain insertion order)
 * 2. Moving accessed items to the end by delete + re-insert
 * 3. Evicting the first (oldest) item when capacity is reached
 *
 * This approach avoids the complexity of doubly-linked lists while providing
 * good performance for typical cache sizes (O(1) operations).
 */
@Injectable()
export class ExpressionCache {
  private cache: Map<string, Expression> = new Map();
  private maxSize: number = 100;
  private hits: number = 0;
  private misses: number = 0;

  /**
   * Create a new cache instance with custom options
   * This factory method is used for testing purposes
   *
   * @param options - Cache configuration options
   * @returns New ExpressionCache instance
   */
  static create(options: ExpressionCacheOptions = {}): ExpressionCache {
    const cache = new ExpressionCache();
    cache.maxSize = options.maxSize ?? 100;

    if (cache.maxSize <= 0) {
      throw new Error('maxSize must be positive');
    }

    return cache;
  }

  /**
   * Generate deterministic cache key from expression
   * Uses JSON serialization to create a stable string representation
   *
   * @param expression - The JSONLogic expression to generate a key for
   * @returns Cache key string
   */
  generateKey(expression: Expression): string {
    // JSON.stringify produces consistent output for same object structure
    // This works because JSONLogic expressions are plain JSON objects
    return JSON.stringify(expression);
  }

  /**
   * Get cached expression by key
   * Moves accessed item to end (most recently used)
   *
   * @param key - Cache key
   * @returns Cached expression or undefined if not found
   */
  get(key: string): Expression | undefined {
    const value = this.cache.get(key);

    if (value !== undefined) {
      this.hits++;
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }

    this.misses++;
    return undefined;
  }

  /**
   * Store expression in cache
   * Evicts least recently used item if cache is full
   *
   * @param key - Cache key
   * @param expression - Expression to cache
   */
  set(key: string, expression: Expression): void {
    // If key exists, delete it first so we can re-add at end
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Cache is full - evict least recently used (first) item
      const firstKey = this.cache.keys().next().value as string;
      this.cache.delete(firstKey);
    }

    // Add to end (most recently used)
    this.cache.set(key, expression);
  }

  /**
   * Check if key exists in cache without affecting LRU order or hit/miss stats
   *
   * @param key - Cache key to check
   * @returns True if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Remove specific cache entry by key
   *
   * @param key - Cache key to invalidate
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics for monitoring
   *
   * @returns Cache statistics including size, hit rate, and keys
   */
  getStats(): CacheStats {
    const totalAccesses = this.hits + this.misses;
    const hitRate = totalAccesses > 0 ? this.hits / totalAccesses : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
      hits: this.hits,
      misses: this.misses,
      hitRate,
    };
  }
}
