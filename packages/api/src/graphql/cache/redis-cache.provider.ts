/**
 * Redis Cache Provider
 * Configures Redis for caching (separate from PubSub)
 */

import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';

/**
 * Creates and configures a Redis client instance for caching
 */
export function createRedisCache(): Redis {
  const options: RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_CACHE_DB || '1', 10), // Use DB 1 for cache (DB 0 for pubsub)
    retryStrategy: (times: number) => {
      // Exponential backoff with max delay of 3 seconds
      const delay = Math.min(times * 50, 3000);
      return delay;
    },
    // Connection timeout
    connectTimeout: 10000,
    // Enable offline queue to buffer commands when disconnected
    enableOfflineQueue: true,
    // Reconnect on error
    reconnectOnError: (err: Error) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        // Reconnect on READONLY errors
        return true;
      }
      return false;
    },
    // Key prefix for namespacing
    keyPrefix: 'cache:',
  };

  const redis = new Redis(options);

  // Add error logging for debugging Redis connection issues
  // Don't log connection options that might contain password
  redis.on('error', (err) => {
    console.error('Redis Cache Error:', err.message);
  });

  redis.on('connect', () => {
    console.log('Redis Cache connected');
  });

  redis.on('ready', () => {
    console.log('Redis Cache ready');
  });

  return redis;
}

/**
 * Injection token for Redis Cache
 */
export const REDIS_CACHE = 'REDIS_CACHE';
